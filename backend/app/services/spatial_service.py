"""
EVAC — Spatial / Heatmap Service (P2 Wrapper)
==============================================
Wraps the existing spatial_service.py module, loading KDE/DBSCAN artefacts once.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np

from app.core.config import settings
from app.core.logging import logger


class SpatialService:
    """Singleton wrapper around P2 spatial artefacts."""

    def __init__(self):
        self._loaded = False
        self._kde_grids = None
        self._kde_live = None
        self._dbscan_pkg = None
        self._cluster_stats = None
        self._eps_rad = 0.0
        self._train_coords = None
        self._corridor_data = None
        self._hotspot_geojson = None
        self._metadata = None
        self._VALID_CAUSES = set()
        self._VALID_TIMEBANDS = set()

    def load_models(self) -> None:
        """Load all P2 artefacts from disk."""
        model_dir = settings.MODEL_DIR
        logger.info(f"Loading P2 spatial artefacts from {model_dir}")

        try:
            self._kde_grids = np.load(model_dir / "kde_grid.npz")
            self._kde_live = joblib.load(model_dir / "kde_model.joblib")
            self._dbscan_pkg = joblib.load(model_dir / "dbscan_model.joblib")
            self._cluster_stats = self._dbscan_pkg["cluster_stats"]
            self._eps_rad = float(self._dbscan_pkg["eps_rad"])
            self._train_coords = self._dbscan_pkg["train_coords_rad"]

            with open(model_dir / "corridor_risk_scores.json") as f:
                self._corridor_data = json.load(f)
            with open(model_dir / "hotspot_zones.geojson") as f:
                self._hotspot_geojson = json.load(f)
            with open(model_dir / "p2_metadata.json") as f:
                self._metadata = json.load(f)

            self._VALID_CAUSES = set(self._metadata["kde"]["causes"])
            self._VALID_TIMEBANDS = set(self._metadata["kde"]["time_bands"])
            self._loaded = True
            logger.info("P2 spatial artefacts loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load P2 artefacts: {e}")
            self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def get_heatmap(self, cause: str = None, time_band: str = None) -> dict:
        """Return KDE heatmap grid (Leaflet.heat compatible)."""
        if not self._loaded:
            raise RuntimeError("P2 artefacts not loaded")

        if cause and cause in self._VALID_CAUSES:
            key = f'kde_cause_{cause.replace(" ", "_")}'
            grid = self._kde_grids.get(key, self._kde_grids["kde_full"])
        elif time_band and time_band in self._VALID_TIMEBANDS:
            key = f"kde_{time_band}"
            grid = self._kde_grids.get(key, self._kde_grids["kde_full"])
        else:
            grid = self._kde_grids["kde_full"]

        return {
            "lat_grid": self._kde_grids["lat_grid"].tolist(),
            "lon_grid": self._kde_grids["lon_grid"].tolist(),
            "intensity": grid.tolist(),
            "filter_applied": {"cause": cause, "time_band": time_band},
        }

    def get_heatmap_point(self, lat: float, lon: float) -> dict:
        """Return KDE density score for a single coordinate."""
        if not self._loaded:
            raise RuntimeError("P2 artefacts not loaded")

        density = float(self._kde_live(np.array([[lat], [lon]]))[0])
        train_max = (
            float(self._kde_live(self._train_coords[:, :100].T).max())
            if len(self._train_coords) > 0
            else 1.0
        )
        return {
            "lat": lat,
            "lon": lon,
            "density_score": round(min(density / max(train_max, 1e-10), 1.0), 4),
        }

    def get_hotspots(self, risk_level: str = None) -> dict:
        """Return DBSCAN clusters as GeoJSON, optionally filtered."""
        if not self._loaded:
            raise RuntimeError("P2 artefacts not loaded")

        if risk_level:
            features = [
                f
                for f in self._hotspot_geojson["features"]
                if f["properties"]["risk_level"] == risk_level.upper()
            ]
        else:
            features = self._hotspot_geojson["features"]

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": self._hotspot_geojson.get("metadata", {}),
        }

    def get_corridors_risk(self, min_events: int = 10) -> list:
        """Return ranked corridor risk table."""
        if not self._loaded:
            raise RuntimeError("P2 artefacts not loaded")

        return [
            c
            for c in self._corridor_data["corridors"]
            if c["event_count"] >= min_events
        ]

    def assign_cluster(self, lat: float, lon: float) -> dict:
        """Assign a coordinate to the nearest DBSCAN cluster."""
        if not self._loaded:
            raise RuntimeError("P2 artefacts not loaded")

        from sklearn.metrics import pairwise_distances

        EARTH_RADIUS = 6371000.0
        point_rad = np.radians([[lat, lon]])
        dists = pairwise_distances(point_rad, self._train_coords, metric="haversine")[0]
        min_idx = int(np.argmin(dists))
        min_dist_m = float(dists[min_idx] * EARTH_RADIUS)

        if min_dist_m > self._eps_rad * EARTH_RADIUS * 2:
            return {
                "cluster_id": -1,
                "risk_level": "UNKNOWN",
                "distance_to_nearest_m": round(min_dist_m, 1),
            }

        near_clusters = self._cluster_stats[
            ((self._cluster_stats["centroid_lat"] - lat).abs() < 0.05)
            & ((self._cluster_stats["centroid_lon"] - lon).abs() < 0.05)
        ]

        if len(near_clusters) == 0:
            return {
                "cluster_id": -1,
                "risk_level": "LOW",
                "distance_to_nearest_m": round(min_dist_m, 1),
            }

        near_clusters = near_clusters.copy()
        near_clusters["temp_dist"] = (
            (near_clusters["centroid_lat"] - lat).abs()
            + (near_clusters["centroid_lon"] - lon).abs()
        )
        nearest = near_clusters.nsmallest(1, "temp_dist").iloc[0]
        return {
            "cluster_id": int(nearest["cluster_id"]),
            "risk_level": str(nearest["risk_level"]),
            "mean_impact": float(nearest["mean_impact"]),
            "closure_rate": float(nearest["closure_rate"]),
            "distance_to_nearest_m": round(min_dist_m, 1),
        }

    def get_corridor_risk_lookup(self) -> dict:
        """Return corridor risk as a lookup dict (for P3 integration)."""
        if not self._loaded:
            return {}
        lookup = {}
        for entry in self._corridor_data.get("corridors", []):
            key = str(entry["corridor"]).lower().strip()
            lookup[key] = entry
        return lookup


# Singleton instance
spatial_service = SpatialService()
