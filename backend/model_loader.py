import os
import pickle
from pathlib import Path

BASE = Path(__file__).resolve().parent
MODELS_DIR = BASE / "models"

XG_MODEL_FILE = MODELS_DIR / "xg_model.pkl"
FWD_MODEL_FILE = MODELS_DIR / "model_forwards.pkl"
DEF_MODEL_FILE = MODELS_DIR / "model_defensemen.pkl"


def _ensure_models_exist():
    missing = []
    for p in (XG_MODEL_FILE, FWD_MODEL_FILE, DEF_MODEL_FILE):
        if not p.exists():
            missing.append(str(p))
    if missing:
        raise RuntimeError(
            f"Required model files are missing in backend/models/: {missing}.\n"
            "Place xg_model.pkl, model_forwards.pkl, and model_defensemen.pkl in backend/models/"
        )


def load_models():
    _ensure_models_exist()
    # Load xg bundle (contains model + encoder + cat_cols)
    with open(XG_MODEL_FILE, "rb") as f:
        xg_bundle = pickle.load(f)

    with open(FWD_MODEL_FILE, "rb") as f:
        fwd = pickle.load(f)

    with open(DEF_MODEL_FILE, "rb") as f:
        dmodel = pickle.load(f)

    return {
        "xg": xg_bundle,
        "fwd": fwd,
        "def": dmodel,
    }


_LOADED = None


def get_models():
    global _LOADED
    if _LOADED is None:
        _LOADED = load_models()
    return _LOADED
