"""
P3 Deployment Recommendation Engine — Configuration
====================================================
All tunable constants in one place. Commanders / developers can adjust
these without touching engine logic.
"""

from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # EVAC_Congestion_System-main
DATA_DIR = PROJECT_ROOT / "data"
MODEL_DIR = PROJECT_ROOT / "ml" / "models"
P3_OUTPUT_DIR = Path(__file__).resolve().parent / "output"

CSV_FILENAME = "Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv"
CORRIDOR_RISK_FILE = MODEL_DIR / "corridor_risk_scores.json"

# ─── OSMnx / Routing ─────────────────────────────────────────────────────────
# Bengaluru bounding box (from P2 metadata)
BENGALURU_BBOX = {
    "north": 13.27,
    "south": 12.80,
    "east": 77.77,
    "west": 77.31,
}
OSM_GRAPH_CACHE = Path(__file__).resolve().parent / "cache" / "bengaluru_drive.graphml"
# Radius (metres) around incident centre to block edges when computing detour
INCIDENT_BLOCK_RADIUS_M = 200
# Default driving speed for time estimates (km/h)
DEFAULT_SPEED_KMH = 25

# ─── Scaling coefficients ────────────────────────────────────────────────────
# Officer multiplier = 1.0 + OFFICER_IMPACT_COEFF * (impact_score - 5)
OFFICER_IMPACT_COEFF = 0.15
# Barricade multiplier = 1.0 + BARRICADE_IMPACT_COEFF * (impact_score - 5)
BARRICADE_IMPACT_COEFF = 0.10

# Corridor risk tier adjustments (additive multipliers)
CORRIDOR_RISK_ADJUSTMENTS = {
    "HIGH":   {"officer_pct": 0.30, "barricade_pct": 0.20},
    "MEDIUM": {"officer_pct": 0.10, "barricade_pct": 0.10},
    "LOW":    {"officer_pct": 0.00, "barricade_pct": 0.00},
}

# Time-of-day officer boost (percentage)
TIME_OF_DAY_BOOST = {
    "morning_peak": {"hours": (4, 7),  "officer_pct": 0.20},   # 4am–7am
    "evening_peak": {"hours": (19, 23), "officer_pct": 0.25},  # 7pm–11pm
}

# Road closure trigger threshold (P1 closure probability)
CLOSURE_PROBABILITY_THRESHOLD = 0.50
CLOSURE_EXTRA_OFFICERS = 2
CLOSURE_EXTRA_BARRICADES = 4

# Hard limits
MIN_OFFICERS = 1
MAX_OFFICERS = 20
MIN_BARRICADES = 0
MAX_BARRICADES = 30

# ─── Impact score simulation (when P1 models aren't available) ────────────
# Weights match P1 v3 formula exactly
IMPACT_WEIGHTS = {"priority": 0.4, "closure": 0.4, "duration": 0.2}

# Priority mapping to probability proxy
PRIORITY_PROB = {"high": 0.85, "low": 0.15}

# Closure rate by cause (derived from dataset EDA)
CLOSURE_RATE_BY_CAUSE = {
    "vehicle_breakdown": 0.065,
    "accident": 0.19,
    "pot_holes": 0.09,
    "construction": 0.14,
    "water_logging": 0.10,
    "tree_fall": 0.15,
    "road_conditions": 0.08,
    "congestion": 0.04,
    "public_event": 0.12,
    "procession": 0.11,
    "vip_movement": 0.20,
    "protest": 0.13,
    "others": 0.08,
    "debris": 0.07,
    "default": 0.083,
}

# Median duration (hours) by cause — for simulation fallback
MEDIAN_DURATION_BY_CAUSE = {
    "vehicle_breakdown": 3.5,
    "accident": 5.0,
    "pot_holes": 8.0,
    "construction": 12.0,
    "water_logging": 6.0,
    "tree_fall": 4.5,
    "road_conditions": 6.5,
    "congestion": 2.0,
    "public_event": 8.0,
    "procession": 6.0,
    "vip_movement": 4.0,
    "protest": 5.0,
    "others": 4.0,
    "debris": 3.0,
    "default": 4.0,
}
