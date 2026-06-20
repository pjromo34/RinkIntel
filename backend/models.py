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
    xg_all_situations = Column(Float, default=0)
    icetime = Column(Float, default=0)
    market_value = Column(Float, default=0)
    aav = Column(Float, default=0)
    nhl_player_id = Column(String, nullable=True)
    uploaded_headshot_url = Column(String, nullable=True)

    # NEW
    headshot_url = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    header_image = Column(String, nullable=True)
    author = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
