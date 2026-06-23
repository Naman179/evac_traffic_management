
"""spatial_service.py — P2 artefact loader and query functions."""
from pathlib import Path
import json, os
import numpy as np
import joblib

MODEL_DIR = Path(os.environ.get('EVAC_MODEL_DIR',
    Path(__file__).parent.parent.parent.parent / 'ml' / 'models'))

# ─── Load artefacts once at startup ─────────────────────────────────────────
_kde_grids   = np.load(MODEL_DIR / 'kde_grid.npz')
_kde_live    = joblib.load(MODEL_DIR / 'kde_model.joblib')
_dbscan_pkg  = joblib.load(MODEL_DIR / 'dbscan_model.joblib')
_cluster_stats = _dbscan_pkg['cluster_stats']
_eps_rad     = float(_dbscan_pkg['eps_rad'])
_train_coords = _dbscan_pkg['train_coords_rad']

with open(MODEL_DIR / 'corridor_risk_scores.json') as f:
    _corridor_data = json.load(f)
with open(MODEL_DIR / 'hotspot_zones.geojson') as f:
    _hotspot_geojson = json.load(f)
with open(MODEL_DIR / 'p2_metadata.json') as f:
    _metadata = json.load(f)

_VALID_CAUSES    = set(_metadata['kde']['causes'])
_VALID_TIMEBANDS = set(_metadata['kde']['time_bands'])
_EARTH_RADIUS    = 6371000.0

# ─── API functions ───────────────────────────────────────────────────────────

def get_heatmap(cause: str = None, time_band: str = None) -> dict:
    """
    Returns a Leaflet.heat-compatible payload:
    {"lat_grid": [...], "lon_grid": [...], "intensity": [[...], ...]}
    """
    if cause and cause in _VALID_CAUSES:
        key = f'kde_cause_{cause.replace(" ","_")}'
        grid = _kde_grids.get(key, _kde_grids['kde_full'])
    elif time_band and time_band in _VALID_TIMEBANDS:
        key = f'kde_{time_band}'
        grid = _kde_grids.get(key, _kde_grids['kde_full'])
    else:
        grid = _kde_grids['kde_full']

    return {
        'lat_grid':  _kde_grids['lat_grid'].tolist(),
        'lon_grid':  _kde_grids['lon_grid'].tolist(),
        'intensity': grid.tolist(),
        'filter_applied': {'cause': cause, 'time_band': time_band},
    }


def get_heatmap_point(lat: float, lon: float) -> dict:
    """
    Returns the live KDE density score for a single coordinate.
    Used when a new incident is logged to show how hot that spot already is.
    """
    density = float(_kde_live(np.array([[lat], [lon]]))[0])
    # Normalise against training max for a 0-1 output
    train_max = float(_kde_live(_train_coords[:, :100].T).max()) if len(_train_coords) > 0 else 1.0
    return {'lat': lat, 'lon': lon, 'density_score': round(min(density / max(train_max, 1e-10), 1.0), 4)}


def get_hotspots(risk_level: str = None) -> dict:
    """
    Returns DBSCAN clusters as GeoJSON, optionally filtered by risk level.
    """
    if risk_level:
        features = [
            f for f in _hotspot_geojson['features']
            if f['properties']['risk_level'] == risk_level.upper()
        ]
    else:
        features = _hotspot_geojson['features']
    return {'type': 'FeatureCollection', 'features': features,
            'metadata': _hotspot_geojson['metadata']}


def get_corridors_risk(min_events: int = 10) -> list:
    """
    Returns ranked corridor risk table.
    min_events filters out thin corridors below this threshold.
    """
    return [
        c for c in _corridor_data['corridors']
        if c['event_count'] >= min_events
    ]


def assign_cluster(lat: float, lon: float) -> dict:
    """
    Given a new incident coordinate, returns the nearest DBSCAN cluster
    (if within eps) or flags it as unclustered.
    Used by P3 to attach spatial risk context to a new deployment request.
    """
    point_rad = np.radians([[lat, lon]])
    from sklearn.metrics import pairwise_distances
    dists = pairwise_distances(point_rad, _train_coords, metric='haversine')[0]
    min_idx = int(np.argmin(dists))
    min_dist_m = float(dists[min_idx] * _EARTH_RADIUS)
    if min_dist_m > _eps_rad * _EARTH_RADIUS * 2:
        return {'cluster_id': -1, 'risk_level': 'UNKNOWN', 'distance_to_nearest_m': round(min_dist_m, 1)}
    # Look up cluster_stats for this training point — use the stored dbscan labels
    # (simplified: return nearest cluster centroid)
    near_clusters = _cluster_stats[
        ((_cluster_stats['centroid_lat'] - lat).abs() < 0.05) &
        ((_cluster_stats['centroid_lon'] - lon).abs() < 0.05)
    ]
    if len(near_clusters) == 0:
        return {'cluster_id': -1, 'risk_level': 'LOW', 'distance_to_nearest_m': round(min_dist_m, 1)}
    near_clusters = near_clusters.copy()
    near_clusters['temp_dist'] = (near_clusters['centroid_lat'] - lat).abs() + (near_clusters['centroid_lon'] - lon).abs()
    nearest = near_clusters.nsmallest(1, 'temp_dist').iloc[0]
    return {
        'cluster_id':   int(nearest['cluster_id']),
        'risk_level':   str(nearest['risk_level']),
        'mean_impact':  float(nearest['mean_impact']),
        'closure_rate': float(nearest['closure_rate']),
        'distance_to_nearest_m': round(min_dist_m, 1),
    }
