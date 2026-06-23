"""
EVAC — Anomaly Detection Service (P4 Wrapper)
==============================================
Wraps the existing AnomalyDetector class. Trains on historical baseline
from the CSV at startup, then provides real-time detection.
"""

from __future__ import annotations

import time
from datetime import timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.core.config import settings
from app.core.logging import logger


class AnomalyService:
    """Singleton wrapper around P4 Anomaly Detector."""

    def __init__(self):
        self._model = IsolationForest(contamination=0.05, random_state=42)
        self._is_trained = False
        self._check_count = 0

    def load_and_train(self) -> None:
        """Load CSV data and train the anomaly detector on the first 90 days."""
        csv_path = settings.DATA_DIR / settings.CSV_FILENAME
        logger.info(f"Loading anomaly baseline data from {csv_path}")

        try:
            df = pd.read_csv(csv_path, low_memory=False)
            df["start_datetime"] = pd.to_datetime(df["start_datetime"], errors="coerce")
            df = df.dropna(subset=["start_datetime"]).sort_values("start_datetime")

            # Use first 90 days as baseline
            min_date = df["start_datetime"].min()
            baseline_cutoff = min_date + timedelta(days=90)
            baseline_df = df[df["start_datetime"] < baseline_cutoff].copy()

            baseline_df["hour"] = baseline_df["start_datetime"].dt.hour
            baseline_df["corridor"] = baseline_df["corridor"].fillna("Non-corridor")
            baseline_counts = (
                baseline_df.groupby(["corridor", "hour"])
                .size()
                .reset_index(name="event_count")
            )

            X = baseline_counts[["event_count"]].fillna(0)
            if len(X) > 0:
                self._model.fit(X)
                self._is_trained = True
                logger.info(
                    f"Anomaly detector trained on {len(X)} baseline data points"
                )
            else:
                logger.warning("Empty baseline — anomaly detector not trained")
        except FileNotFoundError:
            logger.warning(f"CSV not found at {csv_path}; anomaly detector disabled")
        except Exception as e:
            logger.error(f"Failed to train anomaly detector: {e}")

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    @property
    def check_count(self) -> int:
        return self._check_count

    def detect(self, data: list[dict]) -> list[dict]:
        """
        Detect anomalies in the provided data points.

        Parameters
        ----------
        data : list of dicts with 'corridor', 'hour', 'event_count'

        Returns
        -------
        list of dicts with added 'is_anomaly' and 'confidence' fields
        """
        if not self._is_trained:
            raise RuntimeError("Anomaly detector not trained")

        df = pd.DataFrame(data)
        X = df[["event_count"]].fillna(0)

        predictions = self._model.predict(X)
        scores = self._model.decision_function(X)

        results = []
        for i, row in df.iterrows():
            # IsolationForest: -1 = anomaly, 1 = normal
            is_anomaly = bool(predictions[i] == -1)
            # Convert decision_function score to a 0-1 confidence
            # More negative = more anomalous
            raw_score = float(scores[i])
            confidence = round(max(0.0, min(1.0, 0.5 - raw_score)), 4)

            results.append({
                "corridor": str(row.get("corridor", "")),
                "hour": int(row.get("hour", 0)),
                "event_count": int(row.get("event_count", 0)),
                "is_anomaly": is_anomaly,
                "confidence": confidence,
            })

        self._check_count += 1
        return results


# Singleton instance
anomaly_service = AnomalyService()
