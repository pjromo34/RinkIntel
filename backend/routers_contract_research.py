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
from backend.models import Player
from backend.routers_players import TEAM_NAME_TO_TRICODE_SIMPLE

RISK_DIR = Path(__file__).resolve().parent.parent / "riskscore"
if str(RISK_DIR) not in sys.path:
    sys.path.insert(0, str(RISK_DIR))

from risk_score import compute_risk_scores  # type: ignore

router = APIRouter(prefix="/contract-research", tags=["contract-research"])


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


def _stat_comparables(candidates: List[Dict], target: Dict, stat: str, n: int = 3) -> List[Dict]:
    ranked = sorted(
        candidates,
        key=lambda row: (
            abs(float(row.get(stat, 0)) - float(target.get(stat, 0))),
            abs(float(row.get("aav", 0)) - float(target.get("aav", 0))),
            row.get("player_name", ""),
        ),
    )
    out = []
    for row in ranked[:n]:
        out.append(
            {
                "id": int(row["player_id"]),
                "player_name": row["player_name"],
                "team": row["team"],
                "team_logo_url": _team_logo_url(row.get("team")),
                "headshot_url": row["headshot_url"],
                "aav": float(row.get("aav") or 0),
                "value": float(row.get(stat) or 0),
            }
        )
    return out


def _overall_similars(candidates: List[Dict], target: Dict, n: int = 5) -> List[Dict]:
    if not candidates:
        return []

    features = [
        "goals",
        "assists",
        "points",
        "xg_all_situations",
        "shots",
        "points_per_game",
        "hits",
        "giveaways",
        "takeaways",
        "onice_corsi_pct",
        "onice_fenwick_pct",
        "onice_xgoals_pct",
    ]

    df = pd.DataFrame(candidates + [target])
    means = df[features].mean(axis=0)
    stds = df[features].std(axis=0, ddof=0).replace(0, 1)

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
    if target_group == "G":
        raise HTTPException(status_code=400, detail="Contract research currently supports forwards and defensemen")

    all_players = db.query(Player).filter(Player.active_roster.is_(True)).all()
    all_rows = [_player_row(p) for p in all_players if _position_group(p.position) in {"F", "D"}]

    target_row = next((row for row in all_rows if int(row["player_id"]) == int(player_id)), None)
    if target_row is None:
        raise HTTPException(status_code=404, detail="Target data not available")

    candidate_rows = [
        row
        for row in all_rows
        if int(row["player_id"]) != int(player_id)
        and row["position"] == target_group
    ]

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
        "stat_comparables": {
            "goals": _stat_comparables(candidate_rows, target_row, "goals", 3),
            "assists": _stat_comparables(candidate_rows, target_row, "assists", 3),
            "points": _stat_comparables(candidate_rows, target_row, "points", 3),
            "xg_all_situations": _stat_comparables(candidate_rows, target_row, "xg_all_situations", 3),
            "shots": _stat_comparables(candidate_rows, target_row, "shots", 3),
            "hits": _stat_comparables(candidate_rows, target_row, "hits", 3),
        },
        "overall_similars": _overall_similars(candidate_rows, target_row, 5),
    }

    return response
