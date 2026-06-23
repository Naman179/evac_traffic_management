"""
EVAC — Deployment Recommendation Service (P3 Wrapper)
=====================================================
Wraps the P3 recommendation engine, integrating P1 impact simulation
and P2 corridor risk data.
"""

from __future__ import annotations

import math
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Any

from app.core.config import settings
from app.core.logging import logger

# Add the P3 module to Python path so we can import its submodules
_p3_path = str(settings.ML_ROOT / "ml" / "p3_deployment")
if _p3_path not in sys.path:
    sys.path.insert(0, _p3_path)


class DeploymentService:
    """Singleton wrapper around P3 Deployment Recommendation Engine."""

    def __init__(self):
        self._loaded = False
        self._corridor_risk_lookup = {}
        self._request_count = 0

    def load(self, corridor_risk_lookup: dict) -> None:
        """Initialise with P2 corridor risk lookup data."""
        self._corridor_risk_lookup = corridor_risk_lookup
        self._loaded = True
        logger.info(f"P3 deployment service loaded with {len(corridor_risk_lookup)} corridors")

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def request_count(self) -> int:
        return self._request_count

    def recommend(self, incident: dict) -> dict:
        """
        Generate a deployment recommendation for a single incident.
        Uses P3's simulated P1 impact + recommendation engine.
        """
        if not self._loaded:
            raise RuntimeError("P3 deployment service not loaded")

        try:
            # Import P3 modules (they're already on sys.path)
            from deployment_scorer import simulate_p1_impact
            from recommendation_engine import recommend
            from osm_diversion import compute_diversion
            from response_templates import get_template
        except ImportError as e:
            logger.error(f"Failed to import P3 modules: {e}")
            # Fall back to simplified logic
            return self._fallback_recommend(incident)

        # Simulate P1 impact prediction
        impact = simulate_p1_impact(incident)

        # Look up corridor risk
        corridor = str(incident.get("corridor", "")).lower().strip()
        cr = self._corridor_risk_lookup.get(corridor)

        # Run the recommendation engine with diversion support
        plan = recommend(incident, impact, cr, diversion_func=compute_diversion)

        self._request_count += 1

        return {
            "incident_id": str(incident.get("id", plan.incident_id)),
            "cause": plan.cause,
            "corridor": plan.corridor,
            "impact_score": plan.impact_score,
            "closure_probability": round(plan.closure_probability, 4),
            "recommended_officers": plan.recommended_officers,
            "recommended_barricades": plan.recommended_barricades,
            "equipment": plan.equipment,
            "escalate_to": plan.escalate_to,
            "diversion_triggered": plan.diversion_triggered,
            "diversion_route": plan.diversion_route,
            "explanation": plan.explanation,
            "notes": plan.notes,
        }

    def get_templates(self) -> list[dict]:
        """Return all P3 response templates."""
        try:
            from response_templates import list_all_templates
            return list_all_templates()
        except ImportError:
            return []

    def _fallback_recommend(self, incident: dict) -> dict:
        """Simplified fallback when P3 modules can't be imported."""
        cause = str(incident.get("event_cause", "unknown")).lower()
        return {
            "incident_id": str(incident.get("id", "fallback")),
            "cause": cause,
            "corridor": str(incident.get("corridor", "")),
            "impact_score": 5,
            "closure_probability": 0.1,
            "recommended_officers": 2,
            "recommended_barricades": 2,
            "equipment": ["traffic cones", "reflective signs"],
            "escalate_to": [],
            "diversion_triggered": False,
            "diversion_route": None,
            "explanation": ["Fallback recommendation — P3 modules not available"],
            "notes": "Default deployment. Assess situation on-site.",
        }


# Singleton instance
deployment_service = DeploymentService()
