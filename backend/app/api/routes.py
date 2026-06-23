"""
EVAC — API Route Handlers
=========================
All REST endpoints for the EVAC Congestion System.
"""

from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.schemas import (
    PredictRequest, PredictResponse,
    AnomalyDetectRequest, AnomalyDetectResponse, AnomalyResult,
    RouteRequest, RouteResponse,
    HealthResponse, MetricsResponse,
    HeatmapResponse, HeatmapPointResponse,
    HotspotResponse, CorridorRiskItem,
    FeatureImportanceResponse,
)
from app.services.impact_service import impact_service
from app.services.spatial_service import spatial_service
from app.services.anomaly_service import anomaly_service
from app.services.deployment_service import deployment_service
from app.core.logging import logger

# Track startup time for uptime calculation
_startup_time = time.time()

router = APIRouter(prefix="/api")


# ── Health & Metrics ──────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse, tags=["System"])
def health_check():
    """Check backend health and model load status."""
    models_loaded = all([
        impact_service.is_loaded,
        spatial_service.is_loaded,
        anomaly_service.is_trained,
        deployment_service.is_loaded,
    ])
    model_count = sum([
        impact_service.is_loaded,
        spatial_service.is_loaded,
        anomaly_service.is_trained,
        deployment_service.is_loaded,
    ])
    return HealthResponse(
        status="healthy" if models_loaded else "degraded",
        version="1.0.0",
        models_loaded=models_loaded,
        model_count=model_count,
        uptime_seconds=round(time.time() - _startup_time, 1),
    )


@router.get("/metrics", response_model=MetricsResponse, tags=["System"])
def get_metrics():
    """Return API usage metrics."""
    return MetricsResponse(
        total_predictions=impact_service.prediction_count,
        total_anomaly_checks=anomaly_service.check_count,
        total_route_requests=deployment_service.request_count,
        avg_prediction_latency_ms=round(impact_service.avg_latency_ms, 2),
        uptime_seconds=round(time.time() - _startup_time, 1),
    )


# ── P1 Impact Prediction ─────────────────────────────────────────────────────

@router.post("/predict", response_model=PredictResponse, tags=["Prediction"])
def predict_impact(req: PredictRequest):
    """
    Predict the impact of a traffic incident.

    Returns closure probability, priority, expected duration, and
    composite impact score (1-10).
    """
    try:
        result = impact_service.predict(req.model_dump())
        return PredictResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.get("/feature-importance", tags=["Prediction"])
def feature_importance():
    """Return feature importances for the closure classifier model."""
    features = impact_service.get_feature_importances()
    if not features:
        raise HTTPException(status_code=503, detail="Feature importances not available")
    return {"features": features}


# ── P2 Heatmap & Spatial ─────────────────────────────────────────────────────

@router.get("/heatmap", tags=["Heatmap"])
def get_heatmap(
    cause: Optional[str] = Query(None, description="Filter by incident cause"),
    time_band: Optional[str] = Query(None, description="early_morning | evening | late_night | off_peak"),
):
    """
    Return impact-weighted KDE heatmap grid for the Leaflet.heat layer.
    """
    try:
        return spatial_service.get_heatmap(cause=cause, time_band=time_band)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/heatmap/point", tags=["Heatmap"])
def get_heatmap_point(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
):
    """Return KDE density score for a single coordinate."""
    try:
        return spatial_service.get_heatmap_point(lat=lat, lon=lon)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/hotspots", tags=["Heatmap"])
def get_hotspots(
    risk_level: Optional[str] = Query(None, description="HIGH | MEDIUM | LOW"),
):
    """Return DBSCAN hotspot clusters as GeoJSON."""
    try:
        return spatial_service.get_hotspots(risk_level=risk_level)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/hotspots/assign", tags=["Heatmap"])
def assign_cluster(
    lat: float = Query(...),
    lon: float = Query(...),
):
    """Assign a coordinate to the nearest DBSCAN cluster."""
    try:
        return spatial_service.assign_cluster(lat=lat, lon=lon)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/corridors/risk", response_model=list[CorridorRiskItem], tags=["Corridors"])
def get_corridors_risk(
    min_events: int = Query(10, description="Minimum events threshold"),
):
    """Return ranked corridor risk table."""
    try:
        return spatial_service.get_corridors_risk(min_events=min_events)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── P4 Anomaly Detection ─────────────────────────────────────────────────────

@router.post("/detect-anomaly", response_model=AnomalyDetectResponse, tags=["Anomaly"])
def detect_anomalies(req: AnomalyDetectRequest):
    """
    Detect anomalies in traffic event data using Isolation Forest.

    Send corridor-hour-event_count data points to check for unusual patterns.
    """
    try:
        data = [d.model_dump() for d in req.data]
        results = anomaly_service.detect(data)
        anomaly_count = sum(1 for r in results if r["is_anomaly"])
        return AnomalyDetectResponse(
            total_points=len(results),
            anomaly_count=anomaly_count,
            results=[AnomalyResult(**r) for r in results],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")


# ── P3 Deployment / Route ────────────────────────────────────────────────────

@router.post("/route", response_model=RouteResponse, tags=["Deployment"])
def get_route_recommendation(req: RouteRequest):
    """
    Generate a deployment recommendation with optional diversion routing.
    """
    try:
        incident = req.model_dump()
        result = deployment_service.recommend(incident)
        return RouteResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Route recommendation error: {e}")
        raise HTTPException(status_code=500, detail=f"Route recommendation failed: {str(e)}")


@router.get("/templates", tags=["Deployment"])
def get_templates():
    """Return all P3 response templates (cause → deployment rules)."""
    return deployment_service.get_templates()
