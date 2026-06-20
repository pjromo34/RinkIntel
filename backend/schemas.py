# backend/schemas.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- Player schemas ---
class PlayerBase(BaseModel):
    player_name: str
    team: Optional[str] = None
    position: Optional[str] = None
    games_played: Optional[int] = None
    icetime: Optional[float] = None

class PlayerCreate(PlayerBase):
    I_F_points: Optional[float] = None
    I_F_primaryAssists: Optional[float] = None
    I_F_secondaryAssists: Optional[float] = None
    I_F_goals: Optional[float] = None
    I_F_highDangerShots: Optional[float] = None
    I_F_highDangerGoals: Optional[float] = None
    I_F_hits: Optional[float] = None
    I_F_takeaways: Optional[float] = None
    I_F_giveaways: Optional[float] = None
    I_F_dZoneGiveaways: Optional[float] = None
    I_F_blockedShotAttempts: Optional[float] = None
    OnIce_A_xGoals: Optional[float] = None
    OnIce_A_goals: Optional[float] = None
    onIce_xGoalsPercentage: Optional[float] = None
    onIce_corsiPercentage: Optional[float] = None
    xG_all_situations: Optional[float] = None
    points_per_60: Optional[float] = None
    age_at_signing: Optional[float] = None

class PlayerOut(PlayerBase):
    id: int
    I_F_points: Optional[float] = None
    I_F_primaryAssists: Optional[float] = None
    I_F_secondaryAssists: Optional[float] = None
    I_F_goals: Optional[float] = None
    I_F_highDangerShots: Optional[float] = None
    I_F_highDangerGoals: Optional[float] = None
    I_F_hits: Optional[float] = None
    I_F_takeaways: Optional[float] = None
    I_F_giveaways: Optional[float] = None
    I_F_dZoneGiveaways: Optional[float] = None
    I_F_blockedShotAttempts: Optional[float] = None
    OnIce_A_xGoals: Optional[float] = None
    OnIce_A_goals: Optional[float] = None
    onIce_xGoalsPercentage: Optional[float] = None
    onIce_corsiPercentage: Optional[float] = None
    xG_all_situations: Optional[float] = None
    points_per_60: Optional[float] = None
    age_at_signing: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# --- Simulator input schema (the missing piece) ---
class SimulatorInput(BaseModel):
    position: str
    points: float
    primary_assists: float
    secondary_assists: float
    goals: float
    high_danger_shots: float
    high_danger_goals: float
    hits: float
    takeaways: float
    giveaways: float
    dzone_giveaways: float
    blocked_shot_attempts: float
    onice_a_xgoals: float
    onice_a_goals: float
    games_played: int
    icetime: float
    onice_xgoals_pct: float
    onice_corsi_pct: float
    xg_all_situations: float
    age: float

# --- Article schemas ---
class ArticleBase(BaseModel):
    title: str
    body: str
    published: Optional[bool] = False

class ArticleCreate(ArticleBase):
    pass

class ArticleOut(ArticleBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# --- Auth schemas ---
class LoginForm(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
