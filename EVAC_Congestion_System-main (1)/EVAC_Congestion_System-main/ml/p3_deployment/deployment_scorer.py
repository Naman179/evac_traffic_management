"""
P3 Deployment — Deployment Scorer (P1/P2 Integration Layer)
=============================================================
Reads P2's corridor_risk_scores.json, simulates P1 impact predictions
(when P1 models aren't saved yet), and feeds both into the
recommendation engine.

This is the glue between Person 1, Person 2, and Person 3.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from .config import (
    CORRIDOR_RISK_FILE,
    IMPACT_WEIGHTS,
    PRIORITY_PROB,
    CLOSURE_RATE_BY_CAUSE,
    MEDIAN_DURATION_BY_CAUSE,
)


# ─── P2 Corridor Risk Loader ─────────────────────────────────────────────────

def load_corridor_risk_scores(
    filepath: Optional[Path] = None,
) -> dict[str, dict]:
    """
    Load P2's corridor_risk_scores.json into a lookup dict.

    Returns
    -------
    {corridor_name_lower: {risk_tier, risk_score, closure_rate, ...}}
    """
    fp = filepath or CORRIDOR_RISK_FILE
    if not fp.exists():
        print(f"[P2] Warning: corridor_risk_scores.json not found at {fp}")
        return {}

    with open(fp, "r") as f:
        data = json.load(f)

    lookup = {}
    for entry in data.get("corridors", []):
        key = str(entry["corridor"]).lower().strip()
        lookup[key] = {
            "corridor": entry["corridor"],
            "event_count": entry.get("event_count", 0),
            "closure_rate": entry.get("closure_rate", 0.0),
            "mean_impact": entry.get("mean_impact", 5.0),
            "peak_hour": entry.get("peak_hour", 12),
            "risk_score": entry.get("risk_score", 0.5),
            "risk_tier": entry.get("risk_tier", "MEDIUM"),
            "dominant_cause": entry.get("dominant_cause", "unknown"),
        }

    return lookup


# ─── P1 Impact Score Simulator ────────────────────────────────────────────────
# When P1's trained models (.joblib) aren't available, we simulate the
# composite impact score using the documented v3 formula.

def simulate_p1_impact(incident: dict) -> dict:
    """
    Simulate P1's predict_impact_from_request output from raw incident data.

    Uses the documented P1 v3 formula:
        base_score = round(1 + 9 * (0.4*priority_p + 0.4*closure_p + 0.2*norm_duration))
        floor = 6 if P50 > 12h, else 4 if P50 > 6h, else 1
        score = max(base_score, floor)

    Parameters
    ----------
    incident : dict with event_cause, priority, requires_road_closure,
               corridor, start_datetime, etc.

    Returns
    -------
    dict matching P1's output schema:
        composite_impact_score, closure_probability,
        priority_high_probability, expected_duration_h, expected_duration_p90_h
    """
    cause = str(incident.get("event_cause", "unknown")).lower().strip()

    # Priority probability
    priority_raw = str(incident.get("priority", "low")).lower().strip()
    priority_p = PRIORITY_PROB.get(priority_raw, 0.5)

    # Closure probability (from cause-level historical rate)
    closure_p = CLOSURE_RATE_BY_CAUSE.get(cause, CLOSURE_RATE_BY_CAUSE["default"])

    # If the row is explicitly marked as requiring closure, boost the probability
    requires_closure = incident.get("requires_road_closure", False)
    if requires_closure is True or str(requires_closure).lower() in ("true", "1", "yes"):
        closure_p = max(closure_p, 0.85)

    # Duration estimate (hours) — cause-level median as proxy
    p50 = MEDIAN_DURATION_BY_CAUSE.get(cause, MEDIAN_DURATION_BY_CAUSE["default"])
    p90 = p50 * 2.0  # P90 ≈ 2× median (rough approximation)

    # Add corridor-based adjustment: busy corridors have longer clearance times
    corridor = str(incident.get("corridor", "")).lower().strip()
    if corridor and corridor != "non-corridor":
        # Named corridors tend to have 20% longer durations
        p50 *= 1.2
        p90 *= 1.2

    # Add time-of-day adjustment
    hour = _extract_hour(str(incident.get("start_datetime", "")))
    if 4 <= hour <= 7 or 19 <= hour <= 23:
        # Peak hours → longer resolution
        p50 *= 1.15
        p90 *= 1.15

    # Normalised duration (matching P1 v3 formula)
    DURATION_LOG_P95 = math.log1p(72.0)  # ~4.29, approximate P95
    dnorm = min(math.log1p(p50) / DURATION_LOG_P95, 1.0)

    # Composite score
    w = IMPACT_WEIGHTS
    raw = w["priority"] * priority_p + w["closure"] * closure_p + w["duration"] * dnorm
    base_score = round(1 + 9 * raw)

    # Duration-aware floor
    if p50 > 12:
        floor = 6
    elif p50 > 6:
        floor = 4
    else:
        floor = 1

    composite = max(base_score, floor)
    composite = max(1, min(composite, 10))

    return {
        "composite_impact_score": composite,
        "closure_probability": round(closure_p, 4),
        "priority_high_probability": round(priority_p, 4),
        "expected_duration_h": round(p50, 2),
        "expected_duration_p90_h": round(p90, 2),
    }


def _extract_hour(datetime_str: str) -> int:
    """Extract hour from a datetime string. Returns 12 as default."""
    if not datetime_str or datetime_str == "nan":
        return 12
    try:
        import re
        m = re.search(r"(\d{2}):(\d{2})", datetime_str)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return 12


# ─── Batch scoring ───────────────────────────────────────────────────────────

def score_incidents(
    incidents: list[dict],
    corridor_risk_lookup: Optional[dict] = None,
) -> list[dict]:
    """
    Score a batch of incidents: simulate P1 impact + enrich with P2 corridor risk.

    Returns list of (incident, impact_prediction, corridor_risk) tuples.
    """
    if corridor_risk_lookup is None:
        corridor_risk_lookup = load_corridor_risk_scores()

    results = []
    for inc in incidents:
        impact = simulate_p1_impact(inc)
        corridor = str(inc.get("corridor", "")).lower().strip()
        cr = corridor_risk_lookup.get(corridor)
        results.append({
            "incident": inc,
            "impact_prediction": impact,
            "corridor_risk": cr,
        })
    return results
