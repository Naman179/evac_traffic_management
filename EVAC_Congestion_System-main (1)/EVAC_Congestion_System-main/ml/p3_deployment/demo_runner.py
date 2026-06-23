"""
P3 Deployment Recommendation Engine — Demo Runner
====================================================
Standalone script that demonstrates the full deployment pipeline:

1. Loads the ASTraM dataset
2. Picks diverse sample incidents (one per major cause)
3. Simulates P1 impact scores
4. Loads P2 corridor risk
5. Runs the recommendation engine
6. Validates against historical anchors
7. Exports results to ml/p3_deployment/output/

Usage:
    cd EVAC_Congestion_System-main
    python -m ml.p3_deployment.demo_runner
"""

from __future__ import annotations

import json
import sys
import os
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# Ensure project root is on path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.p3_deployment.config import DATA_DIR, CSV_FILENAME, P3_OUTPUT_DIR
from ml.p3_deployment.response_templates import list_all_templates
from ml.p3_deployment.recommendation_engine import recommend
from ml.p3_deployment.deployment_scorer import (
    load_corridor_risk_scores,
    simulate_p1_impact,
)
from ml.p3_deployment.osm_diversion import compute_diversion
from ml.p3_deployment.historical_anchors import (
    load_historical_anchors,
    validate_against_anchors,
    summarize_validation,
)


# ─── Formatting helpers ──────────────────────────────────────────────────────

def _sep(char="=", width=80):
    print(char * width)

def _header(title: str):
    _sep()
    print(f"  {title}")
    _sep()
    print()

def _print_plan(plan, index: int = 0):
    """Pretty-print a single deployment plan."""
    d = plan.to_dict()
    print(f"  [{index+1}] Incident: {d['incident_id']}")
    print(f"      Cause:     {d['cause']}")
    print(f"      Corridor:  {d['corridor']}  |  Zone: {d['zone']}")
    print(f"      Location:  ({d['location']['latitude']:.4f}, {d['location']['longitude']:.4f})")
    print(f"      Time:      {d['start_datetime'][:19] if d['start_datetime'] else 'N/A'}")
    print()
    print(f"      Impact Score:       {d['impact_score']}/10")
    print(f"      Closure Prob:       {d['closure_probability']:.1%}")
    print(f"      Priority (High):    {d['priority_probability']:.1%}")
    print(f"      Expected Duration:  {d['expected_duration_h']:.1f}h")
    print(f"      Corridor Risk:      {d['corridor_risk_tier']} ({d['corridor_risk_score']:.3f})")
    print()
    print(f"      >>> RECOMMENDATION:")
    print(f"          Officers:    {d['recommended_officers']}")
    print(f"          Barricades:  {d['recommended_barricades']}")
    print(f"          Recovery Van:{' YES' if d['recovery_van_needed'] else ' No'}")
    if d["escalate_to"]:
        print(f"          Escalate To: {', '.join(d['escalate_to'])}")
    if d["equipment"]:
        print(f"          Equipment:   {', '.join(d['equipment'][:5])}")
    if d["diversion_triggered"]:
        dr = d.get("diversion_route", {})
        if dr and dr.get("status") == "ok":
            print(f"          Diversion:   {dr.get('detour_distance_km', '?')} km "
                  f"(+{dr.get('extra_distance_km', '?')} km over direct), "
                  f"~{dr.get('estimated_time_min', '?')} min "
                  f"[{dr.get('method', '')}]")
        else:
            print(f"          Diversion:   Triggered but no valid coordinates")
    print()
    print(f"      Explanation trail:")
    for step in d["explanation"]:
        print(f"        - {step}")
    print()


# ─── Sample incident selector ────────────────────────────────────────────────

def select_diverse_samples(df: pd.DataFrame, n_per_cause: int = 1) -> pd.DataFrame:
    """
    Pick diverse sample incidents — one per major cause category,
    preferring incidents on named corridors and with coordinates.
    """
    target_causes = [
        "vehicle_breakdown",
        "accident",
        "pot_holes",
        "water_logging",
        "tree_fall",
        "construction",
        "public_event",
        "congestion",
        "procession",
        "vip_movement",
    ]

    samples = []
    rng = np.random.RandomState(42)

    for cause in target_causes:
        subset = df[df["event_cause"].str.lower().str.strip() == cause]
        if len(subset) == 0:
            continue

        # Prefer rows on named corridors with good coordinates
        on_corridor = subset[
            (subset["corridor"].notna())
            & (~subset["corridor"].str.lower().str.contains("non-corridor", na=True))
        ]
        pool = on_corridor if len(on_corridor) >= n_per_cause else subset

        # Also prefer rows with end-coordinates for diversion demo
        has_end = pool[
            (pool["endlatitude"].notna()) & (pool["endlatitude"] != 0)
        ]
        if len(has_end) >= n_per_cause:
            pool = has_end

        chosen = pool.sample(n=min(n_per_cause, len(pool)), random_state=rng)
        samples.append(chosen)

    return pd.concat(samples, ignore_index=True) if samples else pd.DataFrame()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print()
    _header("P3 DEPLOYMENT RECOMMENDATION ENGINE — DEMO")

    # ── 1. Load dataset ───────────────────────────────────────────────────
    csv_path = DATA_DIR / CSV_FILENAME
    print(f"  Loading dataset: {csv_path.name}")
    df = pd.read_csv(csv_path)
    print(f"  Loaded {len(df):,} incidents, {len(df.columns)} columns")
    print()

    # ── 2. Load P2 corridor risk scores ───────────────────────────────────
    print("  Loading P2 corridor risk scores...")
    corridor_risk_lookup = load_corridor_risk_scores()
    print(f"  Loaded {len(corridor_risk_lookup)} corridors")
    print()

    # ── 3. Show response template summary ─────────────────────────────────
    _header("RESPONSE TEMPLATES (Decision Table)")
    templates = list_all_templates()
    print(f"  {'Cause':<25s} {'Officers':>8s} {'Barricades':>10s} {'Van':>4s}  Escalate To")
    print(f"  {'-'*25} {'-'*8} {'-'*10} {'-'*4}  {'-'*30}")
    for t in templates:
        esc = ", ".join(t["escalate_to"][:2]) if t["escalate_to"] else "-"
        van = "Yes" if t["recovery_van"] else "-"
        print(f"  {t['cause']:<25s} {t['base_officers']:>8d} {t['base_barricades']:>10d} {van:>4s}  {esc}")
    print()

    # ── 4. Select diverse sample incidents ────────────────────────────────
    _header("SAMPLE DEPLOYMENT RECOMMENDATIONS")
    samples = select_diverse_samples(df, n_per_cause=1)
    print(f"  Selected {len(samples)} diverse sample incidents\n")

    all_plans = []
    for i, (_, row) in enumerate(samples.iterrows()):
        incident = row.to_dict()

        # Convert NaN to None for clean processing
        for k, v in incident.items():
            if isinstance(v, float) and np.isnan(v):
                incident[k] = None

        # Simulate P1 impact
        impact = simulate_p1_impact(incident)

        # Get corridor risk
        corridor = str(incident.get("corridor", "")).lower().strip()
        cr = corridor_risk_lookup.get(corridor)

        # Run recommendation engine (with diversion)
        plan = recommend(incident, impact, cr, diversion_func=compute_diversion)

        _print_plan(plan, i)
        all_plans.append(plan)
        print("-" * 80)

    # ── 5. Run historical anchor validation ───────────────────────────────
    _header("HISTORICAL ANCHOR VALIDATION")
    print("  Extracting historical cases with real deployments...\n")
    anchors = load_historical_anchors(df)

    print(f"  Total incidents:              {anchors['summary']['total_rows']:,}")
    print(f"  With officer assignment:       {anchors['summary']['officer_assigned_count']} "
          f"({anchors['summary']['officer_assigned_pct']:.1f}%)")
    print(f"  With real route coordinates:   {anchors['summary']['real_route_count']} "
          f"({anchors['summary']['real_route_pct']:.1f}%)")
    print()

    if anchors["summary"]["officer_assigned_count"] > 0:
        print("  Officer assignment cause distribution:")
        for cause, count in sorted(
            anchors["summary"]["officer_cause_distribution"].items(),
            key=lambda x: -x[1],
        )[:8]:
            print(f"    {cause:<25s} {count:>4d}")
        print()

    print("  Running recommendation engine on all anchor cases...")
    comparisons = validate_against_anchors(
        anchors,
        recommend_func=recommend,
        impact_sim_func=simulate_p1_impact,
        corridor_risk_lookup=corridor_risk_lookup,
    )
    val_summary = summarize_validation(comparisons)

    print(f"\n  Validation Summary ({val_summary['n_cases']} cases):")
    print(f"    Officers recommended:  mean={val_summary['officer_stats']['mean']:.1f}, "
          f"median={val_summary['officer_stats']['median']}, "
          f"range=[{val_summary['officer_stats']['min']}-{val_summary['officer_stats']['max']}]")
    print(f"    Barricades recommended: mean={val_summary['barricade_stats']['mean']:.1f}, "
          f"median={val_summary['barricade_stats']['median']}")
    print(f"    Impact scores:         mean={val_summary['impact_score_stats']['mean']:.1f}, "
          f"median={val_summary['impact_score_stats']['median']}")
    print(f"    High-deployment (>=5): {val_summary['high_deployment_count']} cases")
    print(f"    Closure triggered:     {val_summary['closure_triggered_count']} cases")
    print()

    # ── 6. Edge case tests ────────────────────────────────────────────────
    _header("EDGE CASE TESTS")

    edge_cases = [
        {
            "name": "Unknown cause",
            "incident": {
                "id": "edge-1", "event_cause": "ALIEN_INVASION",
                "corridor": "Mysore Road", "latitude": 12.95, "longitude": 77.55,
                "start_datetime": "2024-02-15T05:30:00", "priority": "High",
                "requires_road_closure": False,
            },
        },
        {
            "name": "Missing everything",
            "incident": {
                "id": "edge-2", "event_cause": "",
                "corridor": "", "latitude": 0, "longitude": 0,
                "start_datetime": "", "priority": "",
                "requires_road_closure": False,
            },
        },
        {
            "name": "Maximum severity",
            "incident": {
                "id": "edge-3", "event_cause": "accident",
                "corridor": "Mysore Road", "latitude": 12.95, "longitude": 77.55,
                "endlatitude": 12.951, "endlongitude": 77.551,
                "start_datetime": "2024-01-20T20:00:00", "priority": "High",
                "requires_road_closure": True,
            },
        },
        {
            "name": "Test/demo event (should deploy nothing)",
            "incident": {
                "id": "edge-4", "event_cause": "test_demo",
                "corridor": "", "latitude": 12.97, "longitude": 77.60,
                "start_datetime": "2024-03-01T10:00:00", "priority": "Low",
                "requires_road_closure": False,
            },
        },
    ]

    for ec in edge_cases:
        print(f"  Edge case: {ec['name']}")
        impact = simulate_p1_impact(ec["incident"])
        corridor = str(ec["incident"].get("corridor", "")).lower().strip()
        cr = corridor_risk_lookup.get(corridor)
        plan = recommend(ec["incident"], impact, cr, diversion_func=compute_diversion)
        print(f"    -> Officers: {plan.recommended_officers}, "
              f"Barricades: {plan.recommended_barricades}, "
              f"Impact: {plan.impact_score}/10")
        print(f"    -> Last explanation: {plan.explanation[-1]}")
        print()

    # ── 7. Export results ─────────────────────────────────────────────────
    _header("EXPORTING RESULTS")
    P3_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Export sample plans
    plans_out = [p.to_dict() for p in all_plans]
    plans_file = P3_OUTPUT_DIR / "sample_deployment_plans.json"
    with open(plans_file, "w") as f:
        json.dump(plans_out, f, indent=2, default=str)
    print(f"  Sample plans:      {plans_file}")

    # Export templates
    templates_file = P3_OUTPUT_DIR / "response_templates.json"
    with open(templates_file, "w") as f:
        json.dump(templates, f, indent=2)
    print(f"  Templates:         {templates_file}")

    # Export validation
    validation_file = P3_OUTPUT_DIR / "anchor_validation.json"
    with open(validation_file, "w") as f:
        json.dump({
            "summary": val_summary,
            "comparisons": comparisons[:20],  # First 20 for readability
            "anchors_summary": anchors["summary"],
        }, f, indent=2, default=str)
    print(f"  Anchor validation: {validation_file}")

    # Export P3 metadata
    metadata = {
        "version": "v1",
        "generated_at": datetime.now().isoformat(),
        "n_templates": len(templates),
        "n_sample_plans": len(plans_out),
        "n_anchor_cases_validated": val_summary["n_cases"],
        "validation_officer_mean": val_summary["officer_stats"]["mean"],
        "validation_impact_mean": val_summary["impact_score_stats"]["mean"],
        "p2_corridors_loaded": len(corridor_risk_lookup),
        "p1_models_available": False,
        "p1_impact_method": "simulated_v3_formula",
        "osm_diversion_available": _check_osmnx_status(),
        "api_endpoints": {
            "GET /deployments/recommend?incident_id=X": "Returns deployment plan with explanation",
            "POST /deployments/confirm": "Confirm and lock a deployment plan",
            "GET /deployments/templates": "View/edit response templates",
        },
    }
    meta_file = P3_OUTPUT_DIR / "p3_metadata.json"
    with open(meta_file, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"  P3 metadata:       {meta_file}")

    print()
    _sep("=")
    print("  DEMO COMPLETE")
    print(f"  All outputs saved to: {P3_OUTPUT_DIR}")
    _sep("=")
    print()


def _check_osmnx_status() -> bool:
    try:
        import osmnx  # noqa: F401
        return True
    except ImportError:
        return False


if __name__ == "__main__":
    main()
