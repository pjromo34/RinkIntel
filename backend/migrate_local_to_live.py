from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Dict, List, Tuple

from backend.database import SessionLocal
from backend.models import Article, Player

LIVE_API_BASE = os.getenv("LIVE_API_BASE", "https://api.rinkintel.net")
ADMIN_EMAIL = os.getenv("LIVE_ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("LIVE_ADMIN_PASSWORD")


@dataclass
class MigrationStats:
    articles_created: int = 0
    articles_updated: int = 0
    articles_deleted: int = 0
    players_updated: int = 0
    players_missing: int = 0


def _json_request(path: str, method: str = "GET", payload: dict | None = None, token: str | None = None):
    url = f"{LIVE_API_BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, method=method, headers=headers, data=data)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if not body:
                return resp.status, None
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        raise RuntimeError(f"{method} {path} failed ({e.code}): {body}") from e


def ensure_admin_account() -> str:
    # Best-effort create; 400 user exists is fine.
    try:
        _json_request(
            "/auth/register-admin",
            method="POST",
            payload={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        print(f"Created production admin account: {ADMIN_EMAIL}")
    except RuntimeError as err:
        if "User already exists" in str(err):
            print(f"Production admin already exists: {ADMIN_EMAIL}")
        else:
            raise

    _, login_payload = _json_request(
        "/auth/login",
        method="POST",
        payload={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    token = (login_payload or {}).get("access_token")
    if not token:
        raise RuntimeError("Login succeeded but no access token was returned")
    print("Production admin login verified")
    return token


def load_local_data() -> Tuple[List[Article], List[Player]]:
    db = SessionLocal()
    try:
        articles = db.query(Article).order_by(Article.created_at.asc()).all()
        players = db.query(Player).all()
        return articles, players
    finally:
        db.close()


def normalize_key(name: str | None, team: str | None) -> Tuple[str, str]:
    return ((name or "").strip().lower(), (team or "").strip().lower())


def migrate_articles(token: str, local_articles: List[Article], stats: MigrationStats) -> None:
    _, live_articles = _json_request("/admin/articles", token=token)
    live_articles = live_articles or []

    live_by_title = {
        (a.get("title") or "").strip().lower(): a
        for a in live_articles
        if (a.get("title") or "").strip()
    }
    local_titles = set()

    for a in local_articles:
        title_key = (a.title or "").strip().lower()
        if not title_key:
            continue
        local_titles.add(title_key)

        payload = {
            "title": a.title,
            "description": a.description,
            "content": a.content,
            "header_image": a.header_image,
            "author": a.author,
            "published": bool(a.published),
        }

        if title_key in live_by_title:
            article_id = live_by_title[title_key]["id"]
            _json_request(f"/admin/articles/{article_id}", method="PATCH", payload=payload, token=token)
            stats.articles_updated += 1
        else:
            _json_request("/admin/articles", method="POST", payload=payload, token=token)
            stats.articles_created += 1

    # Delete live articles that are not present locally to keep parity.
    for live in live_articles:
        live_title = (live.get("title") or "").strip().lower()
        if live_title and live_title not in local_titles:
            _json_request(f"/admin/articles/{live['id']}", method="DELETE", token=token)
            stats.articles_deleted += 1


def migrate_player_contracts(token: str, local_players: List[Player], stats: MigrationStats) -> None:
    _, live_players = _json_request("/players")
    live_players = live_players or []
    live_by_key: Dict[Tuple[str, str], dict] = {
        normalize_key(p.get("player_name"), p.get("team")): p for p in live_players
    }

    for p in local_players:
        key = normalize_key(p.player_name, p.team)
        live = live_by_key.get(key)
        if not live:
            stats.players_missing += 1
            continue

        patch_payload = {
            "aav": float(p.aav or 0),
            "contract_years_remaining": int(p.contract_years_remaining or 0),
            "contract_start_season": p.contract_start_season,
            "contracts_json": p.contracts_json,
            "season_history_json": p.season_history_json,
            "headshot_url": p.headshot_url,
            "nhl_player_id": p.nhl_player_id,
            "active_roster": bool(p.active_roster),
        }

        _json_request(
            f"/admin/players/{live['id']}",
            method="PATCH",
            payload=patch_payload,
            token=token,
        )
        stats.players_updated += 1


def main() -> int:
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        raise RuntimeError("Set LIVE_ADMIN_EMAIL and LIVE_ADMIN_PASSWORD before running migration")

    print(f"Live API target: {LIVE_API_BASE}")
    print(f"Admin email target: {ADMIN_EMAIL}")

    token = ensure_admin_account()
    local_articles, local_players = load_local_data()

    print(f"Local articles: {len(local_articles)}")
    print(f"Local players: {len(local_players)}")

    stats = MigrationStats()
    migrate_articles(token, local_articles, stats)
    migrate_player_contracts(token, local_players, stats)

    print("\nMigration complete")
    print(f"articles_created={stats.articles_created}")
    print(f"articles_updated={stats.articles_updated}")
    print(f"articles_deleted={stats.articles_deleted}")
    print(f"players_updated={stats.players_updated}")
    print(f"players_missing={stats.players_missing}")

    print("\nLogin credentials for production admin:")
    print(f"email={ADMIN_EMAIL}")
    print(f"password={ADMIN_PASSWORD}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Migration failed: {exc}")
        raise
