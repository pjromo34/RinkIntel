# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ---------------------------------------------------------
# Create FastAPI app  (MUST come before include_router)
# ---------------------------------------------------------
app = FastAPI()

# Routers
from backend.routers_players import router as players_router
from backend.routers_articles import router as articles_router
from backend.routers_admin_articles import router as admin_articles_router
from backend.routers_admin_players import router as admin_players_router
from backend.routers_auth import router as auth_router
from backend.routers_simulation import router as simulation_router
from threading import Thread, Event

# Scheduler imports
from backend.routers_admin_players import perform_import_rosters, TEAM_NAME_TO_TRICODE
from backend.database import SessionLocal

# Database
from backend.database import Base, engine


# ---------------------------------------------------------
# CORS configuration
# ---------------------------------------------------------
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Static files
# ---------------------------------------------------------
app.mount("/static", StaticFiles(directory="static"), name="static")


# ---------------------------------------------------------
# Routers  (NOW the correct place)
# ---------------------------------------------------------
app.include_router(players_router)
app.include_router(articles_router)
app.include_router(admin_articles_router)
app.include_router(admin_players_router)
app.include_router(auth_router)
app.include_router(simulation_router)   # <-- FIXED


# ---------------------------------------------------------
# Background scheduler to sync rosters daily at 02:00
# ---------------------------------------------------------
_scheduler_stop_event: Event | None = None
_scheduler_thread: Thread | None = None


def _scheduler_loop(stop_event: Event):
    import time
    from datetime import datetime, timedelta

    def seconds_until_next(hour: int = 2, minute: int = 0) -> float:
        now = datetime.now()
        target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now:
            target = target + timedelta(days=1)
        return (target - now).total_seconds()

    while not stop_event.is_set():
        wait_secs = seconds_until_next(2, 0)
        # wait until scheduled time or until stop_event is set
        stop_event.wait(wait_secs)
        if stop_event.is_set():
            break

        # perform import for all teams
        db = SessionLocal()
        try:
            teams = list(TEAM_NAME_TO_TRICODE.values())
            perform_import_rosters(db, teams)
        except Exception:
            pass
        finally:
            db.close()


@app.on_event("startup")
def _start_scheduler():
    global _scheduler_stop_event, _scheduler_thread
    if _scheduler_thread is None:
        _scheduler_stop_event = Event()
        _scheduler_thread = Thread(target=_scheduler_loop, args=(_scheduler_stop_event,), daemon=True)
        _scheduler_thread.start()


@app.on_event("shutdown")
def _stop_scheduler():
    global _scheduler_stop_event, _scheduler_thread
    if _scheduler_stop_event is not None:
        _scheduler_stop_event.set()
    if _scheduler_thread is not None:
        _scheduler_thread.join(timeout=5)


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------
@app.get("/", tags=["root"])
async def read_root():
    return {"status": "ok"}
