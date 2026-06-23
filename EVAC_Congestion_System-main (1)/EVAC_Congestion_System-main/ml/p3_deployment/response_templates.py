"""
P3 Deployment Recommendation Engine — Response Templates
=========================================================
Transparent, cause-specific rule table. Each template defines the
*baseline* resource allocation before any scaling is applied.

This table IS the model — it's a decision table, not a black box.
Commanders can inspect and edit it.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ResponseTemplate:
    """One row of the response-template decision table."""
    cause: str
    base_officers: int
    recovery_van: int
    base_barricades: int
    escalate_to: list[str] = field(default_factory=list)
    equipment: list[str] = field(default_factory=list)
    notes: str = ""
    priority_override: Optional[str] = None  # force HIGH/LOW regardless of model


# ─── The decision table ──────────────────────────────────────────────────────
RESPONSE_TEMPLATES: dict[str, ResponseTemplate] = {}

def _register(t: ResponseTemplate):
    RESPONSE_TEMPLATES[t.cause.lower().strip()] = t

# Vehicle breakdown — 60% of all incidents; recovery van is primary response
_register(ResponseTemplate(
    cause="vehicle_breakdown",
    base_officers=2,
    recovery_van=1,
    base_barricades=2,
    escalate_to=[],
    equipment=["traffic cones", "reflective signs", "tow cable"],
    notes="Most common cause. Recovery van is the critical resource. "
          "Park patrol vehicle upstream with hazard lights.",
))

# Accident — higher base due to safety / casualty risk
_register(ResponseTemplate(
    cause="accident",
    base_officers=4,
    recovery_van=1,
    base_barricades=4,
    escalate_to=["Ambulance / 108", "Fire & Emergency (if entrapment)"],
    equipment=["first aid kit", "traffic cones", "reflective signs", "flares"],
    notes="Secure the scene first. Preserve evidence for FIR. "
          "One officer directs traffic; one manages scene.",
    priority_override="HIGH",
))

# Potholes — police can't fix; escalate to civic authority
_register(ResponseTemplate(
    cause="pot_holes",
    base_officers=1,
    recovery_van=0,
    base_barricades=2,
    escalate_to=["BBMP / Civil Works"],
    equipment=["warning signs", "traffic cones"],
    notes="Place warning cones immediately. Escalate to BBMP for repair. "
          "Monitor until repair crew arrives.",
))

# Water logging — flood risk, wider barricade zone
_register(ResponseTemplate(
    cause="water_logging",
    base_officers=1,
    recovery_van=0,
    base_barricades=3,
    escalate_to=["BBMP Storm Water Drain Dept", "Fire Dept (if deep)"],
    equipment=["warning signs", "barricade tape", "depth markers"],
    notes="Do NOT allow vehicles to enter flooded stretch. "
          "Check for submerged manholes. Alert Fire Dept if depth > 2ft.",
))

# Construction — pre-planned cordons
_register(ResponseTemplate(
    cause="construction",
    base_officers=1,
    recovery_van=0,
    base_barricades=4,
    escalate_to=["BBMP / PWD"],
    equipment=["barricade tape", "reflective signs", "diversion boards"],
    notes="Verify construction permit. Ensure night-visibility markers. "
          "Coordinate with contractor for expected duration.",
))

# Tree fall — chainsaw team needed
_register(ResponseTemplate(
    cause="tree_fall",
    base_officers=2,
    recovery_van=0,
    base_barricades=3,
    escalate_to=["Forest Department", "BBMP Tree Cell", "BESCOM (if wires involved)"],
    equipment=["barricade tape", "reflective signs", "traffic cones"],
    notes="Check for downed power lines FIRST — do not touch if wires present. "
          "Cordon area until Forest/BBMP removal team arrives.",
    priority_override="HIGH",
))

# Road conditions (bad surface, cracks, etc.)
_register(ResponseTemplate(
    cause="road_conditions",
    base_officers=1,
    recovery_van=0,
    base_barricades=2,
    escalate_to=["BBMP / PWD"],
    equipment=["warning signs", "traffic cones"],
    notes="Surface hazard warning. Slow-zone signage if applicable. "
          "Escalate to BBMP for resurfacing.",
))

# Congestion — signal management, no physical barrier
_register(ResponseTemplate(
    cause="congestion",
    base_officers=3,
    recovery_van=0,
    base_barricades=0,
    escalate_to=[],
    equipment=["handheld radio", "whistle", "reflective jacket"],
    notes="Deploy at junction points. Manual signal override may be needed. "
          "Focus on clearing bottleneck, not blocking.",
))

# Public event — barricade plan scaled by historical volume
_register(ResponseTemplate(
    cause="public_event",
    base_officers=6,
    recovery_van=0,
    base_barricades=8,
    escalate_to=["Event Coordinator", "Traffic Control Room"],
    equipment=["barricade tape", "diversion boards", "PA system", "CCTV mobile unit"],
    notes="Pre-deploy barricades 2h before event start. "
          "Coordinate diversion routes with traffic control room. "
          "Post-event: phase removal to avoid secondary congestion.",
))

# Procession — route-based deployment
_register(ResponseTemplate(
    cause="procession",
    base_officers=5,
    recovery_van=0,
    base_barricades=6,
    escalate_to=["Religious Affairs Dept", "Traffic Control Room"],
    equipment=["barricade tape", "diversion boards", "PA system"],
    notes="Deploy along entire route. Lead and tail vehicles. "
          "Coordinate with organiser for exact timing and route.",
))

# VIP movement — highest baseline
_register(ResponseTemplate(
    cause="vip_movement",
    base_officers=8,
    recovery_van=0,
    base_barricades=10,
    escalate_to=["SPG / Protocol Division", "Traffic Control Room"],
    equipment=["road closure boards", "diversion boards", "radio set"],
    notes="Full route sanitisation. Advance party 30 min before. "
          "Coordinate with SPG for exact convoy timing.",
    priority_override="HIGH",
))

# Protest — crowd control
_register(ResponseTemplate(
    cause="protest",
    base_officers=6,
    recovery_van=0,
    base_barricades=6,
    escalate_to=["Rapid Action Force", "Traffic Control Room"],
    equipment=["barricade tape", "riot shields (standby)", "PA system", "CCTV mobile unit"],
    notes="Maintain safe distance. Do not escalate. "
          "Have Rapid Action Force on standby. Monitor crowd density.",
    priority_override="HIGH",
))

# Debris on road
_register(ResponseTemplate(
    cause="debris",
    base_officers=1,
    recovery_van=0,
    base_barricades=2,
    escalate_to=["BBMP Cleanup"],
    equipment=["traffic cones", "broom/shovel (if minor)"],
    notes="Clear minor debris immediately if safe. "
          "For large debris (construction material, cargo spill), escalate to BBMP.",
))
# Handle the uppercase variant from the dataset
_register(ResponseTemplate(
    cause="Debris",
    base_officers=1,
    recovery_van=0,
    base_barricades=2,
    escalate_to=["BBMP Cleanup"],
    equipment=["traffic cones", "broom/shovel (if minor)"],
    notes="Clear minor debris immediately if safe.",
))

# Fog / Low Visibility (rare — 2 rows in data)
_register(ResponseTemplate(
    cause="fog / low visibility",
    base_officers=2,
    recovery_van=0,
    base_barricades=2,
    escalate_to=[],
    equipment=["flares", "reflective signs", "fog lights"],
    notes="Reduce speed limit signage. Deploy flares at 100m intervals. "
          "Alert control room for advisory broadcasts.",
))

# Test/Demo events (3 rows in data)
_register(ResponseTemplate(
    cause="test_demo",
    base_officers=0,
    recovery_van=0,
    base_barricades=0,
    escalate_to=[],
    equipment=[],
    notes="Test event — no deployment needed.",
))

# Default catch-all
DEFAULT_TEMPLATE = ResponseTemplate(
    cause="default",
    base_officers=2,
    recovery_van=0,
    base_barricades=2,
    escalate_to=[],
    equipment=["traffic cones", "reflective signs"],
    notes="Unknown cause type. Deploy standard patrol. Assess on-site.",
)


def get_template(cause: str) -> ResponseTemplate:
    """Look up the response template for a given cause. Falls back to default."""
    key = cause.lower().strip()
    return RESPONSE_TEMPLATES.get(key, DEFAULT_TEMPLATE)


def list_all_templates() -> list[dict]:
    """Return all templates as a list of dicts (for API / UI consumption)."""
    all_templates = list(RESPONSE_TEMPLATES.values()) + [DEFAULT_TEMPLATE]
    return [
        {
            "cause": t.cause,
            "base_officers": t.base_officers,
            "recovery_van": t.recovery_van,
            "base_barricades": t.base_barricades,
            "escalate_to": t.escalate_to,
            "equipment": t.equipment,
            "notes": t.notes,
            "priority_override": t.priority_override,
        }
        for t in all_templates
    ]
