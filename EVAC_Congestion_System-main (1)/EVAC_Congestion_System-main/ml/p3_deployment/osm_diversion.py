"""
P3 Deployment — OSM Diversion Route Computer
==============================================
Uses OSMnx + NetworkX to compute real detour routes around incident
locations on Bengaluru's actual road network.

Falls back to a geometric detour if OSMnx is unavailable.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Optional

from .config import (
    BENGALURU_BBOX,
    OSM_GRAPH_CACHE,
    INCIDENT_BLOCK_RADIUS_M,
    DEFAULT_SPEED_KMH,
)

# ─── Lazy imports (OSMnx is optional) ────────────────────────────────────────
_G = None  # Cached graph
_osmnx_available = None


def _check_osmnx():
    global _osmnx_available
    if _osmnx_available is None:
        try:
            import osmnx  # noqa: F401
            _osmnx_available = True
        except ImportError:
            _osmnx_available = False
    return _osmnx_available


def _load_graph():
    """Load or download the Bengaluru drive network. Cache as GraphML."""
    global _G
    if _G is not None:
        return _G

    if not _check_osmnx():
        return None

    import osmnx as ox

    cache_path = Path(OSM_GRAPH_CACHE)
    if cache_path.exists():
        print(f"[OSM] Loading cached graph from {cache_path}")
        _G = ox.load_graphml(cache_path)
    else:
        print("[OSM] Downloading Bengaluru drive network (this may take a minute)...")
        _G = ox.graph_from_bbox(
            bbox=(
                BENGALURU_BBOX["north"],
                BENGALURU_BBOX["south"],
                BENGALURU_BBOX["east"],
                BENGALURU_BBOX["west"],
            ),
            network_type="drive",
            simplify=True,
        )
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        ox.save_graphml(_G, cache_path)
        print(f"[OSM] Graph cached at {cache_path}")

    return _G


def compute_diversion(
    lat: float,
    lon: float,
    endlat: float,
    endlon: float,
) -> dict:
    """
    Compute a diversion route around an incident.

    Parameters
    ----------
    lat, lon : Incident start coordinates
    endlat, endlon : Incident end coordinates (extent of blockage)

    Returns
    -------
    dict with keys: status, route_coords, detour_distance_km,
                    direct_distance_km, estimated_time_min, method
    """
    if not _check_osmnx():
        return _geometric_fallback(lat, lon, endlat, endlon)

    try:
        return _osmnx_diversion(lat, lon, endlat, endlon)
    except Exception as e:
        print(f"[OSM] Diversion computation failed: {e}. Using geometric fallback.")
        return _geometric_fallback(lat, lon, endlat, endlon)


def _osmnx_diversion(
    lat: float, lon: float, endlat: float, endlon: float
) -> dict:
    """Compute diversion using OSMnx + NetworkX."""
    import osmnx as ox
    import networkx as nx

    G = _load_graph()
    if G is None:
        return _geometric_fallback(lat, lon, endlat, endlon)

    # ── Find entry/exit nodes upstream/downstream of the incident ─────────
    # The "incident zone" runs from (lat,lon) to (endlat,endlon).
    # We want to route AROUND this zone.
    mid_lat = (lat + endlat) / 2
    mid_lon = (lon + endlon) / 2

    # Find nodes nearest to 300m upstream and downstream of the incident
    incident_bearing = _bearing(lat, lon, endlat, endlon)
    upstream_lat, upstream_lon = _offset_point(
        lat, lon, incident_bearing + 180, 400
    )
    downstream_lat, downstream_lon = _offset_point(
        endlat, endlon, incident_bearing, 400
    )

    try:
        origin_node = ox.nearest_nodes(G, upstream_lon, upstream_lat)
        dest_node = ox.nearest_nodes(G, downstream_lon, downstream_lat)
    except Exception:
        # If nearest_nodes fails (point outside graph), fallback
        return _geometric_fallback(lat, lon, endlat, endlon)

    # ── Remove edges near incident centre ─────────────────────────────────
    G_modified = G.copy()
    nodes_to_block = set()
    for node, data in G_modified.nodes(data=True):
        node_lat = data.get("y", 0)
        node_lon = data.get("x", 0)
        if _haversine_m(mid_lat, mid_lon, node_lat, node_lon) < INCIDENT_BLOCK_RADIUS_M:
            nodes_to_block.add(node)

    # Remove all edges connected to blocked nodes
    edges_to_remove = []
    for u, v, k in G_modified.edges(keys=True):
        if u in nodes_to_block or v in nodes_to_block:
            edges_to_remove.append((u, v, k))
    G_modified.remove_edges_from(edges_to_remove)

    # ── Compute shortest path on modified graph ───────────────────────────
    try:
        path = nx.shortest_path(G_modified, origin_node, dest_node, weight="length")
    except nx.NetworkXNoPath:
        return _geometric_fallback(lat, lon, endlat, endlon)

    # ── Extract coordinates and distance ──────────────────────────────────
    route_coords = []
    total_length_m = 0
    for i, node in enumerate(path):
        ndata = G_modified.nodes[node]
        route_coords.append([ndata["y"], ndata["x"]])
        if i > 0:
            prev = G_modified.nodes[path[i - 1]]
            total_length_m += _haversine_m(
                prev["y"], prev["x"], ndata["y"], ndata["x"]
            )

    direct_dist_m = _haversine_m(lat, lon, endlat, endlon)
    detour_km = round(total_length_m / 1000, 2)
    direct_km = round(direct_dist_m / 1000, 2)
    est_time_min = round((total_length_m / 1000) / DEFAULT_SPEED_KMH * 60, 1)

    return {
        "status": "ok",
        "method": "osmnx_shortest_path",
        "route_coords": route_coords,
        "n_waypoints": len(route_coords),
        "detour_distance_km": detour_km,
        "direct_distance_km": direct_km,
        "extra_distance_km": round(detour_km - direct_km, 2),
        "estimated_time_min": est_time_min,
        "blocked_nodes": len(nodes_to_block),
        "blocked_edges": len(edges_to_remove),
    }


def _geometric_fallback(
    lat: float, lon: float, endlat: float, endlon: float
) -> dict:
    """
    Simple geometric detour when OSMnx is unavailable.
    Creates a 3-waypoint bypass offset perpendicular to the incident axis.
    """
    if lat == 0 or lon == 0 or endlat == 0 or endlon == 0:
        return {"status": "no_coordinates", "method": "none", "route_coords": []}

    mid_lat = (lat + endlat) / 2
    mid_lon = (lon + endlon) / 2
    bearing = _bearing(lat, lon, endlat, endlon)

    # Offset perpendicular (90 degrees) by ~500m
    offset_distance = 500  # metres
    perp_bearing = (bearing + 90) % 360

    wp1_lat, wp1_lon = _offset_point(lat, lon, perp_bearing, offset_distance)
    wp2_lat, wp2_lon = _offset_point(mid_lat, mid_lon, perp_bearing, offset_distance * 1.2)
    wp3_lat, wp3_lon = _offset_point(endlat, endlon, perp_bearing, offset_distance)

    # Upstream entry + bypass waypoints + downstream exit
    upstream_lat, upstream_lon = _offset_point(lat, lon, bearing + 180, 200)
    downstream_lat, downstream_lon = _offset_point(endlat, endlon, bearing, 200)

    route_coords = [
        [upstream_lat, upstream_lon],
        [wp1_lat, wp1_lon],
        [wp2_lat, wp2_lon],
        [wp3_lat, wp3_lon],
        [downstream_lat, downstream_lon],
    ]

    direct_dist_m = _haversine_m(lat, lon, endlat, endlon)
    # Approximate detour distance
    detour_m = sum(
        _haversine_m(route_coords[i][0], route_coords[i][1],
                     route_coords[i+1][0], route_coords[i+1][1])
        for i in range(len(route_coords) - 1)
    )

    return {
        "status": "ok",
        "method": "geometric_fallback",
        "route_coords": route_coords,
        "n_waypoints": len(route_coords),
        "detour_distance_km": round(detour_m / 1000, 2),
        "direct_distance_km": round(direct_dist_m / 1000, 2),
        "extra_distance_km": round((detour_m - direct_dist_m) / 1000, 2),
        "estimated_time_min": round((detour_m / 1000) / DEFAULT_SPEED_KMH * 60, 1),
        "blocked_nodes": 0,
        "blocked_edges": 0,
    }


# ─── Geo helpers ──────────────────────────────────────────────────────────────

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in metres."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2)
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from point 1 to point 2, in degrees [0, 360)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lon2 - lon1)
    x = math.sin(dlam) * math.cos(phi2)
    y = (math.cos(phi1) * math.sin(phi2)
         - math.sin(phi1) * math.cos(phi2) * math.cos(dlam))
    theta = math.atan2(x, y)
    return (math.degrees(theta) + 360) % 360


def _offset_point(
    lat: float, lon: float, bearing_deg: float, distance_m: float
) -> tuple[float, float]:
    """Move from (lat, lon) along bearing by distance_m. Returns (lat2, lon2)."""
    R = 6_371_000
    d = distance_m / R
    brng = math.radians(bearing_deg)
    phi1 = math.radians(lat)
    lam1 = math.radians(lon)

    phi2 = math.asin(
        math.sin(phi1) * math.cos(d)
        + math.cos(phi1) * math.sin(d) * math.cos(brng)
    )
    lam2 = lam1 + math.atan2(
        math.sin(brng) * math.sin(d) * math.cos(phi1),
        math.cos(d) - math.sin(phi1) * math.sin(phi2),
    )
    return math.degrees(phi2), math.degrees(lam2)
