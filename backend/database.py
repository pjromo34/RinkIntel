from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost/rinkintel")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Import models so SQLAlchemy knows about them
from backend.models import Player, Article

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# Backward-compatible schema patch for existing databases.
with engine.begin() as conn:
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS contract_years_remaining INTEGER NOT NULL DEFAULT 0"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS contract_start_season VARCHAR"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS games_played INTEGER NOT NULL DEFAULT 0"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS contracts_json TEXT"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS season_history_json TEXT"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS high_danger_shots DOUBLE PRECISION NOT NULL DEFAULT 0"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS blocked_shots DOUBLE PRECISION NOT NULL DEFAULT 0"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS hits DOUBLE PRECISION NOT NULL DEFAULT 0"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS takeaways DOUBLE PRECISION NOT NULL DEFAULT 0"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS giveaways DOUBLE PRECISION NOT NULL DEFAULT 0"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE articles ADD COLUMN IF NOT EXISTS content TEXT"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE articles ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false"
        )
    )
