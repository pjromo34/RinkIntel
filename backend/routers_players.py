# backend/routers_players.py

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.database import SessionLocal
from backend.models import Player
from typing import List, Dict, Optional
import json
import urllib.request
from functools import lru_cache

from backend.config import CURRENT_SEASON, SALARY_CAP_BY_SEASON

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


def display_team_name(team_name: Optional[str]) -> Optional[str]:
    if not team_name:
        return team_name
    return TEAM_DISPLAY_OVERRIDES.get(team_name, team_name)


def parse_json_list(raw: Optional[str]) -> list:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except Exception:
        return []
    return value if isinstance(value, list) else []


def season_start(season_label: Optional[str]) -> int:
    import re
    match = re.search(r"(\d{4})", str(season_label or ""))
    return int(match.group(1)) if match else 0


def season_label_from_start(start_year: int) -> str:
    return f"{start_year}-{str((start_year + 1) % 100).zfill(2)}"


def is_goalie_position(position: Optional[str]) -> bool:
    pos = str(position or "").strip().upper()
    return pos in {"G", "GK", "GOALIE", "GOALTENDER"}


def optional_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except Exception:
        return None


@lru_cache(maxsize=2048)
def fetch_player_jersey_number(nhl_player_id: Optional[str]):
    if not nhl_player_id:
        return None

    url = f"https://api-web.nhle.com/v1/player/{nhl_player_id}/landing"
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
        with urllib.request.urlopen(req, timeout=10) as response:
            payload = json.load(response)
    except Exception:
        return None

    raw = payload.get("sweaterNumber")
    if raw is None:
        raw = payload.get("jerseyNumber")
    if raw is None:
        return None

    value = str(raw).strip()
    if not value:
        return None
    return value


def expand_contracts(contracts: list) -> Dict[str, float]:
    # For overlapping contract entries, prefer the contract with the latest
    # start season for a given target season.
    season_to_contract: Dict[str, Dict[str, float]] = {}
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
            season_key = season_label_from_start(start + i)
            existing = season_to_contract.get(season_key)
            if existing is None or start >= int(existing["start"]):
                season_to_contract[season_key] = {"start": float(start), "aav": aav}

    return {season: float(meta["aav"]) for season, meta in season_to_contract.items()}


def contracts_from_map(contract_map: Dict[str, float]) -> List[Dict]:
    if not contract_map:
        return []

    years = sorted(
        [season_start(season) for season in contract_map.keys() if season_start(season) > 0]
    )
    if not years:
        return []

    rows: List[Dict] = []
    start_year = years[0]
    prev_year = years[0]
    current_aav = float(contract_map.get(season_label_from_start(start_year), 0) or 0)

    for year in years[1:]:
        year_aav = float(contract_map.get(season_label_from_start(year), 0) or 0)
        if year == prev_year + 1 and year_aav == current_aav:
            prev_year = year
            continue

        rows.append(
            {
                "start_season": season_label_from_start(start_year),
                "years": prev_year - start_year + 1,
                "aav": current_aav,
            }
        )
        start_year = year
        prev_year = year
        current_aav = year_aav

    rows.append(
        {
            "start_season": season_label_from_start(start_year),
            "years": prev_year - start_year + 1,
            "aav": current_aav,
        }
    )
    return rows


def contracts_for_response(contracts: list, contract_map: Dict[str, float]) -> List[Dict]:
    if contracts:
        normalized = [row for row in contracts if isinstance(row, dict)]
        normalized.sort(key=lambda row: season_start(row.get("start_season") or row.get("season")))
        return normalized
    return contracts_from_map(contract_map)


def build_player_payload(p: Player) -> Dict:
    season_history = parse_json_list(getattr(p, "season_history_json", None))
    contracts = parse_json_list(getattr(p, "contracts_json", None))
    contract_map = expand_contracts(contracts)

    # Fallback for players edited with top-level contract fields but without
    # a populated contracts_json timeline.
    remaining_years = int(p.contract_years_remaining or 0)
    current_start = season_start(CURRENT_SEASON)
    explicit_start = season_start(p.contract_start_season)
    fallback_start = explicit_start if explicit_start >= current_start else current_start
    fallback_aav = float(p.aav or 0)

    if remaining_years > 0 and fallback_aav > 0:
        for i in range(remaining_years):
            season_key = season_label_from_start(fallback_start + i)
            contract_map.setdefault(season_key, fallback_aav)

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
    market_value = None if is_goalie_position(p.position) else optional_float((current_snapshot or {}).get("market_value"))
    if market_value is None and not is_goalie_position(p.position):
        market_value = optional_float(p.market_value)
    current_aav = float(contract_map.get(CURRENT_SEASON, p.aav or 0))
    primary_assists = float((current_snapshot or {}).get("primary_assists") or getattr(p, "primary_assists", 0) or 0)
    dzone_giveaways = float((current_snapshot or {}).get("dzone_giveaways") or getattr(p, "dzone_giveaways", 0) or 0)
    onice_fenwick_pct = float((current_snapshot or {}).get("onice_fenwick_pct") or getattr(p, "onice_fenwick_pct", 0) or 0)
    onice_corsi_pct = float((current_snapshot or {}).get("onice_corsi_pct") or getattr(p, "onice_corsi_pct", 0) or 0)
    onice_xgoals_pct = float((current_snapshot or {}).get("onice_xgoals_pct") or getattr(p, "onice_xgoals_pct", 0) or 0)

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
                "market_value": None if is_goalie_position(p.position) else optional_float(row.get("market_value")),
                "aav": float(contract_map.get(season, row.get("aav") or 0)),
            }
        )

    if CURRENT_SEASON not in seen:
        value_history.append({"season": CURRENT_SEASON, "market_value": market_value, "aav": current_aav})

    value_history.sort(key=lambda r: season_start(r.get("season")))

    historical_snapshots = []
    for row in season_history:
        if not isinstance(row, dict):
            continue
        row_season = row.get("season")
        if not row_season or row_season == CURRENT_SEASON:
            continue
        season_aav = float(contract_map.get(row_season, row.get("aav") or 0))
        row_market = None if is_goalie_position(p.position) else optional_float(row.get("market_value"))
        historical_snapshots.append(
            {
                "season": row_season,
                "team": row.get("team") or p.team,
                "goals": int(row.get("goals") or 0),
                "assists": int(row.get("assists") or 0),
                "points": int(row.get("points") or 0),
                "games_played": int(row.get("games_played") or 0),
                "xg_all_situations": float(row.get("xg_all_situations") or 0),
                "market_value": row_market,
                "aav": season_aav,
            }
        )
    historical_snapshots.sort(key=lambda r: season_start(r.get("season")), reverse=True)

    contract_years_remaining = int(p.contract_years_remaining or 0)
    if contracts:
        cur_start = season_start(CURRENT_SEASON)
        active_contracts = []
        for row in contracts:
            if not isinstance(row, dict):
                continue
            start = season_start(row.get("start_season") or row.get("season"))
            years = int(row.get("years") or row.get("length") or 0)
            if start and years and start <= cur_start <= (start + years - 1):
                active_contracts.append((start, years))

        if active_contracts:
            # Mirror expand_contracts precedence for overlapping deals.
            start, years = max(active_contracts, key=lambda item: item[0])
            contract_years_remaining = (start + years - 1) - cur_start + 1

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
        "primary_assists": primary_assists,
        "dzone_giveaways": dzone_giveaways,
        "onice_fenwick_pct": onice_fenwick_pct,
        "onice_corsi_pct": onice_corsi_pct,
        "onice_xgoals_pct": onice_xgoals_pct,
        "giveaways": giveaways,
        "market_value": market_value,
        "aav": current_aav,
        "contract_years_remaining": contract_years_remaining,
        "contract_start_season": p.contract_start_season,
        "contracts": contracts_for_response(contracts, contract_map),
        "value_history": value_history,
        "historical_snapshots": historical_snapshots,
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
    team: Optional[str] = Query(None),
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


@router.get("/meta")
def players_meta():
    return {
        "season": CURRENT_SEASON,
        "salary_cap": float(SALARY_CAP_BY_SEASON.get(CURRENT_SEASON) or 0),
    }

@router.get("/{player_id}")
def get_player(player_id: int, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    payload = build_player_payload(p)
    payload["number"] = fetch_player_jersey_number(str(p.nhl_player_id) if p.nhl_player_id else None)
    return payload

# ---------------------------------------------------------
# GET PLAYER BY NAME (public profile)
# ---------------------------------------------------------
@router.get("/by-name/{name}")
def get_player_by_name(name: str, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.player_name == name, Player.active_roster.is_(True)).first()

    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    payload = build_player_payload(p)
    payload["number"] = fetch_player_jersey_number(str(p.nhl_player_id) if p.nhl_player_id else None)
    return payload
