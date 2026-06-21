from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/simulate", tags=["simulate"])

class SimInput(BaseModel):
    position: str
    goals: float
    assists: float
    points: float
    primary_assists: float
    secondary_assists: float
    high_danger_shots: float
    high_danger_goals: float
    hits: float
    takeaways: float
    giveaways: float
    dzone_giveaways: float
    blocked_shot_attempts: float
    onice_a_xgoals: float
    onice_a_goals: float
    onice_xgoals_pct: float
    onice_corsi_pct: float
    icetime: float
    age: float
    games_played: float

@router.post("")
def simulate_player(data: SimInput):
    # Simplified market value estimate from box-score + impact stats (excluding expected goals).
    predicted = (
        (data.points * 90000)
        + (data.goals * 70000)
        + (data.primary_assists * 40000)
        + (data.secondary_assists * 25000)
        + (data.high_danger_shots * 12000)
        + (data.high_danger_goals * 35000)
        + (data.hits * 1500)
        + (data.takeaways * 5000)
        - (data.giveaways * 3500)
        - (data.dzone_giveaways * 5000)
        + (data.blocked_shot_attempts * 3000)
        - (data.onice_a_xgoals * 8000)
        - (data.onice_a_goals * 12000)
        + (data.onice_xgoals_pct * 6000)
        + (data.onice_corsi_pct * 4000)
        + ((data.icetime / max(data.games_played, 1)) * 80)
        - (max(data.age - 27, 0) * 15000)
    )
    predicted = max(predicted, 750000)
    return {"predicted_aav": predicted}
