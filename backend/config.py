# backend/config.py
CURRENT_SEASON = "2026-27"
PREVIOUS_SEASON = "2025-26"
MONEYPUCK_SEASON_YEAR = 2026
ROSTER_SEASON_CODE = "20262027"

SALARY_CAP_BY_SEASON = {
    "2025-26": 95500000,  # placeholder — VERIFY before trusting in production
    "2026-27": 104000000,  # placeholder — VERIFY before trusting in production
}

# Optional season-specific game pace used only for market value model inputs.
# If a season is absent, raw in-season totals are used as-is.
MARKET_VALUE_PACE_GAMES_BY_SEASON = {
    "2026-27": 82,
}
MARKET_VALUE_PACE_STOP_GAMES = 30

MONEPUCK_SKATERS_URL = f"https://moneypuck.com/moneypuck/playerData/seasonSummary/{MONEYPUCK_SEASON_YEAR}/regular/skaters.csv"
MONEPUCK_SHOTS_ZIP = f"https://peter-tanner.com/moneypuck/downloads/shots_{MONEYPUCK_SEASON_YEAR}.zip"
