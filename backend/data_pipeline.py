"""Data pipeline to populate Player data from NHL API and MoneyPuck.

Functions are organized for testability and clarity. This module does not
retrain models; it uses pickled artifacts loaded via `model_loader`.
"""
import os
import io
import csv
import zipfile
import tempfile
import urllib.request
import json
import re
import unicodedata
from typing import List, Dict, Any

import pandas as pd
from fastapi import HTTPException

from backend.config import CURRENT_SEASON, MONEYPUCK_SEASON_YEAR, MONEPUCK_SKATERS_URL, MONEPUCK_SHOTS_ZIP, SALARY_CAP_BY_SEASON, ROSTER_SEASON_CODE
from backend.model_loader import get_models
from backend.routers_admin_players import TEAM_NAME_TO_TRICODE
from backend.database import SessionLocal
from backend import models


def _normalize_name(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", str(value))
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.lower().replace(".", "").replace("'", "")
    normalized = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", normalized)
    normalized = re.sub(r"[^a-z ]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def fetch_nhl_player_bios(team_codes: List[str] | None = None) -> List[Dict[str, Any]]:
    """Fetch NHL roster bios for given team codes (tri-codes). Returns list of dicts with keys: name, player_id, team, position, birthDate.
    If team_codes is None, fetch for all known teams from TEAM_NAME_TO_TRICODE.
    """
    if team_codes is None:
        team_codes = list(TEAM_NAME_TO_TRICODE.values())
    # TEAM_NAME_TO_TRICODE contains aliases that can share the same tri-code.
    # Keep insertion order while deduplicating to avoid duplicate roster pulls.
    team_codes = list(dict.fromkeys(team_codes))

    bios = []
    seen_players = set()
    for team in team_codes:
        url = f"https://api-web.nhle.com/v1/roster/{team}/{ROSTER_SEASON_CODE}"
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                "Referer": "https://www.nhl.com/",
                "Origin": "https://www.nhl.com",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                payload = json.load(response)
        except Exception:
            continue

        # Payload shape: {'forwards': [...], 'defensemen': [...], 'goalies': [...]}.
        roster_sections = []
        if isinstance(payload, dict):
            for section in ("forwards", "defensemen", "goalies"):
                vals = payload.get(section)
                if isinstance(vals, list):
                    roster_sections.extend(vals)

        for entry in roster_sections:
            pid = entry.get("id") or entry.get("playerId") or entry.get("personId")

            first = entry.get("firstName")
            if isinstance(first, dict):
                first = first.get("default") or next(iter(first.values()), "")
            first = first or ""

            last = entry.get("lastName")
            if isinstance(last, dict):
                last = last.get("default") or next(iter(last.values()), "")
            last = last or ""

            full_name = (f"{first} {last}").strip() or entry.get("name") or entry.get("fullName")
            birth = entry.get("birthDate") or entry.get("birthdate")
            pos = entry.get("positionCode") or entry.get("position")

            if not full_name:
                continue

            player_id = str(pid) if pid else None
            player_key = (player_id, team) if player_id else (_normalize_name(full_name), team, pos)
            if player_key in seen_players:
                continue
            seen_players.add(player_key)

            bios.append({"name": full_name, "nhl_player_id": player_id, "team": team, "position": pos, "birthdate": birth})

    return bios


def fetch_moneypuck_skaters() -> pd.DataFrame:
    """Download MoneyPuck season skaters CSV and return DataFrame.
    """
    url = MONEPUCK_SKATERS_URL
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "text/csv,application/octet-stream,*/*",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Referer": "https://moneypuck.com/",
            "Origin": "https://moneypuck.com",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    df = pd.read_csv(io.BytesIO(data))
    return df


def score_shots_with_xg() -> pd.DataFrame:
    """Download shots zip, score with xg model, and return per-player aggregation DataFrame with xG_all_situations keyed by shooterName and teamCode."""
    import numpy as np

    models_bundle = get_models()["xg"]
    model = models_bundle.get("model") if isinstance(models_bundle, dict) else models_bundle
    encoder = models_bundle.get("encoder") if isinstance(models_bundle, dict) else None
    cat_cols = models_bundle.get("cat_cols") if isinstance(models_bundle, dict) else []

    # download zip
    req = urllib.request.Request(
        MONEPUCK_SHOTS_ZIP,
        headers={
            "Accept": "application/zip,application/octet-stream,*/*",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Referer": "https://peter-tanner.com/",
            "Origin": "https://peter-tanner.com",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        zdata = resp.read()

    with zipfile.ZipFile(io.BytesIO(zdata)) as zf:
        # find a CSV inside
        csv_names = [n for n in zf.namelist() if n.lower().endswith('.csv')]
        if not csv_names:
            raise RuntimeError("No CSV found inside shots zip")
        # read first csv
        with zf.open(csv_names[0]) as cf:
            shots_df = pd.read_csv(cf)

    # Match the same preprocessing/feature set used in xg_model.py inference.
    required_cols = [
        'shotDistance', 'timeSinceLastEvent', 'shotType', 'speedFromLastEvent',
        'shotAngle', 'lastEventxCord_adjusted', 'lastEventyCord_adjusted',
        'lastEventCategory', 'xCordAdjusted', 'yCordAdjusted',
        'distanceFromLastEvent', 'awayPenalty1TimeLeft', 'homePenalty1TimeLeft',
        'homeSkatersOnIce', 'awaySkatersOnIce', 'shotOnEmptyNet',
        'shotAnglePlusRebound', 'shooterName', 'team', 'homeTeamCode', 'awayTeamCode'
    ]
    missing = [c for c in required_cols if c not in shots_df.columns]
    if missing:
        raise RuntimeError(f"shots file missing required columns: {missing}")

    work = shots_df.copy()
    work['reboundAngleRate'] = work['shotAnglePlusRebound'] / work['timeSinceLastEvent']
    work['reboundAngleRate'] = work['reboundAngleRate'].replace([np.inf, -np.inf], 0)

    raw_cols = [
        'shotDistance', 'timeSinceLastEvent', 'shotType', 'speedFromLastEvent',
        'shotAngle', 'lastEventxCord_adjusted', 'lastEventyCord_adjusted',
        'lastEventCategory', 'xCordAdjusted', 'yCordAdjusted',
        'distanceFromLastEvent', 'awayPenalty1TimeLeft', 'homePenalty1TimeLeft',
        'homeSkatersOnIce', 'awaySkatersOnIce', 'shotOnEmptyNet',
        'reboundAngleRate'
    ]

    X = work[raw_cols].dropna()
    shooter_names = work.loc[X.index, 'shooterName']
    team_col = work.loc[X.index, 'team']
    home_team = work.loc[X.index, 'homeTeamCode']
    away_team = work.loc[X.index, 'awayTeamCode']

    if encoder is None or not cat_cols:
        raise RuntimeError("xg_model.pkl bundle missing encoder/cat_cols; expected {'model','encoder','cat_cols'}")

    encoded = pd.DataFrame(
        encoder.transform(X[cat_cols]),
        columns=encoder.get_feature_names_out(cat_cols),
        index=X.index,
    )
    X = X.drop(columns=cat_cols).join(encoded)

    # Predict probabilities; if model has predict_proba
    if hasattr(model, 'predict_proba'):
        probs = model.predict_proba(X)
        # If binary, take column 1
        if probs.ndim == 2:
            xg_probs = probs[:, 1]
        else:
            xg_probs = probs
    else:
        xg_probs = model.predict(X)

    scored = pd.DataFrame(index=X.index)
    scored['xg_prob'] = xg_probs
    scored['shooterName'] = shooter_names
    scored['teamCode'] = np.where(team_col == 'HOME', home_team, away_team)

    # aggregate per shooter and team
    agg = scored.groupby(['shooterName', 'teamCode'], dropna=False)['xg_prob'].sum().reset_index().rename(columns={'xg_prob': 'xG_all_situations'})
    return agg


def compute_age_at_signing(birthdate: str, signing_date: str | None) -> float | None:
    """Compute age at signing as of Sept 15 of signing year. If signing_date is missing, return None.
    Dates expected as ISO strings; caller must handle parsing.
    """
    if not signing_date:
        return None
    try:
        from datetime import datetime
        sdt = datetime.fromisoformat(signing_date)
        sept15 = datetime(sdt.year, 9, 15)
        bdt = datetime.fromisoformat(birthdate)
        age = (sept15 - bdt).days / 365.25
        return age
    except Exception:
        return None


def build_features_and_score_market_value(bios: List[Dict[str, Any]], skaters_df: pd.DataFrame, xg_agg: pd.DataFrame) -> pd.DataFrame:
    """Assemble feature rows per player and score market value models. Returns DataFrame with market_value and capPercent."""
    models_map = get_models()
    fwd_model = models_map['fwd']
    def_model = models_map['def']

    rows = []
    # Prepare lookup maps
    skaters_df_copy = skaters_df.copy()
    # MoneyPuck season summary includes multiple situations; keep all-situations rows.
    if 'situation' in skaters_df_copy.columns:
        skaters_df_copy = skaters_df_copy[skaters_df_copy['situation'].astype(str).str.lower() == 'all']

    name_col = 'name' if 'name' in skaters_df_copy.columns else ('playerName' if 'playerName' in skaters_df_copy.columns else None)
    team_col = 'team' if 'team' in skaters_df_copy.columns else ('teamCode' if 'teamCode' in skaters_df_copy.columns else None)
    if name_col is None:
        raise RuntimeError("MoneyPuck skaters CSV missing player name column (expected 'name' or 'playerName').")

    skaters_df_copy['_normalized_name'] = skaters_df_copy[name_col].map(_normalize_name)

    def nz(value, default=0.0):
        try:
            if pd.isna(value):
                return default
        except Exception:
            pass
        if value is None:
            return default
        return value
    xg_map = {(r['shooterName'], r['teamCode']): r['xG_all_situations'] for _, r in xg_agg.iterrows()}

    for bio in bios:
        name = bio.get('name')
        team = bio.get('team')
        nhl_id = bio.get('nhl_player_id')
        birth = bio.get('birthdate')
        pos = bio.get('position') or ''

        # match skater row by name and team
        matched = skaters_df_copy[skaters_df_copy[name_col] == name]
        if team and team_col and not matched.empty:
            matched = matched[matched[team_col] == team]

        if matched.empty:
            # Fallback for punctuation/diacritics differences (e.g. apostrophes, accents).
            normalized_name = _normalize_name(name)
            if normalized_name:
                matched = skaters_df_copy[skaters_df_copy['_normalized_name'] == normalized_name]
                if team and team_col and not matched.empty:
                    matched = matched[matched[team_col] == team]

        if matched.empty:
            # flag missing — still create minimal row
            sk = pd.Series({c: None for c in skaters_df_copy.columns})
        else:
            sk = matched.iloc[0]

        # compute xg
        xg_val = xg_map.get((name, team)) or xg_map.get((name, sk.get('teamCode')))

        icetime = sk.get('icetime') if 'icetime' in sk.index else sk.get('timeOnIce', None)
        points = sk.get('points') if 'points' in sk.index else sk.get('I_F_points', None)

        # engineered
        try:
            points_per_60 = (sk.get('I_F_points', points) / float(icetime)) * 3600 if icetime and icetime != 0 else None
        except Exception:
            points_per_60 = None

        age_at_signing = float('nan')  # contract signing data not available — leave missing per instructions

        feature = {
            'I_F_points': nz(sk.get('I_F_points', points), 0.0),
            'I_F_primaryAssists': nz(sk.get('I_F_primaryAssists', 0), 0.0),
            'I_F_secondaryAssists': nz(sk.get('I_F_secondaryAssists', 0), 0.0),
            'I_F_goals': nz(sk.get('I_F_goals', sk.get('goals', 0)), 0.0),
            'I_F_highDangerShots': nz(sk.get('I_F_highDangerShots', 0), 0.0),
            'I_F_highDangerGoals': nz(sk.get('I_F_highDangerGoals', 0), 0.0),
            'I_F_hits': nz(sk.get('I_F_hits', 0), 0.0),
            'I_F_takeaways': nz(sk.get('I_F_takeaways', 0), 0.0),
            'points_per_60': nz(points_per_60, 0.0),
            'I_F_giveaways': nz(sk.get('I_F_giveaways', 0), 0.0),
            'I_F_dZoneGiveaways': nz(sk.get('I_F_dZoneGiveaways', 0), 0.0),
            'I_F_blockedShotAttempts': nz(sk.get('I_F_blockedShotAttempts', 0), 0.0),
            'OnIce_A_xGoals': nz(sk.get('OnIce_A_xGoals', 0), 0.0),
            'OnIce_A_goals': nz(sk.get('OnIce_A_goals', 0), 0.0),
            'games_played': nz(sk.get('games_played', sk.get('games', 0)), 0.0),
            'icetime': nz(icetime, 0.0),
            'onIce_xGoalsPercentage': nz(sk.get('onIce_xGoalsPercentage', 0), 0.0),
            'onIce_corsiPercentage': nz(sk.get('onIce_corsiPercentage', 0), 0.0),
            'xG_all_situations': nz(xg_val, 0.0),
            'Age at Signing': age_at_signing,
            'position': 3 if (pos == 'D' or pos == 'defenseman') else (0 if pos == 'C' else (1 if pos == 'L' else (2 if pos == 'R' else 0)))
        }

        # Select model
        model = def_model if feature['position'] == 3 else fwd_model

        # Create DataFrame row in the exact order required
        X_row = pd.DataFrame([[
            feature['I_F_points'], feature['I_F_primaryAssists'], feature['I_F_secondaryAssists'], feature['I_F_goals'],
            feature['I_F_highDangerShots'], feature['I_F_highDangerGoals'], feature['I_F_hits'], feature['I_F_takeaways'],
            feature['points_per_60'], feature['I_F_giveaways'], feature['I_F_dZoneGiveaways'], feature['I_F_blockedShotAttempts'],
            feature['OnIce_A_xGoals'], feature['OnIce_A_goals'], feature['games_played'], feature['icetime'],
            feature['onIce_xGoalsPercentage'], feature['onIce_corsiPercentage'], feature['xG_all_situations'],
            feature['Age at Signing'], feature['position']
        ]], columns=[
            'I_F_points','I_F_primaryAssists','I_F_secondaryAssists','I_F_goals',
            'I_F_highDangerShots','I_F_highDangerGoals','I_F_hits','I_F_takeaways',
            'points_per_60','I_F_giveaways','I_F_dZoneGiveaways','I_F_blockedShotAttempts',
            'OnIce_A_xGoals','OnIce_A_goals','games_played','icetime',
            'onIce_xGoalsPercentage','onIce_corsiPercentage','xG_all_situations',
            'Age at Signing','position'
        ])

        try:
            capPercent = float(model.predict(X_row)[0])
        except Exception:
            capPercent = 0.0

        salary_cap = SALARY_CAP_BY_SEASON.get(CURRENT_SEASON)
        market_value = capPercent * salary_cap if salary_cap else None

        rows.append({
            'player_name': name,
            'nhl_player_id': nhl_id,
            'team': team,
            'position': pos,
            'market_value': market_value,
            'capPercent': capPercent,
            'xG_all_situations': feature['xG_all_situations'],
            'season': CURRENT_SEASON,
            'goals': feature['I_F_goals'],
            'assists': feature['I_F_primaryAssists'] + feature['I_F_secondaryAssists'],
            'points': feature['I_F_points'],
            'games_played': feature['games_played'],
            'icetime': feature['icetime'],
            'high_danger_shots': feature['I_F_highDangerShots'],
            'blocked_shots': feature['I_F_blockedShotAttempts'],
            'hits': feature['I_F_hits'],
            'takeaways': feature['I_F_takeaways'],
            'giveaways': feature['I_F_giveaways'],
        })

    return pd.DataFrame(rows)


def write_players_to_db(df: pd.DataFrame):
    """Upsert players for CURRENT_SEASON. For simplicity, delete existing players for the season then insert."""
    db = SessionLocal()
    try:
        # delete existing season rows
        db.query(models.Player).filter(models.Player.season == CURRENT_SEASON).delete()
        db.commit()

        for _, r in df.iterrows():
            p = models.Player(
                player_name=r.get('player_name'),
                nhl_player_id=r.get('nhl_player_id'),
                team=r.get('team'),
                position=r.get('position'),
                games_played=int(r.get('games_played') or 0),
                hits=float(r.get('hits') or 0),
                takeaways=float(r.get('takeaways') or 0),
                giveaways=float(r.get('giveaways') or 0),
                market_value=r.get('market_value'),
                aav=None,
                headshot_url=None,
                xg_all_situations=r.get('xG_all_situations'),
                season=r.get('season')
            )
            db.add(p)
        db.commit()
    finally:
        db.close()


def update_existing_players_from_predictions(df: pd.DataFrame):
    """Update only existing players with model outputs.

    This avoids creating duplicate players/teams and preserves the existing
    player pool managed by NHL roster imports in the app.
    """
    db = SessionLocal()
    try:
        existing = db.query(models.Player).all()
        by_id = {}
        by_name = {}
        for p in existing:
            if p.nhl_player_id:
                by_id[str(p.nhl_player_id)] = p
            if p.player_name:
                by_name[p.player_name.strip().lower()] = p

        updated = 0
        for _, r in df.iterrows():
            pid = r.get('nhl_player_id')
            name = (r.get('player_name') or '').strip().lower()

            p = None
            if pid and str(pid) in by_id:
                p = by_id[str(pid)]
            elif name and name in by_name:
                p = by_name[name]

            if not p:
                continue

            # Maintain season-by-season snapshots so profile stats can roll over
            # cleanly when CURRENT_SEASON advances.
            season_history = []
            try:
                if getattr(p, 'season_history_json', None):
                    parsed = json.loads(p.season_history_json)
                    if isinstance(parsed, list):
                        season_history = parsed
            except Exception:
                season_history = []

            snapshot = {
                'season': CURRENT_SEASON,
                'goals': int(r.get('goals') or 0),
                'assists': int(r.get('assists') or 0),
                'points': int(r.get('points') or 0),
                'games_played': int(r.get('games_played') or 0),
                'xg_all_situations': float(r.get('xG_all_situations') or 0),
                'icetime': float(r.get('icetime') or 0),
                'high_danger_shots': float(r.get('high_danger_shots') or 0),
                'blocked_shots': float(r.get('blocked_shots') or 0),
                'hits': float(r.get('hits') or 0),
                'takeaways': float(r.get('takeaways') or 0),
                'giveaways': float(r.get('giveaways') or 0),
                'market_value': float(r.get('market_value') or 0),
            }
            replaced = False
            for i, row in enumerate(season_history):
                if isinstance(row, dict) and row.get('season') == CURRENT_SEASON:
                    season_history[i] = snapshot
                    replaced = True
                    break
            if not replaced:
                season_history.append(snapshot)
            p.season_history_json = json.dumps(season_history)

            # Only update computed/stat fields; preserve team/name as-is.
            p.xg_all_situations = float(r.get('xG_all_situations') or 0)
            mv = r.get('market_value')
            if mv is not None:
                p.market_value = float(mv)
            if r.get('goals') is not None:
                p.goals = int(r.get('goals') or 0)
            if r.get('assists') is not None:
                p.assists = int(r.get('assists') or 0)
            if r.get('points') is not None:
                p.points = int(r.get('points') or 0)
            if r.get('games_played') is not None:
                p.games_played = int(r.get('games_played') or 0)
            if r.get('icetime') is not None:
                p.icetime = float(r.get('icetime') or 0)
            if r.get('high_danger_shots') is not None:
                p.high_danger_shots = float(r.get('high_danger_shots') or 0)
            if r.get('blocked_shots') is not None:
                p.blocked_shots = float(r.get('blocked_shots') or 0)
            if r.get('hits') is not None:
                p.hits = float(r.get('hits') or 0)
            if r.get('takeaways') is not None:
                p.takeaways = float(r.get('takeaways') or 0)
            if r.get('giveaways') is not None:
                p.giveaways = float(r.get('giveaways') or 0)
            p.season = CURRENT_SEASON

            db.add(p)
            updated += 1

        db.commit()
        return {"updated": updated, "existing": len(existing)}
    finally:
        db.close()


def run_full_pipeline(update_existing_only: bool = True):
    """High-level orchestrator: fetch bios, moneypuck skaters, xg, build features, score, and write to DB."""
    print("Running data pipeline for season", CURRENT_SEASON)
    bios = fetch_nhl_player_bios()
    skaters = fetch_moneypuck_skaters()
    xg_agg = score_shots_with_xg()
    df = build_features_and_score_market_value(bios, skaters, xg_agg)
    if update_existing_only:
        update_existing_players_from_predictions(df)
    else:
        write_players_to_db(df)
    return df
