"""
P3 Deployment Recommendation Engine — Core Engine
===================================================
Transparent, auditable pipeline that turns an incident + impact prediction
into a concrete deployment plan with full explanation trail.

Every scaling factor is logged so commanders see *why* a recommendation
was made — this is a selling point, not a debug feature.
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Optional

from .config import (
    OFFICER_IMPACT_COEFF,
    BARRICADE_IMPACT_COEFF,
    CORRIDOR_RISK_ADJUSTMENTS,
    TIME_OF_DAY_BOOST,
    CLOSURE_PROBABILITY_THRESHOLD,
    CLOSURE_EXTRA_OFFICERS,
    CLOSURE_EXTRA_BARRICADES,
    MIN_OFFICERS,
    MAX_OFFICERS,
    MIN_BARRICADES,
    MAX_BARRICADES,
)
from .response_templates import get_template, ResponseTemplate


# ─── Data classes ─────────────────────────────────────────────────────────────

class DeploymentPlan:
    """Complete deployment recommendation with full explanation audit trail."""

    def __init__(self):
        self.incident_id: str = ""
        self.cause: str = ""
        self.corridor: str = ""
        self.zone: str = ""
        self.latitude: float = 0.0
        self.longitude: float = 0.0
        self.start_datetime: Optional[str] = None

        # P1 inputs
        self.impact_score: int = 5
        self.closure_probability: float = 0.0
        self.priority_probability: float = 0.5
        self.expected_duration_h: float = 4.0

        # P2 inputs
        self.corridor_risk_tier: str = "MEDIUM"
        self.corridor_risk_score: float = 0.5

        # Recommendations
        self.recommended_officers: int = 0
        self.recommended_barricades: int = 0
        self.recovery_van_needed: bool = False
        self.escalate_to: list[str] = []
        self.equipment: list[str] = []
        self.diversion_triggered: bool = False
        self.diversion_route: Optional[dict] = None

        # Explanation — the audit trail
        self.explanation: list[str] = []

        # Template reference
        self.template_cause: str = ""
        self.notes: str = ""

    def to_dict(self) -> dict:
        return {
            "incident_id": self.incident_id,
            "cause": self.cause,
            "corridor": self.corridor,
            "zone": self.zone,
            "location": {"latitude": self.latitude, "longitude": self.longitude},
            "start_datetime": self.start_datetime,
            "impact_score": self.impact_score,
            "closure_probability": round(self.closure_probability, 4),
            "priority_probability": round(self.priority_probability, 4),
            "expected_duration_h": round(self.expected_duration_h, 2),
            "corridor_risk_tier": self.corridor_risk_tier,
            "corridor_risk_score": round(self.corridor_risk_score, 4),
            "recommended_officers": self.recommended_officers,
            "recommended_barricades": self.recommended_barricades,
            "recovery_van_needed": self.recovery_van_needed,
            "escalate_to": self.escalate_to,
            "equipment": self.equipment,
            "diversion_triggered": self.diversion_triggered,
            "diversion_route": self.diversion_route,
            "template_used": self.template_cause,
            "notes": self.notes,
            "explanation": self.explanation,
        }


# ─── Engine ───────────────────────────────────────────────────────────────────

def recommend(
    incident: dict,
    impact_prediction: dict,
    corridor_risk: Optional[dict] = None,
    diversion_func: Optional[Any] = None,
) -> DeploymentPlan:
    """
    Generate a deployment recommendation.

    Parameters
    ----------
    incident : dict
        Raw incident data with keys: id, event_cause, corridor, zone,
        latitude, longitude, endlatitude, endlongitude, start_datetime,
        priority, requires_road_closure, etc.
    impact_prediction : dict
        P1's output: composite_impact_score, closure_probability,
        priority_high_probability, expected_duration_h.
    corridor_risk : dict, optional
        P2's corridor risk entry: risk_tier, risk_score, closure_rate.
    diversion_func : callable, optional
        Function(lat, lon, endlat, endlon) -> route dict.
        If provided, called when diversion is triggered.

    Returns
    -------
    DeploymentPlan with full explanation trail.
    """
    plan = DeploymentPlan()

    # ── 1. Extract incident metadata ──────────────────────────────────────
    plan.incident_id = str(incident.get("id", "unknown"))
    cause_raw = str(incident.get("event_cause", "unknown")).lower().strip()
    plan.cause = cause_raw
    plan.corridor = str(incident.get("corridor", "")).lower().strip() or "non-corridor"
    plan.zone = str(incident.get("zone", "")).strip() or "unknown"
    plan.latitude = float(incident.get("latitude", 0) or 0)
    plan.longitude = float(incident.get("longitude", 0) or 0)
    plan.start_datetime = str(incident.get("start_datetime", ""))

    # ── 2. Extract P1 predictions ─────────────────────────────────────────
    plan.impact_score = int(impact_prediction.get("composite_impact_score", 5))
    plan.closure_probability = float(impact_prediction.get("closure_probability", 0.0))
    plan.priority_probability = float(impact_prediction.get("priority_high_probability", 0.5))
    plan.expected_duration_h = float(impact_prediction.get("expected_duration_h", 4.0))

    # ── 3. Extract P2 corridor risk ───────────────────────────────────────
    if corridor_risk:
        plan.corridor_risk_tier = str(corridor_risk.get("risk_tier", "MEDIUM")).upper()
        plan.corridor_risk_score = float(corridor_risk.get("risk_score", 0.5))
    else:
        plan.corridor_risk_tier = "MEDIUM"
        plan.corridor_risk_score = 0.5

    # ── 4. Look up base template ──────────────────────────────────────────
    template: ResponseTemplate = get_template(cause_raw)
    plan.template_cause = template.cause
    plan.notes = template.notes
    plan.recovery_van_needed = template.recovery_van > 0
    plan.escalate_to = list(template.escalate_to)
    plan.equipment = list(template.equipment)

    base_off = template.base_officers
    base_bar = template.base_barricades

    plan.explanation.append(
        f"Base template: {template.cause} -> "
        f"{base_off} officers, {base_bar} barricades"
        + (f", {template.recovery_van} recovery van" if template.recovery_van else "")
        + (f", escalate to {', '.join(template.escalate_to)}" if template.escalate_to else "")
    )

    # ── 5. Scale by P1 composite impact score (1-10) ──────────────────────
    off_mult = 1.0 + OFFICER_IMPACT_COEFF * (plan.impact_score - 5)
    bar_mult = 1.0 + BARRICADE_IMPACT_COEFF * (plan.impact_score - 5)
    # Clamp multipliers to reasonable range
    off_mult = max(0.4, min(off_mult, 2.0))
    bar_mult = max(0.5, min(bar_mult, 1.8))

    scaled_off = base_off * off_mult
    scaled_bar = base_bar * bar_mult

    plan.explanation.append(
        f"Impact score {plan.impact_score}/10 -> "
        f"officer multiplier {off_mult:.2f}x, "
        f"barricade multiplier {bar_mult:.2f}x"
    )

    # ── 6. Scale by P2 corridor risk tier ─────────────────────────────────
    risk_adj = CORRIDOR_RISK_ADJUSTMENTS.get(
        plan.corridor_risk_tier,
        CORRIDOR_RISK_ADJUSTMENTS["LOW"],
    )
    corridor_off_boost = risk_adj["officer_pct"]
    corridor_bar_boost = risk_adj["barricade_pct"]

    scaled_off *= (1.0 + corridor_off_boost)
    scaled_bar *= (1.0 + corridor_bar_boost)

    if corridor_off_boost > 0:
        plan.explanation.append(
            f"{plan.corridor_risk_tier}-risk corridor ({plan.corridor}) -> "
            f"+{corridor_off_boost:.0%} officers, +{corridor_bar_boost:.0%} barricades"
        )
    else:
        plan.explanation.append(
            f"Corridor risk: {plan.corridor_risk_tier} ({plan.corridor}) -> no adjustment"
        )

    # ── 7. Time-of-day modifier ───────────────────────────────────────────
    hour = _extract_hour(plan.start_datetime)
    time_boost_applied = False
    for band_name, band_cfg in TIME_OF_DAY_BOOST.items():
        h_start, h_end = band_cfg["hours"]
        if h_start <= hour <= h_end:
            boost = band_cfg["officer_pct"]
            scaled_off *= (1.0 + boost)
            plan.explanation.append(
                f"{band_name.replace('_', ' ').title()} hour ({hour:02d}:00) -> "
                f"+{boost:.0%} officers"
            )
            time_boost_applied = True
            break
    if not time_boost_applied:
        plan.explanation.append(f"Off-peak hour ({hour:02d}:00) -> no time adjustment")

    # ── 8. Road closure adjustment ────────────────────────────────────────
    if plan.closure_probability > CLOSURE_PROBABILITY_THRESHOLD:
        plan.diversion_triggered = True
        scaled_off += CLOSURE_EXTRA_OFFICERS
        scaled_bar += CLOSURE_EXTRA_BARRICADES
        plan.explanation.append(
            f"Road closure probable ({plan.closure_probability:.0%}) -> "
            f"+{CLOSURE_EXTRA_OFFICERS} officers (diversion management), "
            f"+{CLOSURE_EXTRA_BARRICADES} barricades (closure points), "
            f"diversion route triggered"
        )
        # Add diversion-specific equipment
        if "road closure boards" not in plan.equipment:
            plan.equipment.extend(["road closure boards", "diversion boards"])
    else:
        plan.explanation.append(
            f"Road closure unlikely ({plan.closure_probability:.0%}) -> "
            f"no closure adjustment"
        )

    # ── 9. Duration-based extra caution ───────────────────────────────────
    if plan.expected_duration_h > 12:
        # Long-duration events need shift relief planning
        shift_extra = 2
        scaled_off += shift_extra
        plan.explanation.append(
            f"Long-duration event ({plan.expected_duration_h:.1f}h) -> "
            f"+{shift_extra} officers for shift relief"
        )
    elif plan.expected_duration_h > 6:
        shift_extra = 1
        scaled_off += shift_extra
        plan.explanation.append(
            f"Medium-duration event ({plan.expected_duration_h:.1f}h) -> "
            f"+{shift_extra} officer for shift overlap"
        )

    # ── 10. Round up + clamp ──────────────────────────────────────────────
    final_off = int(math.ceil(scaled_off))
    final_bar = int(math.ceil(scaled_bar))
    final_off = max(MIN_OFFICERS, min(final_off, MAX_OFFICERS))
    final_bar = max(MIN_BARRICADES, min(final_bar, MAX_BARRICADES))

    # Special case: test_demo events need nothing
    if cause_raw in ("test_demo",):
        final_off = 0
        final_bar = 0

    plan.recommended_officers = final_off
    plan.recommended_barricades = final_bar

    plan.explanation.append(
        f"Final recommendation: {final_off} officers, {final_bar} barricades"
    )

    # ── 11. Compute diversion route if triggered ──────────────────────────
    if plan.diversion_triggered and diversion_func is not None:
        try:
            endlat = float(incident.get("endlatitude", 0) or 0)
            endlon = float(incident.get("endlongitude", 0) or 0)
            if endlat > 0 and endlon > 0:
                route = diversion_func(
                    plan.latitude, plan.longitude, endlat, endlon
                )
                plan.diversion_route = route
                if route and route.get("status") == "ok":
                    plan.explanation.append(
                        f"Diversion route computed: {route.get('detour_distance_km', '?')} km, "
                        f"~{route.get('estimated_time_min', '?')} min"
                    )
                else:
                    plan.explanation.append(
                        "Diversion route: fallback geometric detour applied"
                    )
        except Exception as e:
            plan.explanation.append(f"Diversion route computation failed: {e}")

    return plan


def _extract_hour(datetime_str: str) -> int:
    """Extract hour from a datetime string. Returns 12 (noon) as safe default."""
    if not datetime_str or datetime_str == "nan":
        return 12
    try:
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S",
                    "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S%z",
                    "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S.%f%z"):
            try:
                return datetime.strptime(datetime_str.strip(), fmt).hour
            except ValueError:
                continue
        # Last resort: look for HH:MM pattern
        import re
        m = re.search(r"(\d{2}):(\d{2})", datetime_str)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return 12


# ─── Batch recommendation ────────────────────────────────────────────────────

def recommend_batch(
    incidents: list[dict],
    impact_predictions: list[dict],
    corridor_risk_lookup: dict[str, dict],
    diversion_func: Optional[Any] = None,
) -> list[DeploymentPlan]:
    """
    Run recommendations for a batch of incidents.

    corridor_risk_lookup: {corridor_name_lower: {risk_tier, risk_score, ...}}
    """
    plans = []
    for inc, pred in zip(incidents, impact_predictions):
        corridor = str(inc.get("corridor", "")).lower().strip()
        cr = corridor_risk_lookup.get(corridor)
        plan = recommend(inc, pred, cr, diversion_func)
        plans.append(plan)
    return plans
