# backend/config.py
CURRENT_SEASON = "2025-26"
MONEYPUCK_SEASON_YEAR = 2025
ROSTER_SEASON_CODE = "20252026"

SALARY_CAP_BY_SEASON = {
    "2025-26": 95500000,  # placeholder — VERIFY before trusting in production
}

MONEPUCK_SKATERS_URL = f"https://moneypuck.com/moneypuck/playerData/seasonSummary/{MONEYPUCK_SEASON_YEAR}/regular/skaters.csv"
MONEPUCK_SHOTS_ZIP = f"https://peter-tanner.com/moneypuck/downloads/shots_{MONEYPUCK_SEASON_YEAR}.zip"
