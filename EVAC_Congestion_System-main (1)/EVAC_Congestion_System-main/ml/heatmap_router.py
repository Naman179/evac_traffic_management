
"""heatmap.py — P2 FastAPI router."""
from fastapi import APIRouter, Query
from typing import Optional
from app.services.spatial_service import (
    get_heatmap, get_heatmap_point, get_hotspots, get_corridors_risk, assign_cluster
)

router = APIRouter(prefix='/heatmap', tags=['heatmap'])
corridor_router = APIRouter(prefix='/corridors', tags=['corridors'])
hotspot_router  = APIRouter(prefix='/hotspots',  tags=['hotspots'])


@router.get('/')
def heatmap(
    cause:     Optional[str] = Query(None, description='Filter by incident cause'),
    time_band: Optional[str] = Query(None, description='early_morning | evening | late_night | off_peak'),
):
    """
    Returns impact-weighted KDE heatmap grid for the Leaflet.heat layer.
    Optional filters: cause and time_band.
    Defaults to full-dataset heatmap.
    """
    return get_heatmap(cause=cause, time_band=time_band)


@router.get('/point')
def heatmap_point(
    lat: float = Query(..., description='Latitude of new incident'),
    lon: float = Query(..., description='Longitude of new incident'),
):
    """Returns KDE density score for a single coordinate (for P1 incident form preview)."""
    return get_heatmap_point(lat=lat, lon=lon)


@hotspot_router.get('/')
def hotspots(risk_level: Optional[str] = Query(None, description='HIGH | MEDIUM | LOW')):
    """Returns DBSCAN clusters as GeoJSON FeatureCollection."""
    return get_hotspots(risk_level=risk_level)


@hotspot_router.get('/assign')
def assign(
    lat: float = Query(...),
    lon: float = Query(...),
):
    """Given a coordinate, returns the nearest cluster and its risk profile (for P3)."""
    return assign_cluster(lat=lat, lon=lon)


@corridor_router.get('/risk')
def corridors_risk(
    min_events: int = Query(10, description='Exclude corridors with fewer than this many events')
):
    """Returns ranked corridor risk table consumed by P3 deployment engine."""
    return get_corridors_risk(min_events=min_events)
