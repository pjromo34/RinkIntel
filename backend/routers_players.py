# backend/routers/players.py

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.database import SessionLocal
from backend.models import Player
from typing import List, Dict
import json

from backend.config import CURRENT_SEASON

# Map full team names to tri-code
TEAM_NAME_TO_TRICODE_SIMPLE = {
    "Anaheim Ducks": "ANA",
    "Arizona Coyotes": "ARI",
    "Utah Hockey Club": "UTA",
    "Utah Mammoth": "UTA",
    "Boston Bruins": "BOS",
    "Buffalo Sabres": "BUF",
    "Calgary Flames": "CGY",
    "Carolina Hurricanes": "CAR",
    "Chicago Blackhawks": "CHI",
    "Colorado Avalanche": "COL",
    "Columbus Blue Jackets": "CBJ",
    "Dallas Stars": "DAL",
    "Detroit Red Wings": "DET",
    "Edmonton Oilers": "EDM",
    "Florida Panthers": "FLA",
    "Los Angeles Kings": "LAK",
    "Minnesota Wild": "MIN",
    "Montreal Canadiens": "MTL",
    "Nashville Predators": "NSH",
    "New Jersey Devils": "NJD",
    "New York Islanders": "NYI",
    "New York Rangers": "NYR",
    "Ottawa Senators": "OTT",
    "Philadelphia Flyers": "PHI",
    "Pittsburgh Penguins": "PIT",
    "San Jose Sharks": "SJS",
    "Seattle Kraken": "SEA",
    "St. Louis Blues": "STL",
    "Tampa Bay Lightning": "TBL",
    "Toronto Maple Leafs": "TOR",
    "Vancouver Canucks": "VAN",
    "Vegas Golden Knights": "VGK",
    "Washington Capitals": "WSH",
    "Winnipeg Jets": "WPG",
}

# Display name overrides for non-standard or legacy names
TEAM_DISPLAY_OVERRIDES = {
    "Utah Hockey Club": "Utah Mammoth",
}


def display_team_name(team_name: str | None) -> str | None:
    if not team_name:
        return team_name
    return TEAM_DISPLAY_OVERRIDES.get(team_name, team_name)


def parse_json_list(raw: str | None) -> list:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except Exception:
        return []
    return value if isinstance(value, list) else []


def season_start(season_label: str | None) -> int:
    import re
    match = re.search(r"(\d{4})", str(season_label or ""))
    return int(match.group(1)) if match else 0


def season_label_from_start(start_year: int) -> str:
    return f"{start_year}-{str((start_year + 1) % 100).zfill(2)}"


def expand_contracts(contracts: list) -> Dict[str, float]:
    season_to_aav: Dict[str, float] = {}
    for row in contracts:
        if not isinstance(row, dict):
            continue
        start = season_start(row.get("start_season") or row.get("season"))
        years = int(row.get("years") or row.get("length") or 0)
        try:
            aav = float(row.get("aav") or row.get("value") or 0)
        except Exception:
            aav = 0.0
        if start <= 0 or years <= 0:
            continue
        for i in range(years):
            season_to_aav[season_label_from_start(start + i)] = aav
    return season_to_aav


def build_player_payload(p: Player) -> Dict:
    season_history = parse_json_list(getattr(p, "season_history_json", None))
    contracts = parse_json_list(getattr(p, "contracts_json", None))
    contract_map = expand_contracts(contracts)

    current_snapshot = None
    for row in season_history:
        if isinstance(row, dict) and row.get("season") == CURRENT_SEASON:
            current_snapshot = row
            break

    goals = int((current_snapshot or {}).get("goals") or p.goals or 0)
    assists = int((current_snapshot or {}).get("assists") or p.assists or 0)
    points = int((current_snapshot or {}).get("points") or p.points or 0)
    games_played = int((current_snapshot or {}).get("games_played") or p.games_played or 0)
    xg = float((current_snapshot or {}).get("xg_all_situations") or p.xg_all_situations or 0)
    icetime = float((current_snapshot or {}).get("icetime") or p.icetime or 0)
    high_danger_shots = float((current_snapshot or {}).get("high_danger_shots") or getattr(p, "high_danger_shots", 0) or 0)
    blocked_shots = float((current_snapshot or {}).get("blocked_shots") or getattr(p, "blocked_shots", 0) or 0)
    hits = float((current_snapshot or {}).get("hits") or getattr(p, "hits", 0) or 0)
    takeaways = float((current_snapshot or {}).get("takeaways") or getattr(p, "takeaways", 0) or 0)
    giveaways = float((current_snapshot or {}).get("giveaways") or getattr(p, "giveaways", 0) or 0)
    market_value = float((current_snapshot or {}).get("market_value") or p.market_value or 0)
    current_aav = float(contract_map.get(CURRENT_SEASON, p.aav or 0))

    value_history = []
    seen = set()
    for row in season_history:
        if not isinstance(row, dict):
            continue
        season = row.get("season")
        if not season:
            continue
        seen.add(season)
        value_history.append(
            {
                "season": season,
                "market_value": float(row.get("market_value") or 0),
                "aav": float(contract_map.get(season, row.get("aav") or 0)),
            }
        )

    if CURRENT_SEASON not in seen:
        value_history.append({"season": CURRENT_SEASON, "market_value": market_value, "aav": current_aav})

    value_history.sort(key=lambda r: season_start(r.get("season")))

    contract_years_remaining = int(p.contract_years_remaining or 0)
    if contracts:
        cur_start = season_start(CURRENT_SEASON)
        for row in contracts:
            if not isinstance(row, dict):
                continue
            start = season_start(row.get("start_season") or row.get("season"))
            years = int(row.get("years") or 0)
            if start and years and start <= cur_start <= (start + years - 1):
                contract_years_remaining = (start + years - 1) - cur_start + 1
                break

    return {
        "id": p.id,
        "player_name": p.player_name,
        "name": p.player_name,
        "season": CURRENT_SEASON,
        "team": display_team_name(p.team),
        "position": p.position,
        "goals": goals,
        "assists": assists,
        "points": points,
        "games_played": games_played,
        "xg_all_situations": xg,
        "icetime": icetime,
        "high_danger_shots": high_danger_shots,
        "blocked_shots": blocked_shots,
        "hits": hits,
        "takeaways": takeaways,
        "giveaways": giveaways,
        "market_value": market_value,
        "aav": current_aav,
        "contract_years_remaining": contract_years_remaining,
        "contract_start_season": p.contract_start_season,
        "contracts": contracts,
        "value_history": value_history,
        "headshot_url": p.headshot_url,
    }

router = APIRouter(prefix="/players", tags=["players"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------
# LIST PLAYERS
# ---------------------------------------------------------
@router.get("")
@router.get("/")
def list_players(
    team: str | None = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Player).filter(Player.active_roster.is_(True))
    if team:
        # Support both legacy and current Utah naming while filtering.
        if team == "Utah Mammoth":
            query = query.filter(or_(Player.team == "Utah Mammoth", Player.team == "Utah Hockey Club"))
        else:
            query = query.filter(Player.team == team)

    players = query.all()

    return [build_player_payload(p) for p in players]

# ---------------------------------------------------------
# GET PLAYER BY ID (used by PlayerEditor)
# ---------------------------------------------------------
@router.get("/teams")
def list_teams(db: Session = Depends(get_db)):
    """Return aggregated teams with tri-code and a best-effort logo URL."""
    # derive teams from players
    rows = db.query(Player.team).distinct().all()
    rows = db.query(Player.team).filter(Player.active_roster.is_(True)).distinct().all()
    teams: List[Dict[str, str]] = []
    for (team_name,) in rows:
        if not team_name:
            continue
        # allow display name overrides
        display = TEAM_DISPLAY_OVERRIDES.get(team_name, team_name)
        tri = TEAM_NAME_TO_TRICODE_SIMPLE.get(display) or TEAM_NAME_TO_TRICODE_SIMPLE.get(team_name)
        # best-effort logo URL pattern (NHL assets CDN) when tri-code available
        logo = None
        if tri:
            logo = f"https://assets.nhle.com/logos/nhl/svg/{tri}_light.svg"
        else:
            # fallback: point to a static path using a slug of the display name (file may not exist)
            slug = display.lower().replace(' ', '-')
            logo = f"/static/team_logos/{slug}.png"

        teams.append({"team": display, "display_name": display, "tri_code": tri, "logo_url": logo})

    return teams

@router.get("/{player_id}")
def get_player(player_id: int, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    return build_player_payload(p)

# ---------------------------------------------------------
# GET PLAYER BY NAME (public profile)
# ---------------------------------------------------------
@router.get("/by-name/{name}")
def get_player_by_name(name: str, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.player_name == name, Player.active_roster.is_(True)).first()

    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    return build_player_payload(p)
