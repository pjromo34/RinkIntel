from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Player
from backend.model_loader import get_models
from backend.config import CURRENT_SEASON, SALARY_CAP_BY_SEASON

import numpy as np
import pandas as pd
import json
from typing import Optional


router = APIRouter(prefix="/arbitration", tags=["arbitration"])

FEATURE_COLS = [
    "onice_fenwick_pct",
    "onice_corsi_pct",
    "onice_xgoals_pct",
    "goals",
    "primary_assists",
    "icetime",
    "takeaways",
    "hits",
    "dzone_giveaways",
    "giveaways",
]

MODEL_FEATURE_COLS = [
    "onIce_fenwickPercentage",
    "onIce_corsiPercentage",
    "onIce_xGoalsPercentage",
    "I_F_goals",
    "I_F_primaryAssists",
    "icetime",
    "I_F_takeaways",
    "I_F_hits",
    "I_F_dZoneGiveaways",
    "I_F_giveaways",
]

COMP_WEIGHTS = {
    "goals": 3.0,
    "primary_assists": 3.0,
    "icetime": 3.0,
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _norm_position_group(position: Optional[str]) -> str:
    pos = str(position or "").strip().upper()
    if pos == "D":
        return "D"
    if pos in {"G", "GOALIE", "GOALTENDER"}:
        return "G"
    return "F"


def _player_feature_row(player: Player) -> dict:
    return {
        "onice_fenwick_pct": float(player.onice_fenwick_pct or 0),
        "onice_corsi_pct": float(player.onice_corsi_pct or 0),
        "onice_xgoals_pct": float(player.onice_xgoals_pct or 0),
        "goals": float(player.goals or 0),
        "primary_assists": float(player.primary_assists or 0),
        "icetime": float(player.icetime or 0),
        "takeaways": float(player.takeaways or 0),
        "hits": float(player.hits or 0),
        "dzone_giveaways": float(player.dzone_giveaways or 0),
        "giveaways": float(player.giveaways or 0),
    }


def _season_start(season_label: Optional[str]) -> int:
    if not season_label:
        return 0
    text = str(season_label)
    digits = ""
    for ch in text:
        if ch.isdigit():
            digits += ch
            if len(digits) == 4:
                break
    return int(digits) if len(digits) == 4 else 0


def _season_label(start_year: int) -> str:
    return f"{start_year}-{str((start_year + 1) % 100).zfill(2)}"


def _aav_for_season_from_contracts(player: Player, season: Optional[str]) -> Optional[float]:
    if not season:
        return None

    contracts = []
    try:
        parsed = json.loads(getattr(player, "contracts_json", None) or "[]")
        if isinstance(parsed, list):
            contracts = parsed
    except Exception:
        contracts = []

    season_year = _season_start(season)
    if season_year <= 0:
        return None

    chosen = None
    for row in contracts:
        if not isinstance(row, dict):
            continue
        start = _season_start(row.get("start_season") or row.get("season"))
        years = int(row.get("years") or row.get("length") or 0)
        if start <= 0 or years <= 0:
            continue
        end = start + years - 1
        if start <= season_year <= end:
            if chosen is None or start >= chosen[0]:
                chosen = (start, float(row.get("aav") or 0))

    return chosen[1] if chosen is not None else None


@router.get("/players")
def arbitration_players(db: Session = Depends(get_db)):
    players = (
        db.query(Player)
        .filter(Player.active_roster.is_(True))
        .order_by(Player.player_name.asc())
        .all()
    )

    return [
        {
            "id": p.id,
            "player_name": p.player_name,
            "team": p.team,
            "position": p.position,
            "aav": float(p.aav or 0),
            "headshot_url": p.headshot_url,
        }
        for p in players
        if str(p.position or "").strip().upper() not in {"G", "GOALIE", "GOALTENDER"}
    ]


@router.get("/predict/{player_id}")
def arbitration_predict(
    player_id: int,
    qo_offered: bool = Query(False),
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(Player.id == player_id, Player.active_roster.is_(True)).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    try:
        model = get_models().get("arbitration")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Arbitration model load failed: {exc}")
    if model is None:
        raise HTTPException(status_code=500, detail="Arbitration model not loaded")

    salary_cap = SALARY_CAP_BY_SEASON.get(CURRENT_SEASON)
    if not salary_cap:
        raise HTTPException(status_code=500, detail=f"Salary cap missing for season {CURRENT_SEASON}")

    feature_row = _player_feature_row(player)
    X_row = pd.DataFrame([[feature_row[c] for c in FEATURE_COLS]], columns=MODEL_FEATURE_COLS)

    try:
        raw_prediction_millions = float(model.predict(X_row)[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Arbitration prediction failed: {exc}")

    # Arbitration model outputs AAV in millions of dollars.
    raw_dollars = raw_prediction_millions * 1_000_000.0

    previous_season_pay = float(player.aav or 0)
    floor = 0.0
    if previous_season_pay >= 2_430_000:
        floor = max(floor, 0.85 * previous_season_pay)
    if qo_offered:
        floor = max(floor, 1.00 * previous_season_pay)
    final_award = max(raw_dollars, floor)

    group = _norm_position_group(player.position)
    current_start = _season_start(CURRENT_SEASON)
    next_season = _season_label(current_start + 1) if current_start > 0 else None
    pool = (
        db.query(Player)
        .filter(Player.active_roster.is_(True))
        .filter(Player.id != player.id)
        .filter(Player.games_played >= 20)
        .all()
    )

    comp_candidates = [
        p for p in pool if _norm_position_group(p.position) == group
    ]

    comparables = []
    if comp_candidates:
        records = []
        for p in comp_candidates:
            row = _player_feature_row(p)
            next_aav = _aav_for_season_from_contracts(p, next_season)
            comp_aav = float(next_aav) if next_aav is not None else float(p.aav or 0)
            row.update({
                "id": p.id,
                "player_name": p.player_name,
                "team": p.team,
                "aav": comp_aav,
            })
            records.append(row)

        comp_df = pd.DataFrame(records)
        feature_df = comp_df[FEATURE_COLS].astype(float)

        means = feature_df.mean(axis=0)
        stds = feature_df.std(axis=0, ddof=0).replace(0, 1)

        z_pool = (feature_df - means) / stds
        target_series = pd.Series(feature_row)[FEATURE_COLS].astype(float)
        z_target = (target_series - means) / stds

        weight_vec = np.array([COMP_WEIGHTS.get(col, 1.0) for col in FEATURE_COLS], dtype=float)
        deltas = z_pool.values - z_target.values
        distances = np.sqrt(np.sum((deltas * weight_vec) ** 2, axis=1))

        comp_df = comp_df.assign(_distance=distances).sort_values("_distance", ascending=True)
        top = comp_df.head(3)

        comparables = [
            {
                "id": int(r["id"]),
                "player_name": r["player_name"],
                "team": r["team"],
                "aav": float(r["aav"] or 0),
            }
            for _, r in top.iterrows()
        ]

    return {
        "player_id": player.id,
        "player_name": player.player_name,
        "predicted_award": float(final_award),
        "comparables": comparables,
    }
