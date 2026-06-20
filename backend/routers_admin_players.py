# backend/routers_admin_players.py

import os
import json
import time
import unicodedata
import urllib.request
import urllib.parse
import urllib.error
from datetime import date
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

load_dotenv()
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Dict, Any
from pathlib import Path

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

def make_static_url(path: str) -> str:
    if not path:
        return path
    if path.startswith("/static/"):
        return BACKEND_URL.rstrip("/") + path
    return path

from backend.database import SessionLocal
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/admin/players", tags=["admin-players"])

HEADSHOT_DIR = Path("static/headshots")
HEADSHOT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_salary_from_rapidapi(player_name: str, team: str | None = None, position: str | None = None, league: str = "NHL"):
    host = os.getenv("RAPIDAPI_HOST", "nhl-stats-and-salary.p.rapidapi.com")
    key = os.getenv("RAPIDAPI_KEY")
    if not key or key.startswith("replace_with"):
        raise HTTPException(status_code=500, detail="RapidAPI key is not configured")

    params = {
        "PlayerName": player_name,
        "League": league,
    }
    if team:
        params["Team"] = team
    if position:
        params["Position"] = position

    url = f"https://{host}/NHLAHLStatsAndSalaryInfo/PlayersWithFilter?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        url,
        headers={
            "Content-Type": "application/json",
            "x-rapidapi-host": host,
            "x-rapidapi-key": key,
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=e.code or 502, detail=f"RapidAPI request failed: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


def normalize_text(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return normalized.lower().strip()

TEAM_NAME_TO_TRICODE = {
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


def fetch_nhl_player_search() -> Any:
    url = "https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=50000&q=*"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Referer": "https://www.nhl.com/",
            "Origin": "https://www.nhl.com",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=e.code or 502, detail=f"NHL player search request failed: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


def _compute_headshot_season() -> str:
    # Allow override via env var for manual control
    env = os.getenv("HEADSHOT_SEASON")
    if env:
        return env

    # Compute season string like 20252026 using today's date.
    today = date.today()
    # If month is July (7) or later, use current year as season start; else previous year.
    if today.month >= 7:
        start = today.year
    else:
        start = today.year - 1
    return f"{start}{start+1}"


def build_headshot_url(player_id: str, team_abbrev: str) -> str:
    if not player_id or not team_abbrev:
        return ""
    season = _compute_headshot_season()
    return f"https://assets.nhle.com/mugs/nhl/{season}/{team_abbrev}/{player_id}.png"


def fetch_team_roster(team_code: str) -> Any:
    url = f"https://api-web.nhle.com/v1/roster/{urllib.parse.quote(team_code)}/current"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Referer": "https://www.nhl.com/",
            "Origin": "https://www.nhl.com",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
            # Normalize different possible payload shapes
            if isinstance(data, dict):
                # common shapes: {'roster': [...]}, {'players': [...]}
                if "roster" in data and isinstance(data["roster"], list):
                    return data["roster"]
                if "players" in data and isinstance(data["players"], list):
                    return data["players"]
                # some endpoints return list directly under 'data' or other keys
                for v in data.values():
                    if isinstance(v, list):
                        return v
            if isinstance(data, list):
                return data
            return []
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=e.code or 502, detail=f"Roster request failed for {team_code}: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


def extract_salary_from_rapidapi(data: Any):
    def find_salary(item: Any):
        if isinstance(item, dict):
            for key, value in item.items():
                lower = key.lower()
                if lower in {"aav", "caphit", "cap_hit", "salary", "player_salary", "cap", "cap hit"}:
                    try:
                        return float(value), item
                    except (TypeError, ValueError):
                        pass
                if isinstance(value, (dict, list)):
                    found = find_salary(value)
                    if found is not None:
                        return found
        elif isinstance(item, list):
            for value in item:
                found = find_salary(value)
                if found is not None:
                    return found
        return None

    if isinstance(data, (dict, list)):
        found = find_salary(data)
        if found is not None:
            return found

    return None, None


def admin_required(user=Depends(get_current_user)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------
# CREATE PLAYER
# ---------------------------------------------------------
@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_player(payload: Dict[str, Any], user=Depends(admin_required), db: Session = Depends(get_db)):
    try:
        payload.pop("market_value", None)
        p = models.Player(**payload)
        db.add(p)
        db.commit()
        db.refresh(p)
        return {"id": p.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------
# UPDATE PLAYER (PATCH)
# ---------------------------------------------------------
@router.patch("/{player_id}")
@router.patch("/{player_id}/")
def update_player(player_id: int, payload: Dict[str, Any], user=Depends(admin_required), db: Session = Depends(get_db)):
    p = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    payload.pop("market_value", None)

    for k, v in payload.items():
        if hasattr(p, k):
            setattr(p, k, v)

    try:
        db.add(p)
        db.commit()
        db.refresh(p)
        return {"id": p.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------
# DELETE PLAYER
# ---------------------------------------------------------
@router.delete("/{player_id}", status_code=204)
@router.delete("/{player_id}/", status_code=204)
def delete_player(player_id: int, user=Depends(admin_required), db: Session = Depends(get_db)):
    p = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    try:
        db.delete(p)
        db.commit()
        return JSONResponse(status_code=204, content=None)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------
# HEADSHOT UPLOAD
# ---------------------------------------------------------
@router.post("/{player_id}/headshot")
@router.post("/{player_id}/headshot/")
def upload_headshot(player_id: int, file: UploadFile = File(...), user=Depends(admin_required), db: Session = Depends(get_db)):
    p = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    filename = f"{player_id}_{os.path.basename(file.filename)}"
    dest = HEADSHOT_DIR / filename

    with dest.open("wb") as f:
        f.write(file.file.read())

    p.uploaded_headshot_url = make_static_url(f"/static/headshots/{filename}")
    db.add(p)
    db.commit()
    db.refresh(p)

    return {"uploaded_headshot_url": p.uploaded_headshot_url}


@router.get("/{player_id}/salary")
@router.get("/{player_id}/salary/")
def get_player_salary(player_id: int, user=Depends(admin_required), db: Session = Depends(get_db)):
    p = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    api_data = fetch_salary_from_rapidapi(p.player_name, p.team, p.position)
    salary, matched = extract_salary_from_rapidapi(api_data)

    if salary is None:
        raise HTTPException(status_code=404, detail="Salary data not found from RapidAPI")

    return {
        "id": p.id,
        "aav": salary,
        "matched_player": matched,
        "rapidapi_raw": api_data,
    }


@router.post("/{player_id}/sync-salary")
@router.post("/{player_id}/sync-salary/")
def sync_player_salary(player_id: int, user=Depends(admin_required), db: Session = Depends(get_db)):
    p = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    api_data = fetch_salary_from_rapidapi(p.player_name, p.team, p.position)
    salary, matched = extract_salary_from_rapidapi(api_data)

    if salary is None:
        raise HTTPException(status_code=404, detail="Salary data not found from RapidAPI")

    p.aav = salary
    db.add(p)
    db.commit()
    db.refresh(p)

    return {
        "id": p.id,
        "aav": p.aav,
        "matched_player": matched,
        "rapidapi_raw": api_data,
    }


@router.post("/import-salaries")
@router.post("/import-salaries/")
def import_player_salaries(
    batch_size: int = 25,
    only_missing: bool = True,
    user=Depends(admin_required),
    db: Session = Depends(get_db),
):
    if batch_size < 1 or batch_size > 25:
        raise HTTPException(status_code=400, detail="batch_size must be between 1 and 25")

    query = db.query(models.Player)
    if only_missing:
        players = query.filter((models.Player.aav == 0) | (models.Player.aav.is_(None))).all()
    else:
        players = query.all()

    if not players:
        return {
            "processed": 0,
            "updated": 0,
            "failed": 0,
            "skipped": 0,
            "remaining": 0,
            "batch_size": batch_size,
        }

    players_to_sync = players[:batch_size]
    results = {"processed": 0, "updated": 0, "failed": 0, "skipped": 0}
    rate_delay = 60.0 / 25.0

    for idx, p in enumerate(players_to_sync):
        results["processed"] += 1
        if only_missing and p.aav not in (None, 0):
            results["skipped"] += 1
        else:
            try:
                api_data = fetch_salary_from_rapidapi(p.player_name, p.team, p.position)
                salary, matched = extract_salary_from_rapidapi(api_data)

                if salary is None:
                    results["failed"] += 1
                else:
                    p.aav = salary
                    db.add(p)
                    db.commit()
                    db.refresh(p)
                    results["updated"] += 1
            except HTTPException as e:
                db.rollback()
                if e.status_code == 500:
                    raise e
                results["failed"] += 1
                if e.status_code == 429:
                    remaining = query.filter((models.Player.aav == 0) | (models.Player.aav.is_(None))).count()
                    return {
                        **results,
                        "remaining": remaining,
                        "batch_size": batch_size,
                        "rate_limit_hit": True,
                        "detail": "Rate limit reached. Try again after a short wait.",
                    }
            except Exception:
                db.rollback()
                results["failed"] += 1

        if idx < len(players_to_sync) - 1:
            time.sleep(rate_delay)

    remaining = query.filter((models.Player.aav == 0) | (models.Player.aav.is_(None))).count()
    return {
        **results,
        "remaining": remaining,
        "batch_size": batch_size,
    }


def get_team_tricode(team_name: str) -> str | None:
    if not team_name:
        return None

    cleaned = team_name.strip()
    upper = cleaned.upper()
    if upper in TEAM_NAME_TO_TRICODE.values():
        return upper

    for full_name, tri_code in TEAM_NAME_TO_TRICODE.items():
        if full_name.lower() == cleaned.lower():
            return tri_code

    return None


@router.post("/import-headshots")
@router.post("/import-headshots/")
def import_player_headshots(
    only_missing: bool = True,
    user=Depends(admin_required),
    db: Session = Depends(get_db),
):
    spotlight = fetch_nhl_player_search()
    if not isinstance(spotlight, list):
        raise HTTPException(status_code=502, detail="Unexpected NHL player search payload")

    spotlight_by_name_and_team: Dict[str, Any] = {}
    spotlight_by_name: Dict[str, Any] = {}

    for entry in spotlight:
        name = entry.get("name")
        team = entry.get("teamAbbrev") or entry.get("lastTeamAbbrev")
        normalized_name = normalize_text(name)
        if normalized_name:
            if team:
                spotlight_by_name_and_team[f"{normalized_name}|{team}"] = entry
            if normalized_name not in spotlight_by_name:
                spotlight_by_name[normalized_name] = entry

    query = db.query(models.Player)
    if only_missing:
        players = query.filter(
            or_(models.Player.headshot_url == None, models.Player.headshot_url == "", models.Player.headshot_url.like("%/static/headshots/%"))
        ).all()
    else:
        players = query.all()

    results = {"processed": 0, "updated": 0, "unmatched": 0}

    for p in players:
        results["processed"] += 1
        normalized_player_name = normalize_text(p.player_name)
        team_code = get_team_tricode(p.team)
        headshot_entry = None

        if normalized_player_name:
            if team_code:
                headshot_entry = spotlight_by_name_and_team.get(f"{normalized_player_name}|{team_code}")
            if headshot_entry is None:
                headshot_entry = spotlight_by_name.get(normalized_player_name)

        if headshot_entry and headshot_entry.get("playerId"):
            p.nhl_player_id = str(headshot_entry["playerId"])
            team_code = team_code or headshot_entry.get("teamAbbrev") or headshot_entry.get("lastTeamAbbrev")
            if team_code:
                p.headshot_url = build_headshot_url(p.nhl_player_id, team_code)
            db.add(p)
            db.commit()
            db.refresh(p)
            results["updated"] += 1
        else:
            results["unmatched"] += 1

    remaining = db.query(models.Player).filter((models.Player.headshot_url == None) | (models.Player.headshot_url == "")).count()
    return {
        **results,
        "total": len(players),
        "only_missing": only_missing,
        "search_count": len(spotlight),
        "remaining": remaining,
    }


@router.post("/import-rosters")
@router.post("/import-rosters/")
def import_team_rosters(
    team_codes: str | None = None,
    user=Depends(admin_required),
    db: Session = Depends(get_db),
):
    """
    Import current rosters for specified team codes (comma-separated) or all teams.
    This will create or update `Player` records using NHL player IDs and headshot URLs.
    """
    if team_codes:
        teams = [t.strip().upper() for t in team_codes.split(",") if t.strip()]
    else:
        teams = list(TEAM_NAME_TO_TRICODE.values())

    # Delegate to reusable function so scheduler can call it
    result = perform_import_rosters(db, teams)

    return {
        **result,
        "teams_requested": teams,
    }


def perform_import_rosters(db: Session, teams: list[str]) -> dict:
    summary = {
        "teams_processed": 0,
        "players_seen": 0,
        "players_created": 0,
        "players_updated": 0,
        "errors": 0,
    }

    for team_code in teams:
        try:
            roster = fetch_team_roster(team_code)
        except HTTPException as e:
            summary["errors"] += 1
            continue

        summary["teams_processed"] += 1

        for entry in roster:
            summary["players_seen"] += 1

            # Extract player id and name from common payload shapes
            player_id = None
            player_name = None

            if isinstance(entry, dict):
                # common nested person object
                person = entry.get("person") or entry.get("player") or {}
                if isinstance(person, dict):
                    player_id = person.get("id") or person.get("playerId") or person.get("personId")
                    player_name = person.get("fullName") or person.get("full_name") or person.get("name")

                # some payloads include top-level fields
                player_id = player_id or entry.get("personId") or entry.get("playerId") or entry.get("id")
                player_name = player_name or entry.get("fullName") or entry.get("playerName") or entry.get("name")

            if player_id is None or player_name is None:
                # skip malformed entry
                continue

            player_id = str(player_id)

            # Try to find existing player by nhl_player_id first
            p = db.query(models.Player).filter(models.Player.nhl_player_id == player_id).first()

            # If not found, try matching by normalized name + team
            if not p:
                p = (
                    db.query(models.Player)
                    .filter(models.Player.player_name.ilike(f"%{player_name}%"))
                    .filter(models.Player.team == team_code)
                    .first()
                )

            headshot = build_headshot_url(player_id, team_code)

            if p:
                # update (full overhaul per request)
                p.nhl_player_id = player_id
                p.headshot_url = headshot
                p.team = team_code
                p.player_name = player_name
                db.add(p)
                try:
                    db.commit()
                    db.refresh(p)
                    summary["players_updated"] += 1
                except Exception:
                    db.rollback()
                    summary["errors"] += 1
            else:
                # create minimal player record
                try:
                    new_p = models.Player(player_name=player_name, team=team_code, nhl_player_id=player_id, headshot_url=headshot)
                    db.add(new_p)
                    db.commit()
                    db.refresh(new_p)
                    summary["players_created"] += 1
                except Exception:
                    db.rollback()
                    summary["errors"] += 1

    return summary

@router.post("/import-rosters")
@router.post("/import-rosters/")
def import_team_rosters(
    team_codes: str | None = None,
    user=Depends(admin_required),
    db: Session = Depends(get_db),
):
    """
    Import current rosters for specified team codes (comma-separated) or all teams.
    This will create or update `Player` records using NHL player IDs and headshot URLs.
    """
    if team_codes:
        teams = [t.strip().upper() for t in team_codes.split(",") if t.strip()]
    else:
        teams = list(TEAM_NAME_TO_TRICODE.values())

    summary = {
        "teams_processed": 0,
        "players_seen": 0,
        "players_created": 0,
        "players_updated": 0,
        "errors": 0,
    }

    for team_code in teams:
        try:
            roster = fetch_team_roster(team_code)
        except HTTPException as e:
            summary["errors"] += 1
            continue

        summary["teams_processed"] += 1

        for entry in roster:
            summary["players_seen"] += 1

            # Extract player id and name from common payload shapes
            player_id = None
            player_name = None

            if isinstance(entry, dict):
                # common nested person object
                person = entry.get("person") or entry.get("player") or {}
                if isinstance(person, dict):
                    player_id = person.get("id") or person.get("playerId") or person.get("personId")
                    player_name = person.get("fullName") or person.get("full_name") or person.get("name")

                # some payloads include top-level fields
                player_id = player_id or entry.get("personId") or entry.get("playerId") or entry.get("id")
                player_name = player_name or entry.get("fullName") or entry.get("playerName") or entry.get("name")

            if player_id is None or player_name is None:
                # skip malformed entry
                continue

            player_id = str(player_id)
            normalized_name = normalize_text(player_name)

            # Try to find existing player by nhl_player_id first
            p = db.query(models.Player).filter(models.Player.nhl_player_id == player_id).first()

            # If not found, try matching by normalized name + team
            if not p:
                p = (
                    db.query(models.Player)
                    .filter(models.Player.player_name.ilike(f"%{player_name}%"))
                    .filter(models.Player.team == team_code)
                    .first()
                )

            headshot = build_headshot_url(player_id, team_code)

            if p:
                # update
                p.nhl_player_id = player_id
                p.headshot_url = headshot
                p.team = team_code
                # update player_name to canonical name from API
                p.player_name = player_name
                db.add(p)
                db.commit()
                db.refresh(p)
                summary["players_updated"] += 1
            else:
                # create minimal player record
                try:
                    new_p = models.Player(player_name=player_name, team=team_code, nhl_player_id=player_id, headshot_url=headshot)
                    db.add(new_p)
                    db.commit()
                    db.refresh(new_p)
                    summary["players_created"] += 1
                except Exception:
                    db.rollback()
                    summary["errors"] += 1

    return {
        **summary,
        "teams_requested": teams,
    }
