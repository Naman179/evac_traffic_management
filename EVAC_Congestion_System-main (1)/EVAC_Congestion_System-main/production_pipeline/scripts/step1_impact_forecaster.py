# ─── Setup ─────────────────────────────────────────────────────
from pathlib import Path
import json, os, warnings
from datetime import datetime
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import StratifiedKFold, KFold, RandomizedSearchCV
from sklearn.metrics import (roc_auc_score, average_precision_score,
    f1_score, precision_recall_curve, mean_absolute_error,
    median_absolute_error, r2_score)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import cross_val_score
import lightgbm as lgb
import category_encoders as ce
import joblib

# ═══════════════ EDIT THIS BLOCK ═══════════════
DATA_PATH = Path("../../data/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv")
MODEL_DIR = Path("../models")

COLUMNS = {
    "cause": "event_cause", "event_type": "event_type",
    "corridor": "corridor", "zone": "zone", "junction": "junction",
    "police_station": "police_station", "priority": "priority",
    "requires_road_closure": "requires_road_closure", "status": "status",
    "start_dt": "start_datetime", "closed_dt": "closed_datetime",
    "resolved_dt": "resolved_datetime", "veh_type": "veh_type",
    "lat": "latitude", "lon": "longitude",
    "end_lat": "endlatitude", "end_lon": "endlongitude",
}
PLANNED_CAUSES = {"planned_event","public_event","vip_movement","rally","festival","procession","protest"}
RANDOM_STATE = 42
N_FOLDS = 5
# ═══════════════════════════════════════════════

MODEL_DIR.mkdir(exist_ok=True)
plt.rcParams["figure.dpi"] = 110
sns.set_style("whitegrid")
pd.set_option("display.max_columns", 50)
print(f"LightGBM {lgb.__version__}")

# ─── Load ──────────────────────────────────────────────────────
df_raw = pd.read_csv(DATA_PATH, low_memory=False)
print(f"Loaded {len(df_raw):,} rows × {df_raw.shape[1]} cols")
def col(key):
    name = COLUMNS.get(key, key)
    return name if name in df_raw.columns else None
missing = [k for k,v in COLUMNS.items() if v not in df_raw.columns]
print("✓ All columns present" if not missing else f"⚠️  Missing: {missing}")

# ─── Leak audit on end-coordinates ───────────────────────────
end_lat = df_raw[col("end_lat")].replace(0.0, np.nan)
end_lon = df_raw[col("end_lon")].replace(0.0, np.nan)
has_end = (end_lat.notna() & end_lon.notna())
closure = df_raw[col("requires_road_closure")].astype(int)

print("── END-COORDINATE LEAK AUDIT ──")
print(f"Closure rate WHEN end coords present: {closure[has_end].mean()*100:.1f}%")
print(f"Closure rate WHEN end coords absent:  {closure[~has_end].mean()*100:.1f}%")
print(f"Fraction of closure events with end coords:     {(has_end & (closure==1)).sum()/max((closure==1).sum(),1)*100:.1f}%")
print(f"Fraction of NON-closure events with end coords: {(has_end & (closure==0)).sum()/max((closure==0).sum(),1)*100:.1f}%")
print()
if abs(closure[has_end].mean() - closure[~has_end].mean()) > 0.3:
    print("🚨 LEAK CONFIRMED: end coords are post-hoc. EXCLUDED from classifiers.")
else:
    print("✓ No strong leak detected from end coords.")

# ─── Feature engineering ─────────────────────────────────────
df = df_raw.copy()
start_c = col("start_dt")
df["_start_dt"] = pd.to_datetime(df[start_c], errors="coerce", utc=True).dt.tz_localize(None)
df["hour"]            = df["_start_dt"].dt.hour.fillna(12).astype(int)
df["dow"]             = df["_start_dt"].dt.dayofweek.fillna(0).astype(int)
df["month"]           = df["_start_dt"].dt.month.fillna(1).astype(int)
df["is_weekend"]      = (df["dow"]>=5).astype(int)
df["is_morning_peak"] = df["hour"].between(4,7).astype(int)
df["is_evening_peak"] = df["hour"].between(19,22).astype(int)
df["is_midday_quiet"] = df["hour"].between(12,16).astype(int)

et_c, cause_c = col("event_type"), col("cause")
if et_c:
    df["is_planned"] = df[et_c].astype(str).str.lower().str.strip().isin({"planned","scheduled"}).astype(int)
else:
    df["is_planned"] = df[cause_c].astype(str).str.lower().str.strip().isin(PLANNED_CAUSES).astype(int)

def _clean(s, d): return s.fillna(d).astype(str).str.lower().str.strip().replace("", d)
df["cause_cat"]          = _clean(df[cause_c], "unknown")             if cause_c else "unknown"
df["corridor_cat"]       = _clean(df[col("corridor")], "no_corridor") if col("corridor") else "no_corridor"
df["zone_cat"]           = _clean(df[col("zone")], "no_zone")         if col("zone") else "no_zone"
df["veh_type_cat"]       = _clean(df[col("veh_type")], "not_applicable") if col("veh_type") else "not_applicable"
df["police_station_cat"] = _clean(df[col("police_station")], "unknown") if col("police_station") else "unknown"

lat_c, lon_c = col("lat"), col("lon")
df["lat"] = df[lat_c].astype(float) if lat_c else 0.0
df["lon"] = df[lon_c].astype(float) if lon_c else 0.0

# Categorical + numeric features — NO end-coordinate fields (leak removed)
CATEGORICAL_FEATURES = ["cause_cat","corridor_cat","zone_cat","veh_type_cat","police_station_cat"]
NUMERIC_FEATURES = ["hour","dow","month","is_weekend",
                    "is_morning_peak","is_evening_peak","is_midday_quiet",
                    "is_planned","lat","lon"]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES

X_all = df[ALL_FEATURES].copy()
for c in CATEGORICAL_FEATURES: X_all[c] = X_all[c].astype("category")

print(f"Feature matrix: {X_all.shape}  (end-coord features intentionally excluded)")
for c in CATEGORICAL_FEATURES:
    print(f"  {c:22s} {X_all[c].nunique():>4} unique")

closure_c, priority_c = col("requires_road_closure"), col("priority")
def to_bool(s):
    if pd.api.types.is_bool_dtype(s): return s.fillna(False).astype(int)
    return s.astype(str).str.lower().str.strip().isin({"true","yes","1","y","t"}).astype(int)
y_closure  = to_bool(df[closure_c])
y_priority = (df[priority_c].astype(str).str.strip().str.title()=="High").astype(int)
print(f"Closure positive rate: {y_closure.mean()*100:.2f}%")
print(f"Priority High rate:    {y_priority.mean()*100:.2f}%")

# Leak sanity check: cause alone -> closure
le = LabelEncoder()
X_cause_only = le.fit_transform(df["cause_cat"]).reshape(-1,1)
cause_auc = cross_val_score(HistGradientBoostingClassifier(random_state=RANDOM_STATE),
                            X_cause_only, y_closure, cv=5, scoring="roc_auc").mean()
print(f"\n=== SANITY CHECK: closure AUC from CAUSE ALONE = {cause_auc:.4f} ===")
print("    Full model should beat this by a few points, NOT by 0.27.")

HIGH_CARD_COL = "corridor_cat"

def cv_oof(X, y, model_factory, te_col=HIGH_CARD_COL, n_folds=N_FOLDS):
    """Out-of-fold predictions; target encoder refit per fold (no leak)."""
    skf = StratifiedKFold(n_folds, shuffle=True, random_state=RANDOM_STATE)
    oof = np.zeros(len(X)); aucs=[]
    for k,(tr,val) in enumerate(skf.split(X,y)):
        Xtr, Xv = X.iloc[tr].copy(), X.iloc[val].copy()
        ytr, yv = y.iloc[tr], y.iloc[val]
        te = ce.TargetEncoder(cols=[te_col], smoothing=20.0)
        Xtr_e = te.fit_transform(Xtr, ytr).rename(columns={te_col:f"{te_col}_te"})
        Xv_e  = te.transform(Xv).rename(columns={te_col:f"{te_col}_te"})
        Xtr_e[te_col]=Xtr[te_col].values; Xv_e[te_col]=Xv[te_col].values
        for c in CATEGORICAL_FEATURES:
            Xtr_e[c]=Xtr_e[c].astype("category"); Xv_e[c]=Xv_e[c].astype("category")
        m = model_factory()
        m.fit(Xtr_e, ytr, categorical_feature=CATEGORICAL_FEATURES)
        p = m.predict_proba(Xv_e)[:,1]; oof[val]=p
        aucs.append(roc_auc_score(yv,p)); print(f"  Fold {k+1}: AUC={aucs[-1]:.4f}")
    return oof, aucs

def make_closure():
    return lgb.LGBMClassifier(n_estimators=400, learning_rate=0.05, num_leaves=31,
        min_child_samples=20, is_unbalance=True, reg_alpha=0.1, reg_lambda=0.1,
        random_state=RANDOM_STATE, n_jobs=-1, verbose=-1)

print("── Closure: 5-fold CV (honest, in-fold encoding) ──")
closure_oof, closure_aucs = cv_oof(X_all, y_closure, make_closure)
closure_cv_auc = float(np.mean(closure_aucs))
print(f"\nMean CV AUC: {closure_cv_auc:.4f} ± {np.std(closure_aucs):.4f}")
print(f"PR-AUC: {average_precision_score(y_closure, closure_oof):.4f} (baseline {y_closure.mean():.4f})")
print(f"Lift over cause-alone: +{closure_cv_auc - cause_auc:.4f}  (healthy if small & positive)")

# ─── Threshold tuning ────────────────────────────────────────
ths = np.linspace(0.05,0.95,91)
f1s = [f1_score(y_closure,(closure_oof>=t).astype(int)) for t in ths]
bi = int(np.argmax(f1s)); closure_best_threshold=float(ths[bi]); closure_best_f1=float(f1s[bi])
yb = (closure_oof>=closure_best_threshold).astype(int)
prec = (yb & y_closure).sum()/max(yb.sum(),1)
rec  = (yb & y_closure).sum()/max(y_closure.sum(),1)
print(f"F1-optimal threshold {closure_best_threshold:.3f}: F1={closure_best_f1:.3f} P={prec:.3f} R={rec:.3f}")

fig,axes=plt.subplots(1,2,figsize=(13,4))
axes[0].plot(ths,f1s,lw=2,color="#4C72B0")
axes[0].axvline(closure_best_threshold,color="red",ls="--",label=f"Best @ {closure_best_threshold:.2f}")
axes[0].axvline(0.5,color="gray",ls=":",label="Default 0.5")
axes[0].set_xlabel("Threshold"); axes[0].set_ylabel("F1"); axes[0].set_title("F1 vs threshold"); axes[0].legend()
pr,rc,_=precision_recall_curve(y_closure,closure_oof)
axes[1].plot(rc,pr,lw=2,color="#C44E52")
axes[1].axhline(y_closure.mean(),color="gray",ls=":",label=f"Baseline {y_closure.mean():.3f}")
axes[1].set_xlabel("Recall"); axes[1].set_ylabel("Precision")
axes[1].set_title(f"PR curve (AP={average_precision_score(y_closure,closure_oof):.3f})"); axes[1].legend()
plt.tight_layout(); plt.savefig('../plots/step1_plot_1.png')
plt.clf()

te_full = ce.TargetEncoder(cols=[HIGH_CARD_COL], smoothing=20.0)
X_te = te_full.fit_transform(X_all, y_closure).rename(columns={HIGH_CARD_COL:f"{HIGH_CARD_COL}_te"})
X_te[HIGH_CARD_COL]=X_all[HIGH_CARD_COL].values
for c in CATEGORICAL_FEATURES: X_te[c]=X_te[c].astype("category")

param_dist = {"n_estimators":[200,300,400,500,700],"learning_rate":[0.02,0.03,0.05,0.07,0.1],
    "num_leaves":[15,31,63,95],"min_child_samples":[10,20,40,60],
    "reg_alpha":[0,0.05,0.1,0.3],"reg_lambda":[0,0.05,0.1,0.3],
    "subsample":[0.7,0.85,1.0],"colsample_bytree":[0.6,0.8,1.0]}
base=lgb.LGBMClassifier(is_unbalance=True,random_state=RANDOM_STATE,n_jobs=-1,verbose=-1)
search=RandomizedSearchCV(base,param_dist,n_iter=20,scoring="roc_auc",cv=3,random_state=RANDOM_STATE,n_jobs=-1)
search.fit(X_te,y_closure,categorical_feature=CATEGORICAL_FEATURES)
closure_best_params=search.best_params_
print(f"Best params: {closure_best_params}")

def make_tuned():
    return lgb.LGBMClassifier(is_unbalance=True,random_state=RANDOM_STATE,n_jobs=-1,verbose=-1,**closure_best_params)
print("\n── Honest CV with tuned params ──")
_, closure_aucs_tuned = cv_oof(X_all, y_closure, make_tuned)
closure_cv_auc_tuned=float(np.mean(closure_aucs_tuned))
print(f"\nTuned CV AUC: {closure_cv_auc_tuned:.4f} (was {closure_cv_auc:.4f})")

closure_base = make_tuned(); closure_base.fit(X_te,y_closure,categorical_feature=CATEGORICAL_FEATURES)
closure_calibrated = CalibratedClassifierCV(closure_base,method="isotonic",cv=5)
closure_calibrated.fit(X_te,y_closure)
print("✓ Closure calibrated")

fig,ax=plt.subplots(figsize=(8,4))
ax.hist(closure_calibrated.predict_proba(X_te)[:,1],bins=50,color="#4C72B0")
ax.set_xlabel("Predicted closure probability"); ax.set_ylabel("Incidents")
ax.set_title(f"Calibrated closure probability (positive rate {y_closure.mean()*100:.1f}%)\nHealthy = spread, not just 0/1 spikes")
plt.tight_layout(); plt.savefig('../plots/step1_plot_2.png')
plt.clf()

# ─── Priority determinism check ──────────────────────────────
corr_pri = pd.Series(y_priority.values).groupby(df["corridor_cat"].values).nunique()
combo_pri = pd.Series(y_priority.values).groupby([df["corridor_cat"].values, df["cause_cat"].values]).nunique()
print("── PRIORITY DETERMINISM CHECK ──")
print(f"Corridors with constant priority: {(corr_pri==1).sum()} of {len(corr_pri)}")
print(f"(corridor,cause) combos with mixed priority: {(combo_pri>1).sum()} of {len(combo_pri)}")
priority_is_deterministic = bool((corr_pri==1).mean() > 0.7)
if priority_is_deterministic:
    print("⚠️  Priority is largely deterministic from corridor — likely a business rule.")
    print("    A ~0.99 AUC reflects rule-recovery, not hard prediction. Frame honestly.")

def make_priority():
    return lgb.LGBMClassifier(n_estimators=400,learning_rate=0.05,num_leaves=31,
        min_child_samples=20,reg_alpha=0.1,reg_lambda=0.1,
        random_state=RANDOM_STATE,n_jobs=-1,verbose=-1)
print("── Priority: 5-fold CV (honest) ──")
priority_oof, priority_aucs = cv_oof(X_all, y_priority, make_priority)
priority_cv_auc=float(np.mean(priority_aucs))
print(f"\nMean CV AUC: {priority_cv_auc:.4f} ± {np.std(priority_aucs):.4f}")

te_priority = ce.TargetEncoder(cols=[HIGH_CARD_COL], smoothing=20.0)
X_te_pri = te_priority.fit_transform(X_all,y_priority).rename(columns={HIGH_CARD_COL:f"{HIGH_CARD_COL}_te"})
X_te_pri[HIGH_CARD_COL]=X_all[HIGH_CARD_COL].values
for c in CATEGORICAL_FEATURES: X_te_pri[c]=X_te_pri[c].astype("category")
priority_base=make_priority(); priority_base.fit(X_te_pri,y_priority,categorical_feature=CATEGORICAL_FEATURES)
priority_calibrated=CalibratedClassifierCV(priority_base,method="isotonic",cv=5)
priority_calibrated.fit(X_te_pri,y_priority)
print("✓ Priority calibrated")

closed_c, resolved_c = col("closed_dt"), col("resolved_dt")
end = pd.to_datetime(df[closed_c],errors="coerce",utc=True).dt.tz_localize(None) if closed_c else pd.Series(pd.NaT,index=df.index)
if resolved_c:
    end = end.fillna(pd.to_datetime(df[resolved_c],errors="coerce",utc=True).dt.tz_localize(None))
duration_h = (end - df["_start_dt"]).dt.total_seconds()/3600
duration_mask = duration_h.between(0,24*30)
print(f"Usable duration: {duration_mask.sum():,} ({duration_mask.mean()*100:.1f}%)")
print(f"Median: {duration_h[duration_mask].median():.2f}h  Mean: {duration_h[duration_mask].mean():.2f}h")

cause_medians = duration_h[duration_mask].groupby(df.loc[duration_mask,"cause_cat"]).agg(["median","count"])
cause_medians.columns=["median_h","n_examples"]
global_median=float(duration_h[duration_mask].median())
FALLBACK_MIN_EXAMPLES=30
fallback_causes=cause_medians[cause_medians["n_examples"]<FALLBACK_MIN_EXAMPLES].index.tolist()
print(f"Fallback causes (n<{FALLBACK_MIN_EXAMPLES}): {fallback_causes}")

te_duration = ce.TargetEncoder(cols=[HIGH_CARD_COL],smoothing=20.0)
X_dur_raw = X_all[duration_mask].copy()
y_dur = np.log1p(duration_h[duration_mask].values)
X_dur = te_duration.fit_transform(X_dur_raw,y_dur).rename(columns={HIGH_CARD_COL:f"{HIGH_CARD_COL}_te"})
X_dur[HIGH_CARD_COL]=X_dur_raw[HIGH_CARD_COL].values
for c in CATEGORICAL_FEATURES: X_dur[c]=X_dur[c].astype("category")

def make_q(a):
    return lgb.LGBMRegressor(objective="quantile",alpha=a,n_estimators=400,learning_rate=0.05,
        num_leaves=31,min_child_samples=20,reg_alpha=0.1,reg_lambda=0.1,
        random_state=RANDOM_STATE,n_jobs=-1,verbose=-1)

kf=KFold(N_FOLDS,shuffle=True,random_state=RANDOM_STATE); oof=np.zeros(len(y_dur))
for tr,val in kf.split(X_dur):
    m=make_q(0.5); m.fit(X_dur.iloc[tr],y_dur[tr],categorical_feature=CATEGORICAL_FEATURES)
    oof[val]=m.predict(X_dur.iloc[val])
mae=mean_absolute_error(np.expm1(y_dur),np.expm1(oof))
medae=median_absolute_error(np.expm1(y_dur),np.expm1(oof))
r2=r2_score(y_dur,oof)
print(f"Duration P50 — MAE {mae:.1f}h | MEDIAN AE {medae:.2f}h | R²(log) {r2:.3f}")
print(f"   → Lead with median AE ({medae:.2f}h); mean is inflated by multi-day events")

duration_p50=make_q(0.5).fit(X_dur,y_dur,categorical_feature=CATEGORICAL_FEATURES)
duration_p90=make_q(0.9).fit(X_dur,y_dur,categorical_feature=CATEGORICAL_FEATURES)
p50h=np.expm1(duration_p50.predict(X_dur)); p90h=np.expm1(duration_p90.predict(X_dur))
within_p90=(np.expm1(y_dur)<=p90h).mean()*100
print(f"✓ P50+P90 trained. P90 covers {within_p90:.1f}% (target ~90%)")

fig,axes=plt.subplots(1,3,figsize=(16,6))
for ax,model,title,color in [(axes[0],closure_base,"Closure",  "#4C72B0"),
                              (axes[1],priority_base,"Priority","#55A868"),
                              (axes[2],duration_p50,"Duration P50","#C44E52")]:
    imp=pd.Series(model.feature_importances_,index=X_te.columns).sort_values(ascending=False).head(15)
    ax.barh(imp.index[::-1],imp.values[::-1],color=color)
    ax.set_title(title); ax.set_xlabel("Importance (gain)")
plt.tight_layout(); plt.savefig('../plots/step1_plot_3.png')
plt.clf()

IMPACT_WEIGHTS={"priority":0.4,"closure":0.4,"duration":0.2}
duration_log_p95=float(np.percentile(y_dur,95))

def _enc(te,Xin):
    Xe=te.transform(Xin).rename(columns={HIGH_CARD_COL:f"{HIGH_CARD_COL}_te"})
    Xe[HIGH_CARD_COL]=Xin[HIGH_CARD_COL].values
    for c in CATEGORICAL_FEATURES: Xe[c]=Xe[c].astype("category")
    return Xe

def _duration_floor(p50h):
    return np.where(p50h>12,6,np.where(p50h>6,4,1))

def predict_impact(Xin):
    Xin=Xin.copy()
    for c in CATEGORICAL_FEATURES:
        if c not in Xin.columns: Xin[c]="unknown"
        Xin[c]=Xin[c].astype("category")
    for c in NUMERIC_FEATURES:
        if c not in Xin.columns: Xin[c]=0
    closure_p=closure_calibrated.predict_proba(_enc(te_full,Xin))[:,1]
    priority_p=priority_calibrated.predict_proba(_enc(te_priority,Xin))[:,1]
    Xdu=_enc(te_duration,Xin)
    p50=np.expm1(duration_p50.predict(Xdu)); p90=np.expm1(duration_p90.predict(Xdu))
    for i,c in enumerate(Xin["cause_cat"].astype(str).values):
        if c in fallback_causes:
            fb=float(cause_medians.loc[c,"median_h"]) if c in cause_medians.index else global_median
            p50[i]=fb; p90[i]=fb*2
    dnorm=np.clip(np.log1p(p50)/duration_log_p95,0,1)
    raw=IMPACT_WEIGHTS["priority"]*priority_p+IMPACT_WEIGHTS["closure"]*closure_p+IMPACT_WEIGHTS["duration"]*dnorm
    base=np.round(1+9*raw).astype(int)
    score=np.clip(np.maximum(base,_duration_floor(p50)),1,10)
    return pd.DataFrame({"closure_probability":np.round(closure_p,4),
        "priority_high_probability":np.round(priority_p,4),
        "expected_duration_h":np.round(p50,2),"expected_duration_p90_h":np.round(p90,2),
        "composite_impact_score":score})

sample=X_all.iloc[np.random.RandomState(RANDOM_STATE).choice(len(X_all),5,replace=False)]
out=pd.concat([sample[["cause_cat","corridor_cat","police_station_cat","hour"]].reset_index(drop=True),
               predict_impact(sample).reset_index(drop=True)],axis=1)
print("── Sample predictions (note: long-duration events now floored) ──")
print(out.to_string(index=False))

all_preds=predict_impact(X_all)
sd=all_preds["composite_impact_score"].value_counts().sort_index()
fig,ax=plt.subplots(figsize=(9,4))
ax.bar(sd.index,sd.values,color="#4C72B0")
ax.set_xlabel("Composite impact score"); ax.set_ylabel("Incidents")
ax.set_title(f"Score distribution across {len(all_preds):,} incidents"); ax.set_xticks(range(1,11))
for x,y in zip(sd.index,sd.values): ax.text(x,y,str(y),ha="center",va="bottom",fontsize=9)
plt.tight_layout(); plt.savefig('../plots/step1_plot_4.png')
plt.clf()
print(f"Mean {all_preds['composite_impact_score'].mean():.2f} | Median {all_preds['composite_impact_score'].median():.1f}")

joblib.dump(closure_calibrated,MODEL_DIR/"closure_classifier.joblib")
joblib.dump(priority_calibrated,MODEL_DIR/"priority_classifier.joblib")
joblib.dump(duration_p50,MODEL_DIR/"duration_p50.joblib")
joblib.dump(duration_p90,MODEL_DIR/"duration_p90.joblib")
joblib.dump(te_full,MODEL_DIR/"target_encoder_closure.joblib")
joblib.dump(te_priority,MODEL_DIR/"target_encoder_priority.joblib")
joblib.dump(te_duration,MODEL_DIR/"target_encoder_duration.joblib")

fallback={"global_median_h":global_median,"cause_medians":cause_medians["median_h"].to_dict(),
    "n_examples":cause_medians["n_examples"].astype(int).to_dict(),"fallback_causes":fallback_causes,
    "fallback_min_examples":FALLBACK_MIN_EXAMPLES,"duration_log_p95":duration_log_p95,
    "closure_threshold":closure_best_threshold}
json.dump(fallback,open(MODEL_DIR/"duration_fallback.json","w"),indent=2)

metadata={"version":"v3-leakfixed","trained_at":datetime.now().isoformat(),
    "n_rows":int(len(df)),"n_rows_with_duration":int(duration_mask.sum()),
    "features":{"categorical":CATEGORICAL_FEATURES,"numeric":NUMERIC_FEATURES,
        "all":ALL_FEATURES,"high_card_col":HIGH_CARD_COL},
    "excluded_features_leak":["event_span_deg","has_end_coord"],
    "metrics":{"closure_cv_auc":closure_cv_auc_tuned,"cause_alone_auc":float(cause_auc),
        "closure_best_threshold":closure_best_threshold,"closure_best_f1":closure_best_f1,
        "priority_cv_auc":priority_cv_auc,"priority_is_deterministic":priority_is_deterministic,"duration_mae_h":float(mae),
        "duration_median_ae_h":float(medae),"duration_r2_log":float(r2),
        "duration_p90_coverage_pct":float(within_p90)},
    "best_params_closure":closure_best_params,"impact_weights":IMPACT_WEIGHTS}
json.dump(metadata,open(MODEL_DIR/"metadata.json","w"),indent=2,default=str)

print("✓ Saved:")
for p in sorted(MODEL_DIR.iterdir()): print(f"  {p.name} ({p.stat().st_size:,}b)")
print(f"\n── HONEST FINAL METRICS ──")
print(f"  Closure AUC:  {closure_cv_auc_tuned:.4f}  (cause-alone floor {cause_auc:.4f}, lift +{closure_cv_auc_tuned-cause_auc:.3f})")
print(f"  Priority AUC: {priority_cv_auc:.4f}")
print(f"  Duration:     median AE {medae:.2f}h, P90 covers {within_p90:.0f}%")


service_code = """
\"\"\"impact_service.py v3 — leak-fixed P1 artifacts.\"\"\"
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
    \"\"\"For the UI feature-importance chart.\"\"\"
    try:
        base=_closure_clf.calibrated_classifiers_[0].estimator
    except Exception:
        base=getattr(_closure_clf,"estimator",None)
    if base is None or not hasattr(base,"feature_importances_"): return {}
    names=list(_te_cl.transform(pd.DataFrame([{c:"x" for c in _ALL}])).columns)
    return dict(sorted(zip(names,base.feature_importances_.tolist()),key=lambda kv:-kv[1]))
"""
service_path=MODEL_DIR.parent/"impact_service.py"
service_path.write_text(service_code)
print(f"✓ Wrote {service_path}")
os.environ["EVAC_MODEL_DIR"]=str(MODEL_DIR.resolve())
ns={"__file__":str(service_path)}; exec(service_code,ns)
test={"cause":"vehicle_breakdown","corridor":"Mysore Road","zone":"South","veh_type":"truck",
    "police_station":"Yelahanka","start_datetime":"2024-04-15 06:30:00","is_planned":False,"lat":13.04,"lon":77.52}
print(f"\nTest: {json.dumps(ns['predict_impact_from_request'](test),indent=2)}")
# Long-duration test — should NOT score low anymore
test2={"cause":"water_logging","corridor":"no_corridor","police_station":"r.t. nagar",
    "start_datetime":"2024-04-15 05:00:00","is_planned":False}
print(f"\nLong-event test (water_logging): {json.dumps(ns['predict_impact_from_request'](test2),indent=2)}")

