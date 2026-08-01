"""
Empirical aging curve: cumulative difference in WAR from position-specific
peak age, provided by Pierce. Keys are the START age of each age-band label
(e.g. "18/19" -> 18). Values are already peak-relative (0 at peak age,
negative before AND after peak — i.e. NOT clipped to zero pre-peak).
"""

FORWARD_CUM_DIFF = {
    18: -0.86, 19: -0.48, 20: -0.26, 21: -0.12, 22: -0.06, 23: -0.07,
    24: 0.00, 25: -0.10, 26: -0.12, 27: -0.15, 28: -0.26, 29: -0.38,
    30: -0.49, 31: -0.69, 32: -0.83, 33: -0.98, 34: -1.24, 35: -1.33,
    36: -1.36, 37: -1.69, 38: -1.83, 39: -2.21, 40: -1.76, 41: -2.41, 42: -2.22,
}

DEFENSE_CUM_DIFF = {
    18: -0.15, 19: -0.05, 20: -0.04, 21: 0.00, 22: -0.03, 23: -0.04,
    24: -0.25, 25: -0.41, 26: -0.40, 27: -0.46, 28: -0.47, 29: -0.55,
    30: -0.80, 31: -0.67, 32: -0.98, 33: -0.85, 34: -1.11, 35: -1.01,
    36: -1.09, 37: -1.47, 38: -0.89, 39: -1.61, 40: -1.21,
}
