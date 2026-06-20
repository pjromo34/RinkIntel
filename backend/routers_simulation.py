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
    icetime: float
    xg_all_situations: float
    age: float
    games_played: float

@router.post("")
def simulate_player(data: SimInput):
    predicted = (data.points * 100000) + (data.xg_all_situations * 50000)
    return {"predicted_aav": predicted}
