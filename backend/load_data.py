import pandas as pd
import math
from backend.database import SessionLocal, engine
from backend import models

models.Base.metadata.create_all(bind=engine)

BASE = "/Users/pierceromo/Desktop/Hockey Analytics"

# ---------------------------------------------------------
# TEAM NAME MAPPING (abbrev → full name)
# ---------------------------------------------------------
TEAM_MAP = {
    "ANA": "Anaheim Ducks",
    "BOS": "Boston Bruins",
    "BUF": "Buffalo Sabres",
    "CGY": "Calgary Flames",
    "CAR": "Carolina Hurricanes",
    "CHI": "Chicago Blackhawks",
    "COL": "Colorado Avalanche",
    "CBJ": "Columbus Blue Jackets",
    "DAL": "Dallas Stars",
    "DET": "Detroit Red Wings",
    "EDM": "Edmonton Oilers",
    "FLA": "Florida Panthers",
    "LAK": "Los Angeles Kings",
    "MIN": "Minnesota Wild",
    "MTL": "Montreal Canadiens",
    "NSH": "Nashville Predators",
    "NJD": "New Jersey Devils",
    "NYI": "New York Islanders",
    "NYR": "New York Rangers",
    "OTT": "Ottawa Senators",
    "PHI": "Philadelphia Flyers",
    "PIT": "Pittsburgh Penguins",
    "SJS": "San Jose Sharks",
    "SEA": "Seattle Kraken",
    "STL": "St. Louis Blues",
    "TBL": "Tampa Bay Lightning",
    "UTA": "Utah Mammoth",
    "TOR": "Toronto Maple Leafs",
    "VAN": "Vancouver Canucks",
    "VGK": "Vegas Golden Knights",
    "WPG": "Winnipeg Jets",
    "WSH": "Washington Capitals",
}

# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------
df = pd.read_excel(f"{BASE}/predictions_202526.xlsx")
contracts = pd.read_excel(f"{BASE}/ContractData.xlsx")
contracts = contracts[contracts["priorSeason"] == "2025-26"][["playerName", "AAV"]]

df = df.merge(contracts, left_on="Player", right_on="playerName", how="left")

print(df.head(20))
print(df["Team"].value_counts())

db = SessionLocal()

# Clear existing players
db.query(models.Player).delete()
db.commit()

# ---------------------------------------------------------
# INSERT PLAYERS
# ---------------------------------------------------------
for _, row in df.iterrows():

    # --- Sanitize AAV ---
    raw_aav = row.get("AAV", 0)
    aav = 0 if raw_aav is None or (isinstance(raw_aav, float) and math.isnan(raw_aav)) else raw_aav

    # --- Sanitize Market Value ---
    raw_mv = row.get("Market Value", 0)
    market_value = 0 if raw_mv is None or (isinstance(raw_mv, float) and math.isnan(raw_mv)) else raw_mv

    # --- Convert team abbreviation to full name ---
    team_abbrev = row.get("Team", "")
    team_full = TEAM_MAP.get(team_abbrev, team_abbrev)

    player = models.Player(
        player_name=row["Player"],
        team=team_full,
        position=row.get("position", ""),
        goals=row.get("Goals", 0),
        assists=row.get("Assists", 0),
        points=row.get("Points", 0),
        xg_all_situations=row.get("xG", 0),
        icetime=0,
        market_value=market_value,
        aav=aav
    )

    db.add(player)

db.commit()
db.close()

print(f"Loaded {len(df)} players into database")
