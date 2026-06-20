# backend/routers/players.py

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Player
from typing import List, Dict

# Map full team names to tri-code
TEAM_NAME_TO_TRICODE_SIMPLE = {
    "Anaheim Ducks": "ANA",
    "Arizona Coyotes": "ARI",
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
    "Vegas Golden Knights": "VEG",
    "Washington Capitals": "WSH",
    "Winnipeg Jets": "WPG",
}

# Display name overrides for non-standard or legacy names
TEAM_DISPLAY_OVERRIDES = {
    "Utah Hockey Club": "Utah Mammoth",
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
    query = db.query(Player)
    if team:
        query = query.filter(Player.team == team)

    players = query.all()

    return [
        {
            "id": p.id,
            "player_name": p.player_name,
            "name": p.player_name,
            "team": p.team,
            "position": p.position,
            "goals": p.goals,
            "assists": p.assists,
            "points": p.points,
            "market_value": p.market_value,
            "aav": p.aav,
            "xg_all_situations": p.xg_all_situations,
            "icetime": p.icetime,
            "headshot_url": p.headshot_url,
        }
        for p in players
    ]

# ---------------------------------------------------------
# GET PLAYER BY ID (used by PlayerEditor)
# ---------------------------------------------------------
@router.get("/teams")
def list_teams(db: Session = Depends(get_db)):
    """Return aggregated teams with tri-code and a best-effort logo URL."""
    # derive teams from players
    rows = db.query(Player.team).distinct().all()
    teams: List[Dict[str, str]] = []
    for (team_name,) in rows:
        if not team_name:
            continue
        # allow display name overrides
        display = TEAM_DISPLAY_OVERRIDES.get(team_name, team_name)
        tri = TEAM_NAME_TO_TRICODE_SIMPLE.get(display) or TEAM_NAME_TO_TRICODE_SIMPLE.get(team_name)
        # best-effort logo URL pattern (NHL static CDN) when tri-code available
        logo = None
        if tri:
            logo = f"https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/{tri}.svg"
        else:
            # fallback: point to a static path using a slug of the display name (file may not exist)
            slug = display.lower().replace(' ', '-')
            logo = f"/static/team_logos/{slug}.png"

        teams.append({"team": team_name, "display_name": display, "tri_code": tri, "logo_url": logo})

    return teams

@router.get("/{player_id}")
def get_player(player_id: int, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    return {
        "id": p.id,
        "player_name": p.player_name,
        "name": p.player_name,
        "team": p.team,
        "position": p.position,
        "goals": p.goals,
        "assists": p.assists,
        "points": p.points,
        "xg_all_situations": p.xg_all_situations,
        "icetime": p.icetime,
        "market_value": p.market_value,
        "aav": p.aav,
        "headshot_url": p.headshot_url,
    }

# ---------------------------------------------------------
# GET PLAYER BY NAME (public profile)
# ---------------------------------------------------------
@router.get("/by-name/{name}")
def get_player_by_name(name: str, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.player_name == name).first()

    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    return {
        "id": p.id,
        "player_name": p.player_name,
        "name": p.player_name,
        "team": p.team,
        "position": p.position,
        "goals": p.goals,
        "assists": p.assists,
        "points": p.points,
        "xg_all_situations": p.xg_all_situations,
        "icetime": p.icetime,
        "market_value": p.market_value,
        "aav": p.aav,
        "headshot_url": p.headshot_url,
    }


@router.get("/teams")
def list_teams(db: Session = Depends(get_db)):
    """Return aggregated teams with tri-code and a best-effort logo URL."""
    # derive teams from players
    rows = db.query(Player.team).distinct().all()
    teams: List[Dict[str, str]] = []
    for (team_name,) in rows:
        if not team_name:
            continue
        # allow display name overrides
        display = TEAM_DISPLAY_OVERRIDES.get(team_name, team_name)
        tri = TEAM_NAME_TO_TRICODE_SIMPLE.get(display) or TEAM_NAME_TO_TRICODE_SIMPLE.get(team_name)
        # best-effort logo URL pattern (NHL static CDN) when tri-code available
        logo = None
        if tri:
            logo = f"https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/{tri}.svg"
        else:
            # fallback: point to a static path using a slug of the display name (file may not exist)
            slug = display.lower().replace(' ', '-')
            logo = f"/static/team_logos/{slug}.png"

        teams.append({"team": team_name, "display_name": display, "tri_code": tri, "logo_url": logo})

    return teams
