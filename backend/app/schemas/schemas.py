"""
EVAC — Pydantic Request/Response Schemas
=========================================
Strict validation for all API endpoints.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional, Any


# ── P1 Impact Prediction ──────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Input for P1 Impact Forecaster."""
    cause: Optional[str] = Field(None, description="Incident cause (e.g. vehicle_breakdown, accident)")
    corridor: Optional[str] = Field(None, description="Corridor name")
    zone: Optional[str] = Field(None, description="Zone name")
    veh_type: Optional[str] = Field(None, description="Vehicle type")
    police_station: Optional[str] = Field(None, description="Nearest police station")
    start_datetime: str = Field(..., description="ISO datetime string e.g. 2024-01-15T08:30:00")
    is_planned: bool = Field(False, description="Whether the event is pre-planned")
    lat: float = Field(0.0, description="Latitude")
    lon: float = Field(0.0, description="Longitude")

    model_config = {"json_schema_extra": {
        "examples": [{
            "cause": "accident",
            "corridor": "Mysore Road",
            "zone": "South",
            "start_datetime": "2024-06-15T08:30:00",
            "lat": 12.95,
            "lon": 77.55,
        }]
    }}


class PredictResponse(BaseModel):
    """P1 impact prediction output."""
    closure_probability: float
    closure_decision: bool
    closure_threshold: float
    priority_high_probability: float
    expected_duration_h: float
    expected_duration_p90_h: float
    composite_impact_score: int


# ── P4 Anomaly Detection ──────────────────────────────────────────────────────

class AnomalyDataPoint(BaseModel):
    """A single corridor-hour data point for anomaly detection."""
    corridor: str = Field(..., description="Corridor name")
    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    event_count: int = Field(..., ge=0, description="Number of events")


class AnomalyDetectRequest(BaseModel):
    """Batch anomaly detection request."""
    data: list[AnomalyDataPoint] = Field(..., min_length=1, description="Data points to evaluate")


class AnomalyResult(BaseModel):
    """Single anomaly detection result."""
    corridor: str
    hour: int
    event_count: int
    is_anomaly: bool
    confidence: float = Field(0.0, description="Anomaly score (higher = more anomalous)")


class AnomalyDetectResponse(BaseModel):
    """Batch anomaly detection response."""
    total_points: int
    anomaly_count: int
    results: list[AnomalyResult]


# ── P3 Route / Deployment Recommendation ─────────────────────────────────────

class RouteRequest(BaseModel):
    """Input for P3 Deployment Recommendation."""
    event_cause: str = Field(..., description="Incident cause")
    corridor: Optional[str] = Field("", description="Corridor name")
    latitude: float = Field(..., description="Incident latitude")
    longitude: float = Field(..., description="Incident longitude")
    endlatitude: Optional[float] = Field(0.0, description="End latitude (for route)")
    endlongitude: Optional[float] = Field(0.0, description="End longitude (for route)")
    start_datetime: Optional[str] = Field("", description="ISO datetime")
    priority: Optional[str] = Field("Low", description="Priority: High or Low")
    requires_road_closure: bool = Field(False, description="Whether road closure is needed")

    model_config = {"json_schema_extra": {
        "examples": [{
            "event_cause": "accident",
            "corridor": "Mysore Road",
            "latitude": 12.95,
            "longitude": 77.55,
            "endlatitude": 12.951,
            "endlongitude": 77.551,
            "start_datetime": "2024-01-20T20:00:00",
            "priority": "High",
            "requires_road_closure": True,
        }]
    }}


class RouteResponse(BaseModel):
    """P3 deployment recommendation result."""
    incident_id: str
    cause: str
    corridor: str
    impact_score: int
    closure_probability: float
    recommended_officers: int
    recommended_barricades: int
    equipment: list[str]
    escalate_to: list[str]
    diversion_triggered: bool
    diversion_route: Optional[dict] = None
    explanation: list[str]
    notes: str


# ── Health & Metrics ──────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Backend health check response."""
    status: str
    version: str
    models_loaded: bool
    model_count: int
    uptime_seconds: float


class MetricsResponse(BaseModel):
    """API metrics response."""
    total_predictions: int
    total_anomaly_checks: int
    total_route_requests: int
    avg_prediction_latency_ms: float
    uptime_seconds: float


# ── Heatmap ───────────────────────────────────────────────────────────────────

class HeatmapResponse(BaseModel):
    """KDE heatmap grid payload."""
    lat_grid: list[float]
    lon_grid: list[float]
    intensity: list[list[float]]
    filter_applied: dict


class HeatmapPointResponse(BaseModel):
    """Single-point density score."""
    lat: float
    lon: float
    density_score: float


# ── Hotspots ──────────────────────────────────────────────────────────────────

class HotspotResponse(BaseModel):
    """GeoJSON FeatureCollection of hotspot clusters."""
    type: str = "FeatureCollection"
    features: list[dict]
    metadata: dict


# ── Corridor Risk ─────────────────────────────────────────────────────────────

class CorridorRiskItem(BaseModel):
    """Single corridor risk entry."""
    corridor: str
    event_count: int
    closure_rate: float
    mean_impact: float
    peak_hour: int
    risk_score: float
    risk_tier: str
    dominant_cause: str


# ── Feature Importance ────────────────────────────────────────────────────────

class FeatureImportanceResponse(BaseModel):
    """P1 model feature importances."""
    features: dict[str, float]
