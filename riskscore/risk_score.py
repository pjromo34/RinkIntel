"""
RinkIntel — Contract Research: Player Risk Score (v1)
========================================================

Single-season composite risk score. No historical data pull needed — this
runs entirely on the current season's roster plus your existing market
value model output.

FACTORS (all z-scored across the current-season league population, then
combined with adjustable weights):

  1. Age risk        — empirical curve from Pierce's cumulative WAR-
                        difference-from-peak data (peak age 24 forwards,
                        21 defensemen). 0 for any age at/before peak
                        (still-developing players aren't penalized);
                        magnitude of decline-from-peak for ages after.
  2. Durability risk  — 1 - (games_played / scheduled_games).
                        *** BOOTSTRAP EXCEPTION ***
                        For the 2026-27 risk scores specifically: RinkIntel's
                        first live season has no prior-season data loaded,
                        so 2026-27 risk scores use 2025-26 games played
                        (the player's OWN most recent season, not a prior
                        one relative to 2026-27). From 2027-28 onward, this
                        becomes true prior-season games played (i.e. 2027-28
                        risk scores will use 2026-27 games played). Do not
                        let this bootstrap exception get carried forward —
                        it applies to the 2026-27 scores only.
  3. Contract gap     — (actual AAV - predicted market_value) / market_value.
                        Positive = overpaid relative to model = more risk.
  4. Shooting% overperformance — goals/shots vs. league average for the
                        player's position, current season. Only counts
                        when a player is shooting ABOVE their position's
                        average (regression risk) — shooting below average
                        isn't penalized, since that's a different signal
                        (possible positive regression, not risk). Smaller
                        weight than the other three by design.

USAGE
-----
    from risk_score import compute_risk_scores
    scored_df = compute_risk_scores(df, weights={
        "age": 0.3, "durability": 0.3, "contract_gap": 0.3, "shooting_pct": 0.1
    })

`df` must have columns: playerId, position ('F' or 'D'), age, games_played,
goals, shots, aav, market_value. Missing values in any single factor are
excluded from that factor's z-score only (not the whole row) — so a
just-signed rookie with no market_value gap doesn't get dropped entirely,
they just don't get a contract_gap component.
"""

import numpy as np
import pandas as pd
from age_curve_data import FORWARD_CUM_DIFF, DEFENSE_CUM_DIFF

SCHEDULED_GAMES = 82  # adjust to 84 for a season with an unusual schedule

DEFAULT_WEIGHTS = {
    "age": 0.30,
    "durability": 0.30,
    "contract_gap": 0.30,
    "shooting_pct": 0.10,
}

# Minimum games played to be included in league-average / z-score
# denominators — keeps tiny-sample call-ups from skewing the baseline.
MIN_GAMES_FOR_BASELINE = 20

# --- Age curve setup (Option B: pre-peak ages clipped to 0 risk) ----------
# FORWARD_CUM_DIFF / DEFENSE_CUM_DIFF are cumulative WAR difference from
# each position's empirical peak age (0 at peak, negative everywhere else —
# both before AND after peak, since "peak" is by definition the max).
# Peak age = the age where cum diff == 0.
_F_AGES = sorted(FORWARD_CUM_DIFF.keys())
_F_VALS = [FORWARD_CUM_DIFF[a] for a in _F_AGES]
_F_PEAK_AGE = max(FORWARD_CUM_DIFF, key=FORWARD_CUM_DIFF.get)

_D_AGES = sorted(DEFENSE_CUM_DIFF.keys())
_D_VALS = [DEFENSE_CUM_DIFF[a] for a in _D_AGES]
_D_PEAK_AGE = max(DEFENSE_CUM_DIFF, key=DEFENSE_CUM_DIFF.get)


def _interp_cum_diff(age: float, position: str) -> float:
    """Linear interpolation for fractional ages; flat extrapolation past
    the edges of the known table (18-42 for F, 18-40 for D)."""
    if position == "D":
        return float(np.interp(age, _D_AGES, _D_VALS))
    return float(np.interp(age, _F_AGES, _F_VALS))


def age_risk_raw(age: pd.Series, position: pd.Series) -> pd.Series:
    """
    Empirical age-risk curve derived from Pierce's cumulative WAR-difference-
    from-peak tables (Option B): 0 for any age at or before the position's
    empirical peak age (still-developing players aren't penalized), and the
    magnitude of decline-from-peak for any age after it. Peak age is 24 for
    forwards, 21 for defensemen, per the supplied data.
    """
    risk = pd.Series(0.0, index=age.index)
    for idx in age.index:
        a = age[idx]
        pos = position[idx]
        peak_age = _D_PEAK_AGE if pos == "D" else _F_PEAK_AGE
        if a >= peak_age:
            cum_diff = _interp_cum_diff(a, pos)
            risk[idx] = max(0.0, -cum_diff)
        else:
            risk[idx] = 0.0
    return risk


def durability_risk_raw(games_played: pd.Series, scheduled_games: int = SCHEDULED_GAMES) -> pd.Series:
    """Higher = more missed time = more risk. Clipped to [0, 1]."""
    return (1 - (games_played / scheduled_games)).clip(lower=0, upper=1)


def contract_gap_risk_raw(aav: pd.Series, market_value: pd.Series) -> pd.Series:
    """Positive = paid above model's predicted value = more risk."""
    return (aav - market_value) / market_value


def shooting_pct_risk_raw(goals: pd.Series, shots: pd.Series, position: pd.Series) -> pd.Series:
    """
    Only penalizes shooting ABOVE position average (regression risk).
    Shooting below average is left at 0, not treated as protective —
    it's a different signal, not the inverse of this one.
    """
    shooting_pct = np.where(shots > 0, goals / shots, np.nan)
    shooting_pct = pd.Series(shooting_pct, index=goals.index)

    league_avg_by_pos = shooting_pct.groupby(position).transform("mean")
    delta = shooting_pct - league_avg_by_pos
    return delta.clip(lower=0)


# ---------------------------------------------------------------------------
# Composite
# ---------------------------------------------------------------------------
def zscore(series: pd.Series) -> pd.Series:
    return (series - series.mean()) / series.std(ddof=0)


def compute_risk_scores(df: pd.DataFrame, weights: dict = None, scheduled_games: int = SCHEDULED_GAMES) -> pd.DataFrame:
    weights = weights or DEFAULT_WEIGHTS
    out = df.copy()

    baseline = out[out["games_played"] >= MIN_GAMES_FOR_BASELINE].copy()
    if len(baseline) < 20:
        raise ValueError(
            f"Only {len(baseline)} players meet the {MIN_GAMES_FOR_BASELINE}-game "
            f"minimum — too few for a stable league baseline. Check your input data."
        )

    # Raw factors computed on the full df (so every player gets a score),
    # but z-scored against the baseline population's mean/std.
    out["age_risk_raw"] = age_risk_raw(out["age"], out["position"])
    out["durability_risk_raw"] = durability_risk_raw(out["games_played"], scheduled_games)
    out["contract_gap_raw"] = contract_gap_risk_raw(out["aav"], out["market_value"])
    out["shooting_pct_risk_raw"] = shooting_pct_risk_raw(out["goals"], out["shots"], out["position"])

    baseline["age_risk_raw"] = age_risk_raw(baseline["age"], baseline["position"])
    baseline["durability_risk_raw"] = durability_risk_raw(baseline["games_played"], scheduled_games)
    baseline["contract_gap_raw"] = contract_gap_risk_raw(baseline["aav"], baseline["market_value"])
    baseline["shooting_pct_risk_raw"] = shooting_pct_risk_raw(baseline["goals"], baseline["shots"], baseline["position"])

    for factor in ["age_risk", "durability_risk", "contract_gap", "shooting_pct_risk"]:
        raw_col = f"{factor}_raw"
        mean, std = baseline[raw_col].mean(), baseline[raw_col].std(ddof=0)
        out[f"{factor}_z"] = (out[raw_col] - mean) / std if std > 0 else 0.0

    weight_map = {
        "age_risk_z": weights.get("age", DEFAULT_WEIGHTS["age"]),
        "durability_risk_z": weights.get("durability", DEFAULT_WEIGHTS["durability"]),
        "contract_gap_z": weights.get("contract_gap", DEFAULT_WEIGHTS["contract_gap"]),
        "shooting_pct_risk_z": weights.get("shooting_pct", DEFAULT_WEIGHTS["shooting_pct"]),
    }

    out["risk_composite_z"] = sum(
        out[col].fillna(0) * w for col, w in weight_map.items()
    )

    # Percentile against the same baseline population, for display
    # ("riskier than 82% of comparable players").
    baseline_composite = sum(
        (baseline[f"{col.replace('_z', '_raw')}"] - baseline[f"{col.replace('_z', '_raw')}"].mean())
        / (baseline[f"{col.replace('_z', '_raw')}"].std(ddof=0) or 1) * w
        for col, w in weight_map.items()
    )
    out["risk_percentile"] = out["risk_composite_z"].apply(
        lambda x: (baseline_composite < x).mean() * 100
    )

    return out
