from __future__ import annotations

from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
import json
import sys
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.config import CURRENT_SEASON
from backend.database import SessionLocal
from backend.model_loader import get_models
from backend.models import Player
from backend.routers_players import TEAM_NAME_TO_TRICODE_SIMPLE

RISK_DIR = Path(__file__).resolve().parent.parent / "riskscore"
if str(RISK_DIR) not in sys.path:
    sys.path.insert(0, str(RISK_DIR))

from risk_score import compute_risk_scores  # type: ignore

router = APIRouter(prefix="/contract-research", tags=["contract-research"])

SIMILARITY_FEATURE_MAP = [
    ("onice_fenwick_pct", "onIce_fenwickPercentage"),
    ("onice_corsi_pct", "onIce_corsiPercentage"),
    ("onice_xgoals_pct", "onIce_xGoalsPercentage"),
    ("goals", "I_F_goals"),
    ("primary_assists", "I_F_primaryAssists"),
    ("icetime", "icetime"),
    ("takeaways", "I_F_takeaways"),
    ("hits", "I_F_hits"),
    ("dzone_giveaways", "I_F_dZoneGiveaways"),
    ("giveaways", "I_F_giveaways"),
]
SIMILARITY_STATS = [row_key for row_key, _ in SIMILARITY_FEATURE_MAP]
SIMILARITY_LABELS = {
    "onice_fenwick_pct": "shot share",
    "onice_corsi_pct": "puck possession",
    "onice_xgoals_pct": "chance quality",
    "goals": "goal scoring",
    "primary_assists": "playmaking",
    "icetime": "usage",
    "takeaways": "puck retrieval",
    "hits": "physical play",
    "dzone_giveaways": "defensive-zone puck management",
    "giveaways": "turnover control",
}
SIMILARITY_FORMATTERS = {
    "onice_fenwick_pct": lambda value: f"{_safe_numeric(value):.1f}%",
    "onice_corsi_pct": lambda value: f"{_safe_numeric(value):.1f}%",
    "onice_xgoals_pct": lambda value: f"{_safe_numeric(value):.1f}%",
    "goals": lambda value: str(int(round(_safe_numeric(value)))),
    "primary_assists": lambda value: str(int(round(_safe_numeric(value)))),
    "icetime": lambda value: str(int(round(_safe_numeric(value)))),
    "takeaways": lambda value: str(int(round(_safe_numeric(value)))),
    "hits": lambda value: str(int(round(_safe_numeric(value)))),
    "dzone_giveaways": lambda value: str(int(round(_safe_numeric(value)))),
    "giveaways": lambda value: str(int(round(_safe_numeric(value)))),
}
SIMILARITY_SIGNAL_FLOORS = {
    "goals": 8.0,
    "primary_assists": 10.0,
    "icetime": 400.0,
    "takeaways": 10.0,
    "hits": 20.0,
    "dzone_giveaways": 10.0,
    "giveaways": 10.0,
}
WEIGHT_UNIFORM_BLEND = 0.35


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _season_start(season_label: Optional[str]) -> int:
    text = str(season_label or "")
    digits = ""
    for ch in text:
        if ch.isdigit():
            digits += ch
            if len(digits) == 4:
                break
    return int(digits) if len(digits) == 4 else 0


def _season_label(start_year: int) -> str:
    return f"{start_year}-{str((start_year + 1) % 100).zfill(2)}"


def _position_group(position: Optional[str]) -> str:
    pos = str(position or "").strip().upper()
    if pos == "D":
        return "D"
    if pos in {"G", "GOALIE", "GOALTENDER"}:
        return "G"
    return "F"


def _similarity_position_group(position: Optional[str]) -> str:
    return _position_group(position)


def _shots_from_history(player: Player, current_games: float) -> float:
    history = []
    try:
        parsed = json.loads(getattr(player, "season_history_json", None) or "[]")
        if isinstance(parsed, list):
            history = parsed
    except Exception:
        history = []

    current_row = next(
        (
            row
            for row in history
            if isinstance(row, dict) and str(row.get("season")) == str(CURRENT_SEASON)
        ),
        None,
    )

    if isinstance(current_row, dict):
        for key in ("shots", "shots_on_goal", "sog"):
            value = current_row.get(key)
            if value is not None:
                try:
                    numeric = float(value)
                    if numeric > 0:
                        return numeric
                except Exception:
                    pass

    # Keep this deterministic and cheap: approximate from available stored stats.
    goals = float(player.goals or 0)
    high_danger = float(player.high_danger_shots or 0)
    games = max(1.0, current_games)
    proxy = max(goals * 9.0, high_danger * 1.6, games * 1.8)
    return float(proxy)


def _games_for_risk(player: Player) -> float:
    current_games = float(player.games_played or 0)
    cur_start = _season_start(CURRENT_SEASON)
    if cur_start <= 0:
        return current_games

    history = []
    try:
        parsed = json.loads(getattr(player, "season_history_json", None) or "[]")
        if isinstance(parsed, list):
            history = parsed
    except Exception:
        history = []

    if CURRENT_SEASON == "2026-27":
        bootstrap = next((r for r in history if isinstance(r, dict) and r.get("season") == "2025-26"), None)
        if isinstance(bootstrap, dict):
            return float(bootstrap.get("games_played") or 0)
        return current_games

    previous_label = _season_label(cur_start - 1)
    previous = next((r for r in history if isinstance(r, dict) and r.get("season") == previous_label), None)
    if isinstance(previous, dict):
        return float(previous.get("games_played") or 0)
    return current_games


def _player_row(player: Player) -> Dict:
    games = float(player.games_played or 0)
    shots = _shots_from_history(player, games)
    ppg = (float(player.points or 0) / games) if games > 0 else 0.0

    return {
        "player_id": int(player.id),
        "player_name": player.player_name,
        "team": player.team,
        "position": _position_group(player.position),
        "similarity_position": _similarity_position_group(player.position),
        "raw_position": player.position,
        "headshot_url": player.headshot_url,
        "goals": float(player.goals or 0),
        "assists": float(player.assists or 0),
        "points": float(player.points or 0),
        "games_played": games,
        "xg_all_situations": float(player.xg_all_situations or 0),
        "shots": float(shots or 0),
        "points_per_game": float(ppg),
        "hits": float(player.hits or 0),
        "giveaways": float(player.giveaways or 0),
        "takeaways": float(player.takeaways or 0),
        "onice_corsi_pct": float(player.onice_corsi_pct or 0),
        "onice_fenwick_pct": float(player.onice_fenwick_pct or 0),
        "onice_xgoals_pct": float(player.onice_xgoals_pct or 0),
        "aav": float(player.aav or 0),
        "market_value": float(player.market_value or 0),
        "age": 27.0,
        "risk_games_played": float(_games_for_risk(player)),
    }


def _team_logo_url(team_name: Optional[str]) -> Optional[str]:
    if not team_name:
        return None
    tri = TEAM_NAME_TO_TRICODE_SIMPLE.get(team_name)
    if tri:
        return f"https://assets.nhle.com/logos/nhl/svg/{tri}_light.svg"
    return None


def _safe_numeric(value: object) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _signal_multiplier(key: str, a: Dict, b: Dict) -> float:
    floor = SIMILARITY_SIGNAL_FLOORS.get(key)
    if not floor or floor <= 0:
        return 1.0
    strongest_value = max(abs(_safe_numeric(a.get(key))), abs(_safe_numeric(b.get(key))))
    return float(max(0.05, min(1.0, strongest_value / floor)))


def _effective_weight(key: str, a: Dict, b: Dict, weights: Dict[str, float]) -> float:
    return _safe_numeric(weights.get(key)) * _signal_multiplier(key, a, b)


def _extract_model_weights(model: object, position_group: str) -> Dict[str, float]:
    model_keys = [model_key for _, model_key in SIMILARITY_FEATURE_MAP]
    row_keys = [row_key for row_key, _ in SIMILARITY_FEATURE_MAP]
    raw_weights = np.zeros(len(model_keys), dtype=float)

    try:
        names = list(getattr(model, "feature_names_in_", []))
        importances = np.asarray(getattr(model, "feature_importances_", []), dtype=float)
        if names and importances.size == len(names):
            by_name = {str(name): abs(float(weight)) for name, weight in zip(names, importances)}
            raw_weights = np.array([by_name.get(key, 0.0) for key in model_keys], dtype=float)
    except Exception:
        raw_weights = np.zeros(len(model_keys), dtype=float)

    if raw_weights.sum() <= 0:
        raw_weights = np.ones(len(model_keys), dtype=float)

    # Temper sharply dominant tree importances so one feature, like early-season
    # goal totals, does not overwhelm the entire similarity profile while still
    # preserving the model's ranking of what matters more.
    tempered = np.sqrt(raw_weights)
    normalized = tempered / tempered.sum()
    uniform = np.full(len(model_keys), 1.0 / len(model_keys), dtype=float)
    normalized = ((1.0 - WEIGHT_UNIFORM_BLEND) * normalized) + (WEIGHT_UNIFORM_BLEND * uniform)
    return {row_key: float(weight) for row_key, weight in zip(row_keys, normalized)}


@lru_cache(maxsize=2)
def _position_weights(position_group: str) -> Dict[str, float]:
    model_map = get_models()
    model = model_map["def"] if position_group == "D" else model_map["fwd"]
    return _extract_model_weights(model, position_group)


def _feature_norms(group_rows: List[Dict]) -> tuple[pd.Series, pd.Series]:
    frame = pd.DataFrame(
        [{key: _safe_numeric(row.get(key)) for key in SIMILARITY_STATS} for row in group_rows]
    )
    centers = frame.median(axis=0)
    q1 = frame.quantile(0.25)
    q3 = frame.quantile(0.75)
    scales = ((q3 - q1) / 1.349).replace(0, np.nan)
    fallback_scales = frame.std(axis=0, ddof=0).replace(0, np.nan)
    scales = scales.fillna(fallback_scales).fillna(1)
    return centers, scales


def _weighted_distance(a: Dict, b: Dict, means: pd.Series, stds: pd.Series, weights: Dict[str, float]) -> float:
    total = 0.0
    for key in SIMILARITY_STATS:
        a_z = (_safe_numeric(a.get(key)) - _safe_numeric(means.get(key))) / _safe_numeric(stds.get(key) or 1)
        b_z = (_safe_numeric(b.get(key)) - _safe_numeric(means.get(key))) / _safe_numeric(stds.get(key) or 1)
        delta = max(-3.0, min(3.0, a_z - b_z))
        total += _effective_weight(key, a, b, weights) * (delta * delta)
    return float(np.sqrt(total))


def _score_from_distance(distance: float, max_distance: float) -> float:
    if max_distance <= 0:
        return 50.0
    centered = distance / max_distance
    score = 100.0 / (1.0 + np.exp(centered))
    return float(max(0.0, min(100.0, score)))


def _score_from_distribution(distance: float, all_distances: List[float]) -> float:
    if not all_distances:
        return 50.0

    distances = np.asarray(all_distances, dtype=float)
    bandwidth = float(np.percentile(distances, 25))
    if not np.isfinite(bandwidth) or bandwidth <= 0:
        bandwidth = float(np.median(distances)) if len(distances) else 1.0
    if not np.isfinite(bandwidth) or bandwidth <= 0:
        bandwidth = 1.0

    # Heavy-tailed kernel similarity with a lower-quartile neighborhood scale.
    # A comp around the target's close-neighbor threshold lands near 50, which
    # creates more separation among the best matches than using the full-pool median.
    ratio = float(distance) / bandwidth
    score = 100.0 / (1.0 + (ratio * ratio))
    return float(max(0.0, min(100.0, score)))


def _informative_stat_count(a: Dict, b: Dict) -> int:
    return sum(1 for key in SIMILARITY_STATS if _stat_has_signal(key, a, b))


def _coverage_adjusted_score(raw_score: float, informative_count: int) -> float:
    if informative_count <= 2:
        return 50.0 + ((raw_score - 50.0) * 0.45)
    if informative_count <= 4:
        return 50.0 + ((raw_score - 50.0) * 0.7)
    if informative_count <= 6:
        return 50.0 + ((raw_score - 50.0) * 0.85)
    return raw_score


def _similarity_reasons(a: Dict, b: Dict, means: pd.Series, stds: pd.Series, weights: Dict[str, float]) -> List[str]:
    ranked = []
    for key in SIMILARITY_STATS:
        std = _safe_numeric(stds.get(key) or 1)
        if std <= 0:
            std = 1.0
        delta = abs(_safe_numeric(a.get(key)) - _safe_numeric(b.get(key))) / std
        weight = _effective_weight(key, a, b, weights)
        closeness = weight / (1.0 + delta)
        ranked.append((closeness, weight, key))

    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    labels = []
    for _, _, key in ranked:
        label = SIMILARITY_LABELS.get(key)
        if label and label not in labels:
            labels.append(label)
        if len(labels) == 3:
            break
    return labels


def _stat_has_signal(key: str, a: Dict, b: Dict) -> bool:
    a_value = _safe_numeric(a.get(key))
    b_value = _safe_numeric(b.get(key))
    if a_value == 0 and b_value == 0:
        return False

    floor = SIMILARITY_SIGNAL_FLOORS.get(key)
    if floor and floor > 0:
        return max(abs(a_value), abs(b_value)) >= (floor * 0.5)

    return True


def _top_similarity_details(a: Dict, b: Dict, means: pd.Series, stds: pd.Series, weights: Dict[str, float]) -> List[Dict[str, str]]:
    ranked = []
    for key in SIMILARITY_STATS:
        std = _safe_numeric(stds.get(key) or 1)
        if std <= 0:
            std = 1.0
        delta = abs(_safe_numeric(a.get(key)) - _safe_numeric(b.get(key))) / std
        weight = _effective_weight(key, a, b, weights)
        closeness = weight / (1.0 + delta)
        ranked.append((closeness, weight, key, _stat_has_signal(key, a, b)))

    ranked.sort(key=lambda item: (item[3], item[0], item[1]), reverse=True)
    details: List[Dict[str, str]] = []
    for _, _, key, has_signal in ranked:
        if not has_signal:
            continue
        label = SIMILARITY_LABELS.get(key)
        formatter = SIMILARITY_FORMATTERS.get(key, lambda value: str(value))
        if not label:
            continue
        details.append(
            {
                "label": label,
                "target_value": formatter(b.get(key)),
                "comp_value": formatter(a.get(key)),
            }
        )
        if len(details) == 3:
            break

    if details:
        return details

    for _, _, key, _ in ranked:
        label = SIMILARITY_LABELS.get(key)
        formatter = SIMILARITY_FORMATTERS.get(key, lambda value: str(value))
        if not label:
            continue
        details.append(
            {
                "label": label,
                "target_value": formatter(b.get(key)),
                "comp_value": formatter(a.get(key)),
            }
        )
        if len(details) == 2:
            break
    return details


def _difference_driver(a: Dict, b: Dict, means: pd.Series, stds: pd.Series, weights: Dict[str, float]) -> Optional[str]:
    ranked = []
    for key in SIMILARITY_STATS:
        std = _safe_numeric(stds.get(key) or 1)
        if std <= 0:
            std = 1.0
        delta = abs(_safe_numeric(a.get(key)) - _safe_numeric(b.get(key))) / std
        weight = _effective_weight(key, a, b, weights)
        impact = weight * delta
        ranked.append((impact, key))

    ranked.sort(key=lambda item: item[0], reverse=True)
    if not ranked:
        return None
    return SIMILARITY_LABELS.get(ranked[0][1])


def _difference_detail(a: Dict, b: Dict, means: pd.Series, stds: pd.Series, weights: Dict[str, float]) -> Optional[Dict[str, str]]:
    ranked = []
    for key in SIMILARITY_STATS:
        std = _safe_numeric(stds.get(key) or 1)
        if std <= 0:
            std = 1.0
        delta = abs(_safe_numeric(a.get(key)) - _safe_numeric(b.get(key))) / std
        weight = _effective_weight(key, a, b, weights)
        impact = weight * delta
        ranked.append((impact, key, _stat_has_signal(key, a, b)))

    ranked.sort(key=lambda item: (item[2], item[0]), reverse=True)
    if not ranked:
        return None

    key = None
    for impact, candidate_key, has_signal in ranked:
        if has_signal and impact > 0:
            key = candidate_key
            break
    if key is None:
        return None

    label = SIMILARITY_LABELS.get(key)
    formatter = SIMILARITY_FORMATTERS.get(key, lambda value: str(value))
    if not label:
        return None
    return {
        "label": label,
        "target_value": formatter(b.get(key)),
        "comp_value": formatter(a.get(key)),
    }


def _score_band(match_score: float) -> str:
    if match_score >= 80:
        return "Very close overall fit"
    if match_score >= 60:
        return "Good overall fit"
    if match_score >= 45:
        return "Moderate fit"
    return "Looser fit"


def _similarity_summary(match_score: float, reason_details: List[Dict[str, str]], gap_detail: Optional[Dict[str, str]]) -> str:
    if not reason_details:
        return f"{_score_band(match_score)} based on the weighted salary-model profile."

    informative_reasons = [
        row for row in reason_details if not (row["target_value"] == "0" and row["comp_value"] == "0") and not (row["target_value"] == "0.0%" and row["comp_value"] == "0.0%")
    ]
    if not informative_reasons:
        return f"{_score_band(match_score)} based on a limited tracked stat sample for both players."

    closest_parts = [
        f"{row['label']} ({row['target_value']} vs {row['comp_value']})"
        for row in informative_reasons
    ]
    if len(closest_parts) == 1:
        closest_text = closest_parts[0]
    elif len(closest_parts) == 2:
        closest_text = f"{closest_parts[0]} and {closest_parts[1]}"
    else:
        closest_text = f"{closest_parts[0]}, {closest_parts[1]}, and {closest_parts[2]}"

    if gap_detail and all(gap_detail["label"] != row["label"] for row in reason_details):
        return (
            f"{_score_band(match_score)}: closest in {closest_text}; biggest gap is {gap_detail['label']} "
            f"({gap_detail['target_value']} vs {gap_detail['comp_value']})."
        )

    return f"{_score_band(match_score)}: closest in {closest_text}."


def _top_similar_players(
    group_rows: List[Dict],
    target_row: Dict,
    position_group: str,
    n: int = 10,
) -> List[Dict]:
    candidates = [row for row in group_rows if int(row["player_id"]) != int(target_row["player_id"])]
    if not candidates:
        return []

    means, stds = _feature_norms(group_rows)
    weights = _position_weights(position_group)

    ranked = []
    for row in candidates:
        dist = _weighted_distance(row, target_row, means, stds, weights)
        ranked.append((dist, row))

    ranked.sort(key=lambda item: (item[0], item[1].get("player_name", "")))
    top = ranked[:n]
    all_distances = [item[0] for item in ranked]

    out: List[Dict] = []
    for idx, (dist, row) in enumerate(top, start=1):
        raw_match_score = _score_from_distribution(dist, all_distances)
        informative_count = _informative_stat_count(row, target_row)
        match_score = round(_coverage_adjusted_score(raw_match_score, informative_count), 1)
        reasons = _similarity_reasons(row, target_row, means, stds, weights)
        gap_driver = _difference_driver(row, target_row, means, stds, weights)
        reason_details = _top_similarity_details(row, target_row, means, stds, weights)
        gap_detail = _difference_detail(row, target_row, means, stds, weights)
        out.append(
            {
                "rank": idx,
                "id": int(row["player_id"]),
                "player_name": row["player_name"],
                "team": row["team"],
                "team_logo_url": _team_logo_url(row.get("team")),
                "headshot_url": row.get("headshot_url"),
                "aav": float(row.get("aav") or 0),
                "match_score": match_score,
                "similarity_reasons": reasons,
                "difference_driver": gap_driver,
                "similarity_summary": _similarity_summary(match_score, reason_details, gap_detail),
                "scoring_version": 10,
            }
        )
    return out


def _parse_json_list(raw: Optional[str]) -> List[Dict]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    return [row for row in parsed if isinstance(row, dict)]


def recompute_contract_research_comparables(db: Session, top_n: int = 10) -> Dict[str, int]:
    players = db.query(Player).filter(Player.active_roster.is_(True)).all()
    all_rows = [_player_row(p) for p in players if _position_group(p.position) in {"F", "D"}]

    rows_by_group: Dict[str, List[Dict]] = {"F": [], "D": []}
    for row in all_rows:
        similarity_position = row.get("similarity_position")
        if similarity_position in rows_by_group:
            rows_by_group[similarity_position].append(row)

    by_id = {int(p.id): p for p in players}
    updated = 0

    for group in ("F", "D"):
        group_rows = rows_by_group[group]
        if len(group_rows) < 2:
            continue

        for target in group_rows:
            player_obj = by_id.get(int(target["player_id"]))
            if player_obj is None:
                continue

            similars = _top_similar_players(group_rows, target, group, top_n)
            player_obj.contract_similarity_json = json.dumps(similars)
            db.add(player_obj)
            updated += 1

    db.commit()
    return {"updated": updated, "eligible": len(all_rows)}

    target_vec = ((df.iloc[-1][features] - means) / stds).to_numpy(dtype=float)
    dist_rows = []
    for _, row in df.iloc[:-1].iterrows():
        vec = ((row[features] - means) / stds).to_numpy(dtype=float)
        dist = float(np.linalg.norm(vec - target_vec))

        stat_diffs = []
        for stat in ["goals", "xg_all_situations", "assists", "shots", "takeaways", "giveaways", "hits"]:
            stat_diffs.append((stat, abs(float(row.get(stat, 0)) - float(target.get(stat, 0)))))
        stat_diffs.sort(key=lambda item: item[1])
        top_three = [name for name, _ in stat_diffs[:3]]

        formatted = []
        for stat in top_three:
            value = float(row.get(stat, 0))
            if stat == "goals":
                formatted.append(f"{int(round(value))} G")
            elif stat == "assists":
                formatted.append(f"{int(round(value))} A")
            elif stat == "xg_all_situations":
                formatted.append(f"{value:.2f} xG")
            elif stat == "shots":
                formatted.append(f"{int(round(value))} Shots")
            elif stat == "hits":
                formatted.append(f"{int(round(value))} Hits")
            elif stat == "takeaways":
                formatted.append(f"{int(round(value))} Takeaways")
            elif stat == "giveaways":
                formatted.append(f"{int(round(value))} Giveaways")

        dist_rows.append(
            {
                "distance": dist,
                "id": int(row["player_id"]),
                "player_name": row["player_name"],
                "team": row["team"],
                "team_logo_url": _team_logo_url(row.get("team")),
                "headshot_url": row.get("headshot_url"),
                "aav": float(row.get("aav") or 0),
                "similar_stats": formatted,
            }
        )

    dist_rows.sort(key=lambda item: item["distance"])
    return dist_rows[:n]


@router.get("/players")
def contract_research_players(db: Session = Depends(get_db)):
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
            "team_logo_url": _team_logo_url(p.team),
            "position": p.position,
            "aav": float(p.aav or 0),
            "headshot_url": p.headshot_url,
        }
        for p in players
        if _position_group(p.position) in {"F", "D"}
    ]


@router.get("/report/{player_id}")
def contract_research_report(player_id: int, db: Session = Depends(get_db)):
    target_player = db.query(Player).filter(Player.id == player_id, Player.active_roster.is_(True)).first()
    if not target_player:
        raise HTTPException(status_code=404, detail="Player not found")

    target_group = _position_group(target_player.position)
    target_similarity_group = _similarity_position_group(target_player.position)
    if target_group == "G":
        raise HTTPException(status_code=400, detail="Contract research currently supports forwards and defensemen")

    all_players = db.query(Player).filter(Player.active_roster.is_(True)).all()
    all_rows = [_player_row(p) for p in all_players if _position_group(p.position) in {"F", "D"}]

    target_row = next((row for row in all_rows if int(row["player_id"]) == int(player_id)), None)
    if target_row is None:
        raise HTTPException(status_code=404, detail="Target data not available")

    stored_similars = _parse_json_list(getattr(target_player, "contract_similarity_json", None))
    if not stored_similars or any(
        (not row.get("similarity_summary"))
        or (not row.get("similarity_reasons"))
        or (int(row.get("scoring_version") or 0) < 10)
        or ("The score reflects how close they are across the weighted salary-model stats after each stat is standardized." in str(row.get("similarity_summary") or ""))
        for row in stored_similars
    ):
        recompute_contract_research_comparables(db, top_n=10)
        db.refresh(target_player)
        stored_similars = _parse_json_list(getattr(target_player, "contract_similarity_json", None))

    if not stored_similars:
        target_group_rows = [row for row in all_rows if row.get("similarity_position") == target_similarity_group]
        stored_similars = _top_similar_players(target_group_rows, target_row, target_similarity_group, n=10)

    risk_input = pd.DataFrame(
        [
            {
                "playerId": int(row["player_id"]),
                "position": row["position"],
                "age": float(row["age"]),
                "games_played": float(row["risk_games_played"]),
                "goals": float(row["goals"]),
                "shots": float(row["shots"]),
                "aav": float(row["aav"]),
                "market_value": max(1.0, float(row["market_value"] or 0.0)),
            }
            for row in all_rows
        ]
    )

    scored = compute_risk_scores(risk_input)
    risk_row = scored.loc[scored["playerId"] == int(player_id)]
    risk_percentile = float(risk_row.iloc[0]["risk_percentile"]) if not risk_row.empty else 50.0

    response = {
        "player": {
            "id": int(target_row["player_id"]),
            "player_name": target_row["player_name"],
            "team": target_row["team"],
            "headshot_url": target_row["headshot_url"],
            "aav": float(target_row["aav"]),
            "position": target_row["raw_position"],
        },
        "risk_percentile": max(1.0, min(99.0, risk_percentile)),
        "key_stats": {
            "goals": float(target_row["goals"]),
            "assists": float(target_row["assists"]),
            "points": float(target_row["points"]),
            "xg_all_situations": float(target_row["xg_all_situations"]),
            "shots": float(target_row["shots"]),
            "points_per_game": float(target_row["points_per_game"]),
            "hits": float(target_row["hits"]),
            "giveaways": float(target_row["giveaways"]),
            "takeaways": float(target_row["takeaways"]),
        },
        "comparables": stored_similars[:10],
    }

    return response
