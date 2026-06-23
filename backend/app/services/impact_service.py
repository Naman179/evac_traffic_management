"""
EVAC — Impact Prediction Service (P1 Wrapper)
==============================================
Wraps the existing impact_service.py module, loading models once at startup.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from app.core.config import settings
from app.core.logging import logger


class ImpactService:
    """Singleton wrapper around P1 Impact Forecaster models."""

    def __init__(self):
        self._loaded = False
        self._closure_clf = None
        self._priority_clf = None
        self._dur_p50 = None
        self._dur_p90 = None
        self._te_cl = None
        self._te_pri = None
        self._te_dur = None
        self._fb = None
        self._meta = None
        self._prediction_count = 0
        self._total_latency_ms = 0.0

    def load_models(self) -> None:
        """Load all P1 models from disk. Called once at startup."""
        model_dir = settings.MODEL_DIR
        logger.info(f"Loading P1 impact models from {model_dir}")

        try:
            self._closure_clf = joblib.load(model_dir / "closure_classifier.joblib")
            self._priority_clf = joblib.load(model_dir / "priority_classifier.joblib")
            self._dur_p50 = joblib.load(model_dir / "duration_p50.joblib")
            self._dur_p90 = joblib.load(model_dir / "duration_p90.joblib")
            self._te_cl = joblib.load(model_dir / "target_encoder_closure.joblib")
            self._te_pri = joblib.load(model_dir / "target_encoder_priority.joblib")
            self._te_dur = joblib.load(model_dir / "target_encoder_duration.joblib")
            self._fb = json.loads((model_dir / "duration_fallback.json").read_text())
            self._meta = json.loads((model_dir / "metadata.json").read_text())
            self._loaded = True
            logger.info("P1 impact models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load P1 models: {e}")
            self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def prediction_count(self) -> int:
        return self._prediction_count

    @property
    def avg_latency_ms(self) -> float:
        if self._prediction_count == 0:
            return 0.0
        return self._total_latency_ms / self._prediction_count

    def predict(self, req: dict) -> dict:
        """
        Run P1 impact prediction. Mirrors the original
        impact_service.predict_impact_from_request() logic exactly.
        """
        if not self._loaded:
            raise RuntimeError("P1 models not loaded")

        start = time.perf_counter()

        meta = self._meta
        CAT = meta["features"]["categorical"]
        ALL = meta["features"]["all"]
        HC = meta["features"]["high_card_col"]
        W = meta["impact_weights"]
        fb = self._fb
        LOGP95 = fb["duration_log_p95"]
        FBC = set(fb["fallback_causes"])
        CM = fb["cause_medians"]
        GM = fb["global_median_h"]
        THR = fb["closure_threshold"]

        def _n(s, d):
            if s is None:
                return d
            s = str(s).lower().strip()
            return s if s else d

        def _enc(te, X):
            Xe = te.transform(X).rename(columns={HC: f"{HC}_te"})
            Xe[HC] = X[HC].values
            for c in CAT:
                Xe[c] = Xe[c].astype("category")
            return Xe

        def _floor(p50):
            return 6 if p50 > 12 else (4 if p50 > 6 else 1)

        ts = pd.to_datetime(req.get("start_datetime"))
        row = {
            "cause_cat": _n(req.get("cause"), "unknown"),
            "corridor_cat": _n(req.get("corridor"), "no_corridor"),
            "zone_cat": _n(req.get("zone"), "no_zone"),
            "veh_type_cat": _n(req.get("veh_type"), "not_applicable"),
            "police_station_cat": _n(req.get("police_station"), "unknown"),
            "hour": ts.hour if pd.notna(ts) else 12,
            "dow": ts.dayofweek if pd.notna(ts) else 0,
            "month": ts.month if pd.notna(ts) else 1,
            "is_weekend": int(ts.dayofweek >= 5) if pd.notna(ts) else 0,
            "is_morning_peak": int(4 <= ts.hour <= 7) if pd.notna(ts) else 0,
            "is_evening_peak": int(19 <= ts.hour <= 22) if pd.notna(ts) else 0,
            "is_midday_quiet": int(12 <= ts.hour <= 16) if pd.notna(ts) else 0,
            "is_planned": int(req.get("is_planned", False)),
            "lat": float(req.get("lat") or 0.0),
            "lon": float(req.get("lon") or 0.0),
        }

        X = pd.DataFrame([row])[ALL]
        for c in CAT:
            X[c] = X[c].astype("category")

        cl = float(self._closure_clf.predict_proba(_enc(self._te_cl, X))[0, 1])
        pr = float(self._priority_clf.predict_proba(_enc(self._te_pri, X))[0, 1])

        cause = row["cause_cat"]
        if cause in FBC:
            p50 = CM.get(cause, GM)
            p90 = p50 * 2
        else:
            Xdu = _enc(self._te_dur, X)
            p50 = float(np.expm1(self._dur_p50.predict(Xdu)[0]))
            p90 = float(np.expm1(self._dur_p90.predict(Xdu)[0]))

        dn = min(max(np.log1p(p50) / LOGP95, 0), 1)
        base = round(1 + 9 * (W["priority"] * pr + W["closure"] * cl + W["duration"] * dn))
        score = int(np.clip(max(base, _floor(p50)), 1, 10))

        elapsed_ms = (time.perf_counter() - start) * 1000
        self._prediction_count += 1
        self._total_latency_ms += elapsed_ms

        return {
            "closure_probability": round(cl, 4),
            "closure_decision": bool(cl >= THR),
            "closure_threshold": THR,
            "priority_high_probability": round(pr, 4),
            "expected_duration_h": round(p50, 2),
            "expected_duration_p90_h": round(p90, 2),
            "composite_impact_score": score,
        }

    def get_feature_importances(self) -> dict:
        """Return model feature importances for the UI chart."""
        if not self._loaded:
            return {}
        try:
            base = self._closure_clf.calibrated_classifiers_[0].estimator
        except Exception:
            base = getattr(self._closure_clf, "estimator", None)
        if base is None or not hasattr(base, "feature_importances_"):
            return {}
        ALL = self._meta["features"]["all"]
        names = list(self._te_cl.transform(pd.DataFrame([{c: "x" for c in ALL}])).columns)
        return dict(sorted(zip(names, base.feature_importances_.tolist()), key=lambda kv: -kv[1]))


# Singleton instance
impact_service = ImpactService()
