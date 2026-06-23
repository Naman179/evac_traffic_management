# 👥 EVAC — Theme 2 Team Plan (Data-Grounded Edition)

> **Philosophy**: Each person still owns **one feature end-to-end** — DB tables, model, API, UI. The split below is the same shape as before. What's different is that every task is now checked against the actual ASTraM file (8,173 rows, 46 columns) instead of assumed columns, so nobody discovers a missing data source on Day 6.

---

## ⚠️ What Changed From the Original Plan, and Why

Four corrections drive everything below. First, several planned inputs — `venue`, `crowd_size`, `reaction_taken`, `violation_offence` — don't exist anywhere in the real schema, so features built on them have been redesigned around columns that are actually populated. Second, "planned events" (rallies, festivals, VIP movement) are only 467 of 8,173 rows, and just 28 of those have a usable outcome label — too thin to forecast on alone, so the forecaster now covers all incident types, which is also where the real operational pain is (vehicle breakdowns are 60% of everything logged). Third, there's no historical record of what manpower or routes were actually deployed (under 2% of rows have either), so the deployment engine is now rules-based and calibrated rather than "mined" from a history that doesn't exist. Fourth, the data is a static historical export, not a live feed, so the real-time layer is now a simulated replay instead of a real Kafka/WebSocket pipeline — same demo effect, far less infrastructure risk.

---

## 📊 Dataset Cheat-Sheet (Read This Before Writing Any Code)

Everyone should treat this as the shared ground truth — it's already been verified against the file, so Day 1 doesn't need to re-derive it.

| Fact | Number |
|---|---|
| Total records / columns | 8,173 rows, 46 columns, ~6 months (Nov 2023–Apr 2024), Bengaluru-wide |
| Planned vs unplanned | 467 planned (5.7%) / 7,706 unplanned (94.3%) |
| Top causes | vehicle_breakdown 59.9%, others 8.0%, pot_holes 6.6%, construction 5.9%, water_logging 5.6%, accident 4.5%, tree_fall 3.5%, planned/public events combined 2.3%, road_conditions 2.1%, congestion 1.7% |
| Requires road closure | Yes for 8.3% of events (676 rows) — fully labeled, 0% missing |
| Priority | High 61.6% / Low 38.4% — fully labeled, this is the only severity label that actually exists (no 1–10 score in the data) |
| Status | closed 86.8%, active 12.3%, resolved 0.9% |
| Usable duration (start → closed/resolved) | ~36.5% of rows (2,983) — and only 44% of "closed" rows actually have a closed_datetime, so "closed" ≠ "we know when" |
| Planned events with usable duration | Just 28 out of 467 — too small to model on its own |
| veh_type / veh_no | Populated for 100% of vehicle_breakdown rows, 0% for every other cause — it's a breakdown-specific field, not a general gap |
| junction (named) | Only 30.7% populated — don't cluster by this, cluster on raw lat/long |
| zone | ~42% populated |
| assigned_to_police_id | Only 1.6% populated (128 rows) — not enough to learn deployment history from |
| route_path | 1.68% populated, and over a third of those are empty placeholder lists — only ~86 rows (1.05%) have real route coordinates |
| Busiest corridors | Mysore Road (743), Bellary Road 1 (610), Tumkur Road (458), Bellary Road 2 (379), Hosur Road (298) — but 38.2% of events aren't on any named corridor at all |
| Highest closure-risk corridors (n≥30) | Varthur Road (~11.7%), Mysore Road (~11.0%), Airport New South Road (~10.4%) vs an 8.3% baseline |
| Time pattern | Two clear peaks: 4–7am and 7–11pm; almost nothing between noon and 5pm |
| Dead columns (drop these) | comment, map_file, meta_data — 100% empty |
| Near-dead columns (don't build features on these) | age_of_truck, reason_breakdown, cargo_material, citizen_accident_id, resolved_at_address/lat/long, direction — all >96% missing |

---

## 🗂️ Feature Map (4 Slices — Same Shape, Corrected Internals)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EVAC SYSTEM                                  │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │  FEATURE 1   │  │  FEATURE 2   │  │  FEATURE 3   │  │FEATURE 4│ │
│  │              │  │              │  │              │  │         │ │
│  │  Impact      │  │  Congestion  │  │ Deployment   │  │Anomaly  │ │
│  │  Forecaster  │  │  Heatmap     │  │ Recommender  │  │+ Learn  │ │
│  │ (all causes) │  │ (raw lat/lon)│  │ (rules-based)│  │ (sim.)  │ │
│  │  Person 1    │  │  Person 2    │  │  Person 3    │  │Person 4 │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘ │
│                                                                      │
│  Shared Layer (Everyone contributes): Docker · DB Schema · Auth      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 👤 Person 1 — 📅 Incident Impact Forecaster
**Feature**: *"Given any incoming incident — planned or not — how bad will it get?"*

### What They Build (Full Stack)

| Layer | Task |
|-------|------|
| **Data** | Engineer features from `event_cause`, `corridor`, `zone`, `event_type`, hour-of-day/day-of-week (from `start_datetime`), and `veh_type` where present (breakdown rows only). Build a **composite impact score (1–10)** from `priority` + `requires_road_closure` + log(duration hours) where duration is known — this is an engineered label, not something pulled directly from the data, and the pitch should say so |
| **Model** | Two binary classifiers trained on the *full, fully-labeled* dataset — closure probability (from `requires_road_closure`) and priority (from `priority`) — plus a separate duration regressor trained only on the ~2,983 rows with a real, computable duration. Random Forest / Gradient Boosting (scikit-learn) — explainable, no GPU needed |
| **DB** | `incidents` table, `incident_predictions` table |
| **API** | `POST /incidents` (log new incident), `GET /incidents/{id}/impact` (returns closure probability + priority + expected duration + composite score) |
| **UI** | Incident report form (cause, location picker, planned/unplanned toggle, vehicle type if breakdown) + Impact Score Card + a small feature-importance chart (judges respond well to "here's *why* the model thinks this") |

### Data Reality Check
There's no `venue` or `crowd_size` column anywhere in the file — those were never collected, so don't design around them. There's also no ground-truth 1–10 severity; build it from what's real (`priority`, `requires_road_closure`, duration), and be upfront in the demo that it's an engineered composite. Don't restrict the model to "planned" events only — there are just 467 of those total and only 28 with a usable duration label, nowhere near enough to train on reliably. Build on all 8,173 rows instead, with planned-vs-unplanned as one input feature among several.

### Folder Ownership
```
/ml/models/impact_classifier.py
/ml/models/duration_regressor.py
/ml/notebooks/p1_impact_eda.ipynb
/backend/app/routers/incidents.py
/backend/app/routers/predictions.py
/backend/app/services/impact_service.py
/frontend/src/components/IncidentForm/
/frontend/src/components/ImpactScoreCard/
/frontend/src/pages/IncidentPlannerPage.jsx
```

### Complexity: ⚖️ Medium
- Two classifiers on fully-labeled data are low-risk; the duration regressor is the trickier piece since it only has ~36% of rows to learn from — for causes with very few duration examples, fall back to a cause-level median rather than forcing a per-row prediction.

---

## 👤 Person 2 — 🗺️ Congestion Heatmap & Spatial Analysis
**Feature**: *"Show WHERE congestion concentrates, and how risky each corridor already is."*

### What They Build (Full Stack)

| Layer | Task |
|-------|------|
| **Data** | Cluster on raw `latitude`/`longitude` directly — **not** grouped by `junction` first, since that field is only 30.7% populated and would silently drop most of the data. Use `endlatitude`/`endlongitude` (97.9% populated) to estimate how far an event's impact stretches, instead of inventing a radius. Precompute corridor-level stats (volume + closure rate) from the real numbers already found |
| **Model** | DBSCAN on lat/long (haversine or projected distance) for hotspot zones; Kernel Density Estimation for a smooth heatmap surface, weighted by Person 1's composite impact score rather than raw event count, so a few severe events show up as "hot" even if they're rare |
| **DB** | `hotspot_zones`, `corridor_risk_scores` (precomputed, e.g. Mysore Road / Varthur Road flagged as elevated), `heatmap_cache` |
| **API** | `GET /heatmap` (GeoJSON polygons + intensity, filterable by cause and time band), `GET /corridors/risk` (ranked corridor table) |
| **UI** | Heatmap layer (Leaflet + Leaflet.heat is lighter to ship in a hackathon timeframe than full Mapbox GL — keep Mapbox/animated timeline as a stretch goal, not core), corridor risk ranking table, a time-band filter that defaults to the two real peak windows (4–7am, 7–11pm) |

### Data Reality Check
`junction` and `zone` are real fields but sparsely filled (30.7% and ~42%) — useful as optional labels on top of a cluster, not as the primary grouping key. There's no actual "radius" or flow measurement in the data; `endlat`/`endlong` is the closest real proxy for affected stretch length, so anchor any radius logic there.

### Folder Ownership
```
/ml/models/spatial_clustering.py
/ml/notebooks/p2_spatial_eda.ipynb
/backend/app/routers/heatmap.py
/backend/app/services/spatial_service.py
/frontend/src/components/Map/
│   ├── CongestionHeatmap.jsx
│   ├── CorridorRiskTable.jsx
│   └── TimeBandFilter.jsx
/frontend/src/pages/CommandCenterPage.jsx
```

### Complexity: ⚖️ Medium
- DBSCAN + KDE on real coordinates is well-trodden ground; downgraded from "Medium-High" by deferring the heavier Mapbox/animation work to a stretch goal instead of a core requirement.

---

## 👤 Person 3 — 👮 Deployment Recommendation Engine
**Feature**: *"Turn a predicted impact into an actual instruction — officers, barricades, diversion."*

### What They Build (Full Stack)

| Layer | Task |
|-------|------|
| **Data** | There is no `reaction_taken` log to mine — confirmed absent from the schema. Build a **response-template table** instead: cause-specific rules (vehicle breakdown → recovery van + 2 constables; pothole/water-logging/road-conditions → escalate to BBMP/civil works, since traffic police can't fix these directly; tree fall → forest dept/BBMP removal team + cordon constable; planned events → barricade plan scaled to historical volume of similar past events) |
| **Model** | Rule engine (a transparent decision table, not a black box) that scales recommended officer count using Person 1's composite impact score and Person 2's corridor base-rate risk. For diversion routes, pull Bengaluru's actual road network from **OpenStreetMap** (via OSMnx + NetworkX) and compute a real detour around the closed segment — the dataset's own `route_path` field is unusable (only ~86 of 8,173 rows have real coordinates, the rest are empty placeholders) |
| **DB** | `deployment_plans`, `response_templates` (the editable rule table), `historical_case_anchors` (the ~128 rows with a real assigned officer and ~86 with a real route, kept as illustrative reference cases for the demo, not training data) |
| **API** | `GET /deployments/recommend?incident_id=X`, `POST /deployments/confirm`, `GET /deployments/templates` (view/edit the underlying rules) |
| **UI** | Deployment plan panel (junction list + officer count + barricade markers), a rule-template editor (transparency is a selling point here — commanders can see exactly why a recommendation was made), PDF export of the plan |

### Data Reality Check
This is the feature that needed the biggest redesign. `assigned_to_police_id` is populated for only 128 of 8,173 rows (1.6%) and real route geometry exists for about 86 rows (1.05%) — there simply isn't enough history to "learn what worked" the way the original plan assumed. Treat those handful of real cases as case-study anchors to validate the rule engine against in the demo ("here's a real past event, here's what our engine would have recommended"), not as a training set.

### Folder Ownership
```
/ml/models/recommendation_engine.py
/ml/routing/osm_diversion.py
/ml/notebooks/p3_response_template_design.ipynb
/backend/app/routers/deployments.py
/backend/app/services/recommendation_service.py
/frontend/src/components/DeploymentPanel/
│   ├── JunctionDeploymentList.jsx
│   ├── BarricadeMapLayer.jsx
│   └── RuleTemplateEditor.jsx
/frontend/src/pages/DeploymentPage.jsx
```

### Complexity: ⚖️ Medium
- Rules + routing is genuinely lower-risk than the original "mine historical reactions" plan, since it doesn't depend on data that mostly doesn't exist. OSMnx has a learning curve but is well-documented.

---

## 👤 Person 4 — 🔴 Anomaly Detection + Post-Event Learning Loop
**Feature**: *"Catch unplanned spikes as they happen, and make the system smarter after every event."*

### What They Build (Full Stack)

| Layer | Task |
|-------|------|
| **Data** | The file is a static historical snapshot, not a live feed — there's no confirmed real-time source to connect to yet. **Simulate streaming** by replaying historical rows in timestamp order at sped-up speed for the demo. Compute a rolling baseline of events-per-hour-per-corridor (using the real hourly pattern already found) to detect genuine spikes against it |
| **Model** | Isolation Forest flags density spikes at a location/time that exceed the rolling baseline; a post-event comparator logs Person 1's predicted closure/priority/duration next to the real outcome (for the ~36% of incidents where actual duration is known) and tracks accuracy over time |
| **DB** | `anomaly_alerts`, `prediction_accuracy_log`, `replay_checkpoint` (just tracks simulator position — no real message broker needed) |
| **API** | Server-Sent Events or a lightweight WebSocket fed directly by the Python replay loop (skip Kafka entirely unless the hackathon confirms a live data API exists at the finals stage), `POST /feedback/post-event` (officer logs actual outcome), `GET /analytics/model-accuracy` |
| **UI** | Real-time alert feed panel, a mobile-responsive web form for the field log (skip a separate React Native app unless time remains — a responsive page does the same job for a demo), predicted-vs-actual accuracy chart |

### Data Reality Check
Don't build real Kafka infrastructure for a static CSV — there's nothing live to stream from yet, and the broker setup is a lot of integration risk for something a simple replay script accomplishes for demo purposes. Keep Isolation Forest; it's genuinely well-suited here. Be aware that some corridors barely have enough volume to define a meaningful "normal" baseline (38.2% of events aren't even on a named corridor) — test the anomaly threshold mainly on the busier corridors first.

### Folder Ownership
```
/ml/models/anomaly_detector.py
/ml/pipelines/historical_replay_simulator.py
/ml/notebooks/p4_anomaly_eda.ipynb
/backend/app/routers/realtime.py        (SSE/WebSocket, no broker)
/backend/app/routers/feedback.py
/backend/app/services/anomaly_service.py
/frontend/src/components/AlertFeed/
/frontend/src/pages/PostEventAnalysis.jsx
/frontend/src/pages/FieldLogForm.jsx     (mobile-responsive, web-based)
```

### Complexity: ⚖️ Medium
- Downgraded from "Medium-High" by replacing Kafka + a separate mobile codebase with a replay simulator and a responsive web form — same demo value, far less to integrate by Day 10.

---

## ⚖️ Workload Comparison (Revised)

| | P1: Impact Forecaster | P2: Heatmap | P3: Deployment | P4: Anomaly + Learning |
|--|--|--|--|--|
| **ML complexity** | Medium (2 classifiers + 1 regressor) | Medium (DBSCAN/KDE) | Low (rules + routing) | Medium (Isolation Forest) |
| **Backend complexity** | Low (CRUD + predict) | Medium (GeoJSON) | Medium (graph routing) | Medium (SSE/WebSocket, no broker) |
| **Frontend complexity** | Low-Medium (form + card) | Medium (map layer) | Medium (panel + map layer) | Medium (alert feed + chart + form) |
| **Data risk (how solid is the foundation)** | Medium — duration label is thin (36%) | Low — coordinates are reliable and complete | **Was High, now Low** — redesigned away from near-absent history | Low — pattern is well-established in the data |
| **Stretch goals if time remains** | — | Mapbox GL + animated timeline | Full historical case-study gallery | Native mobile app, real Kafka if a live API exists |

---

## 🔗 Integration Points (Same Shape as Before)

```
P1 (Impact Forecaster)
  └── Provides: closure_probability, priority, expected_duration, composite_impact_score
        ↓ consumed by
  P2 (Heatmap) — weights heatmap intensity by impact score
  P3 (Deployment) — scales officer count by impact score

P2 (Heatmap)
  └── Provides: hotspot_zones, corridor_risk_scores
        ↓ consumed by
  P3 (Deployment) — factors corridor risk into the recommendation

P3 (Deployment)
  └── Provides: confirmed deployment plan
        ↓ consumed by
  P4 (Post-Event) — compares plan vs actual field-log outcome

P4 (Anomaly + Learning)
  └── Provides: real-time alerts, prediction-accuracy feedback
        ↓ consumed by
  P1 — flagged anomalies and accuracy logs feed back into retraining
```

---

## 🌿 Git Branch Structure

```
main
└── dev
    ├── feat/p1-impact-forecaster
    ├── feat/p2-congestion-heatmap
    ├── feat/p3-deployment-recommender
    └── feat/p4-anomaly-learning-loop
```

**PR Rule**: When a feature is complete → PR to `dev` → reviewed by the person whose feature consumes yours.

---

## 📋 Shared Responsibilities (Split Equally, Day 1)

| Task | Who Does It |
|------|-------------|
| `docker-compose.yml` (Postgres only — no Kafka unless you reach finals with a live data source) | P4 |
| `db/schema.sql` initial skeleton | P1 (creates first, others add their tables) |
| `contracts/api_schema.yaml` | All 4 contribute their own endpoints |
| Auth middleware (FastAPI) | P2 |
| README.md | All 4 write their own section |
| CI/CD pipeline (GitHub Actions) | P3 |

---

## 🗓️ 2-Week Sprint (Lean, Screening-Round Priority)

Since the EDA above is already verified, Day 1 can go straight to feature engineering instead of re-discovering the data blind.

### Week 1 — Build Your Feature Core
| Day | P1 | P2 | P3 | P4 |
|-----|----|----|----|----|
| 1 | Feature engineering on cause/corridor/time | DBSCAN setup on raw lat/long | Design response-template rule table | Build replay simulator + rolling baseline |
| 2–3 | Train closure + priority classifiers; duration regressor | KDE heatmap + corridor risk table | OSMnx routing setup | Isolation Forest baseline |
| 4–5 | API endpoints + Impact Score Card UI | Heatmap API + Leaflet layer | Deployment API + Panel UI | SSE/WebSocket + Alert Feed UI |

### Week 2 — Connect & Polish
| Day | P1 | P2 | P3 | P4 |
|-----|----|----|----|----|
| 6 | Pass impact_score to P2 & P3 | Consume P1 score → scale heatmap | Consume P1 score + P2 corridor risk | Replay stream live; consume P3 plans |
| 7–8 | Feature-importance chart | Corridor risk filter polish | PDF plan export + rule editor | Predicted-vs-actual accuracy chart |
| 9 | Integration testing with P2/P3 | Integration testing with P1/P3 | Integration testing with P1/P2 | Post-event comparison chart live |
| 10 | **Full demo rehearsal** | **Full demo rehearsal** | **Full demo rehearsal** | **Full demo rehearsal** |

> **If you make it to finals with more runway**: upgrade P2's map to Mapbox GL with animated timeline, give P3 a full historical case-study gallery, and give P4 a native mobile app — and only then consider real Kafka, if the organizers confirm a live data feed exists.

---

## 🤝 Communication
- **Daily standup**: 15 min, all 4
- **GitHub Issues**: Track tasks per feature
- **Blocker rule**: >2 hrs stuck → ping immediately, don't wait for standup
- **Integration day (Day 6)**: Everyone shares their output contract (what data they're passing downstream)

> [!IMPORTANT]
> **Day 1 must-do**: All 4 agree on the 4 inter-feature data contracts and commit them as `contracts/data_contracts.md`. This prevents Day 6 surprises.

> [!TIP]
> Use **Postman Mock Server** or **MSW (Mock Service Worker)** from Day 1 so each person's UI runs without depending on others' live backends. Integrate real backends on Day 6.
