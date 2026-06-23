Write-Host "=========================================="
Write-Host "     EVAC SYSTEM - FULL PIPELINE RUN"
Write-Host "=========================================="

cd scripts

Write-Host "`n---> Running Step 1: Impact Forecaster"
python step1_impact_forecaster.py
if ($LASTEXITCODE -ne 0) { Write-Host "Step 1 Failed."; exit $LASTEXITCODE }

Write-Host "`n---> Running Step 2: Congestion Heatmap"
python step2_congestion_heatmap.py
if ($LASTEXITCODE -ne 0) { Write-Host "Step 2 Failed."; exit $LASTEXITCODE }

Write-Host "`n---> Running Step 3: Deployment Recommender"
python step3_deployment_recommender.py
if ($LASTEXITCODE -ne 0) { Write-Host "Step 3 Failed."; exit $LASTEXITCODE }

Write-Host "`n---> Running Step 4: Anomaly Simulator"
python step4_anomaly_simulator.py
if ($LASTEXITCODE -ne 0) { Write-Host "Step 4 Failed."; exit $LASTEXITCODE }

Write-Host "`n=========================================="
Write-Host "  Pipeline Finished Successfully!"
Write-Host "  Check 'production_pipeline/plots' for visual outputs."
Write-Host "=========================================="
