
"""impact_service.py v3 — leak-fixed P1 artifacts."""
from pathlib import Path
import json, os
import numpy as np
import pandas as pd
import joblib

MODEL_DIR = Path(os.environ.get("EVAC_MODEL_DIR",
    Path(__file__).parent.parent.parent.parent / "ml" / "models"))

_closure_clf  = joblib.load(MODEL_DIR/"closure_classifier.joblib")
_priority_clf = joblib.load(MODEL_DIR/"priority_classifier.joblib")
_dur_p50      = joblib.load(MODEL_DIR/"duration_p50.joblib")
_dur_p90      = joblib.load(MODEL_DIR/"duration_p90.joblib")
_te_cl        = joblib.load(MODEL_DIR/"target_encoder_closure.joblib")
_te_pri       = joblib.load(MODEL_DIR/"target_encoder_priority.joblib")
_te_dur       = joblib.load(MODEL_DIR/"target_encoder_duration.joblib")
_fb   = json.loads((MODEL_DIR/"duration_fallback.json").read_text())
_meta = json.loads((MODEL_DIR/"metadata.json").read_text())

_CAT=_meta["features"]["categorical"]; _ALL=_meta["features"]["all"]
_HC=_meta["features"]["high_card_col"]; _W=_meta["impact_weights"]
_LOGP95=_fb["duration_log_p95"]; _FBC=set(_fb["fallback_causes"])
_CM=_fb["cause_medians"]; _GM=_fb["global_median_h"]; _THR=_fb["closure_threshold"]

def _enc(te,X):
    Xe=te.transform(X).rename(columns={_HC:f"{_HC}_te"}); Xe[_HC]=X[_HC].values
    for c in _CAT: Xe[c]=Xe[c].astype("category")
    return Xe
def _n(s,d):
    if s is None: return d
    s=str(s).lower().strip(); return s if s else d
def _floor(p50): return 6 if p50>12 else (4 if p50>6 else 1)

def predict_impact_from_request(req: dict) -> dict:
    ts=pd.to_datetime(req.get("start_datetime"))
    row={"cause_cat":_n(req.get("cause"),"unknown"),"corridor_cat":_n(req.get("corridor"),"no_corridor"),
        "zone_cat":_n(req.get("zone"),"no_zone"),"veh_type_cat":_n(req.get("veh_type"),"not_applicable"),
        "police_station_cat":_n(req.get("police_station"),"unknown"),
        "hour":ts.hour if pd.notna(ts) else 12,"dow":ts.dayofweek if pd.notna(ts) else 0,
        "month":ts.month if pd.notna(ts) else 1,"is_weekend":int(ts.dayofweek>=5) if pd.notna(ts) else 0,
        "is_morning_peak":int(4<=ts.hour<=7) if pd.notna(ts) else 0,
        "is_evening_peak":int(19<=ts.hour<=22) if pd.notna(ts) else 0,
        "is_midday_quiet":int(12<=ts.hour<=16) if pd.notna(ts) else 0,
        "is_planned":int(req.get("is_planned",False)),
        "lat":float(req.get("lat") or 0.0),"lon":float(req.get("lon") or 0.0)}
    X=pd.DataFrame([row])[_ALL]
    for c in _CAT: X[c]=X[c].astype("category")
    cl=float(_closure_clf.predict_proba(_enc(_te_cl,X))[0,1])
    pr=float(_priority_clf.predict_proba(_enc(_te_pri,X))[0,1])
    cause=row["cause_cat"]
    if cause in _FBC:
        p50=_CM.get(cause,_GM); p90=p50*2
    else:
        Xdu=_enc(_te_dur,X); p50=float(np.expm1(_dur_p50.predict(Xdu)[0])); p90=float(np.expm1(_dur_p90.predict(Xdu)[0]))
    dn=min(max(np.log1p(p50)/_LOGP95,0),1)
    base=round(1+9*(_W["priority"]*pr+_W["closure"]*cl+_W["duration"]*dn))
    score=int(np.clip(max(base,_floor(p50)),1,10))
    return {"closure_probability":round(cl,4),"closure_decision":bool(cl>=_THR),"closure_threshold":_THR,
        "priority_high_probability":round(pr,4),"expected_duration_h":round(p50,2),
        "expected_duration_p90_h":round(p90,2),"composite_impact_score":score}

def get_feature_importances() -> dict:
    """For the UI feature-importance chart."""
    try:
        base=_closure_clf.calibrated_classifiers_[0].estimator
    except Exception:
        base=getattr(_closure_clf,"estimator",None)
    if base is None or not hasattr(base,"feature_importances_"): return {}
    names=list(_te_cl.transform(pd.DataFrame([{c:"x" for c in _ALL}])).columns)
    return dict(sorted(zip(names,base.feature_importances_.tolist()),key=lambda kv:-kv[1]))
