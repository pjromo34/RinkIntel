# backend/models.py

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from backend.database import Base
from datetime import datetime

class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    player_name = Column(String, index=True, nullable=False)
    team = Column(String, index=True, nullable=True)
    position = Column(String, nullable=True)

    goals = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    points = Column(Integer, default=0)
    games_played = Column(Integer, default=0)
    xg_all_situations = Column(Float, default=0)
    icetime = Column(Float, default=0)
    high_danger_shots = Column(Float, default=0)
    blocked_shots = Column(Float, default=0)
    hits = Column(Float, default=0)
    takeaways = Column(Float, default=0)
    giveaways = Column(Float, default=0)
    market_value = Column(Float, default=0)
    aav = Column(Float, default=0)
    contract_years_remaining = Column(Integer, default=0, nullable=False)
    contract_start_season = Column(String, nullable=True)
    contracts_json = Column(String, nullable=True)
    season_history_json = Column(String, nullable=True)
    nhl_player_id = Column(String, nullable=True)
    uploaded_headshot_url = Column(String, nullable=True)

    # NEW
    headshot_url = Column(String, nullable=True)
    season = Column(String, nullable=True)
    active_roster = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    content = Column(String, nullable=True)
    header_image = Column(String, nullable=True)
    author = Column(String, nullable=True)
    published = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
