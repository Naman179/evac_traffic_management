"""
P3 Deployment — Historical Case-Study Anchors
===============================================
Extracts the ~128 rows with assigned_to_police_id and ~86 with real
route_path from the dataset. Runs the recommendation engine on them
and produces a comparison gallery for demo credibility.

These are NOT training data — they're validation anchors.
"""

from __future__ import annotations

import json
from typing import Optional

import numpy as np
import pandas as pd

from .config import DATA_DIR, CSV_FILENAME


def load_historical_anchors(df: Optional[pd.DataFrame] = None) -> dict:
    """
    Extract and analyse the historical cases where deployment data exists.

    Returns
    -------
    dict with:
        - officer_cases: list of dicts (rows with assigned_to_police_id)
        - route_cases: list of dicts (rows with real route coordinates)
        - summary: aggregate statistics
    """
    if df is None:
        csv_path = DATA_DIR / CSV_FILENAME
        df = pd.read_csv(csv_path)

    # ── Officer assignment cases (128 rows) ───────────────────────────────
    officer_mask = df["assigned_to_police_id"].notna()
    officer_df = df[officer_mask].copy()

    officer_cases = []
    for _, row in officer_df.iterrows():
        officer_cases.append({
            "id": str(row.get("id", "")),
            "event_cause": str(row.get("event_cause", "unknown")),
            "corridor": str(row.get("corridor", "")),
            "zone": str(row.get("zone", "")),
            "latitude": float(row.get("latitude", 0) or 0),
            "longitude": float(row.get("longitude", 0) or 0),
            "endlatitude": float(row.get("endlatitude", 0) or 0),
            "endlongitude": float(row.get("endlongitude", 0) or 0),
            "start_datetime": str(row.get("start_datetime", "")),
            "priority": str(row.get("priority", "")),
            "requires_road_closure": bool(row.get("requires_road_closure", False)),
            "status": str(row.get("status", "")),
            "assigned_to_police_id": str(row.get("assigned_to_police_id", "")),
            "police_station": str(row.get("police_station", "")),
        })

    # ── Route cases (86 real routes) ──────────────────────────────────────
    route_mask = df["route_path"].notna()
    route_df = df[route_mask].copy()

    route_cases = []
    for _, row in route_df.iterrows():
        rp_raw = str(row.get("route_path", "[]"))
        # Filter out empty lists "[]" and placeholder strings
        has_real_route = (
            rp_raw not in ("[]", "", "nan", "None")
            and len(rp_raw) > 10
        )
        if has_real_route:
            try:
                coords = json.loads(rp_raw)
                if isinstance(coords, list) and len(coords) >= 2:
                    route_cases.append({
                        "id": str(row.get("id", "")),
                        "event_cause": str(row.get("event_cause", "unknown")),
                        "corridor": str(row.get("corridor", "")),
                        "latitude": float(row.get("latitude", 0) or 0),
                        "longitude": float(row.get("longitude", 0) or 0),
                        "start_datetime": str(row.get("start_datetime", "")),
                        "priority": str(row.get("priority", "")),
                        "route_path_coords": coords,
                        "route_n_points": len(coords),
                    })
            except (json.JSONDecodeError, TypeError):
                pass

    # ── Summary statistics ────────────────────────────────────────────────
    officer_cause_dist = officer_df["event_cause"].value_counts().to_dict() if len(officer_df) > 0 else {}
    officer_corridor_dist = officer_df["corridor"].value_counts().head(5).to_dict() if len(officer_df) > 0 else {}

    summary = {
        "total_rows": len(df),
        "officer_assigned_count": len(officer_cases),
        "officer_assigned_pct": round(len(officer_cases) / len(df) * 100, 2),
        "real_route_count": len(route_cases),
        "real_route_pct": round(len(route_cases) / len(df) * 100, 2),
        "officer_cause_distribution": officer_cause_dist,
        "officer_top_corridors": officer_corridor_dist,
    }

    return {
        "officer_cases": officer_cases,
        "route_cases": route_cases,
        "summary": summary,
    }


def validate_against_anchors(
    anchors: dict,
    recommend_func,
    impact_sim_func,
    corridor_risk_lookup: dict,
) -> list[dict]:
    """
    Run the recommendation engine on each historical anchor case and
    produce a comparison report.

    Parameters
    ----------
    anchors : output of load_historical_anchors()
    recommend_func : recommendation_engine.recommend
    impact_sim_func : deployment_scorer.simulate_p1_impact
    corridor_risk_lookup : {corridor_lower: {risk_tier, risk_score, ...}}

    Returns
    -------
    List of comparison dicts, one per anchor case.
    """
    comparisons = []

    for case in anchors["officer_cases"]:
        # Simulate P1 impact prediction
        impact = impact_sim_func(case)

        # Get corridor risk
        corridor = str(case.get("corridor", "")).lower().strip()
        cr = corridor_risk_lookup.get(corridor)

        # Run recommendation engine
        plan = recommend_func(case, impact, cr)

        comparisons.append({
            "incident_id": case["id"],
            "cause": case["event_cause"],
            "corridor": case.get("corridor", ""),
            "priority": case.get("priority", ""),
            "requires_closure": case.get("requires_road_closure", False),
            "had_real_officer": True,
            "police_station": case.get("police_station", ""),
            "engine_recommended_officers": plan.recommended_officers,
            "engine_recommended_barricades": plan.recommended_barricades,
            "engine_impact_score": plan.impact_score,
            "engine_closure_prob": round(plan.closure_probability, 3),
            "engine_escalations": plan.escalate_to,
            "explanation_summary": plan.explanation[-1] if plan.explanation else "",
        })

    return comparisons


def summarize_validation(comparisons: list[dict]) -> dict:
    """Aggregate validation results into a summary."""
    if not comparisons:
        return {"n_cases": 0, "message": "No anchor cases to validate against"}

    officers = [c["engine_recommended_officers"] for c in comparisons]
    barricades = [c["engine_recommended_barricades"] for c in comparisons]
    impact_scores = [c["engine_impact_score"] for c in comparisons]

    # Check distribution of recommendations
    high_deployment = sum(1 for o in officers if o >= 5)
    closure_triggered = sum(1 for c in comparisons if c["engine_closure_prob"] > 0.5)

    # Cause distribution of anchor cases
    cause_counts = {}
    for c in comparisons:
        cause = c["cause"]
        cause_counts[cause] = cause_counts.get(cause, 0) + 1

    return {
        "n_cases": len(comparisons),
        "officer_stats": {
            "mean": round(np.mean(officers), 1),
            "median": int(np.median(officers)),
            "min": int(np.min(officers)),
            "max": int(np.max(officers)),
        },
        "barricade_stats": {
            "mean": round(np.mean(barricades), 1),
            "median": int(np.median(barricades)),
        },
        "impact_score_stats": {
            "mean": round(np.mean(impact_scores), 1),
            "median": int(np.median(impact_scores)),
        },
        "high_deployment_count": high_deployment,
        "closure_triggered_count": closure_triggered,
        "cause_distribution": cause_counts,
    }
