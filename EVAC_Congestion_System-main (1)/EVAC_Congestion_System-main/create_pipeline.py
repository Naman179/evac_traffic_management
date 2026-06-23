import os
import json
import re

base_dir = r"c:\Users\HP\Downloads\gridhackathon\gridhackathon\EVAC_Congestion_System-main\EVAC_Congestion_System-main"
ml_dir = os.path.join(base_dir, "ml")
prod_dir = os.path.join(base_dir, "production_pipeline")
scripts_dir = os.path.join(prod_dir, "scripts")
plots_dir = os.path.join(prod_dir, "plots")
models_dir = os.path.join(prod_dir, "models")

os.makedirs(scripts_dir, exist_ok=True)
os.makedirs(plots_dir, exist_ok=True)
os.makedirs(models_dir, exist_ok=True)

def convert_notebook_to_script(notebook_path, output_script_path, step_name):
    with open(notebook_path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    code_lines = []
    plot_counter = 1
    
    for cell in nb.get('cells', []):
        if cell.get('cell_type') == 'code':
            source = "".join(cell.get('source', []))
            
            # Remove jupyter magic commands like %matplotlib inline or !pip
            source = "\n".join([line for line in source.split('\n') if not line.strip().startswith('%') and not line.strip().startswith('!')])
            
            # Replace plt.show() with plt.savefig(...)
            while "plt.show()" in source:
                plot_filename = f"../plots/{step_name}_plot_{plot_counter}.png"
                source = source.replace("plt.show()", f"plt.savefig('{plot_filename}')\nplt.clf()", 1)
                plot_counter += 1
                
            code_lines.append(source)
            code_lines.append("\n\n")
            
    script_content = "".join(code_lines)
    
    # Adjust paths since the script is now in production_pipeline/scripts/
    script_content = script_content.replace("../../data/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv", "../../data/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv")
    script_content = script_content.replace("MODEL_DIR = Path(\"./models\")", "MODEL_DIR = Path(\"../models\")")
    script_content = script_content.replace("MODEL_DIR = Path('../models')", "MODEL_DIR = Path('../models')")
    
    with open(output_script_path, 'w', encoding='utf-8') as f:
        f.write(script_content)

# Convert P1
p1_in = os.path.join(ml_dir, "notebooks", "p1_impact_forecaster_v3.ipynb")
p1_out = os.path.join(scripts_dir, "step1_impact_forecaster.py")
if os.path.exists(p1_in):
    convert_notebook_to_script(p1_in, p1_out, "step1")
    print("Converted Step 1")

# Convert P2
p2_in = os.path.join(ml_dir, "notebooks", "p2_congestion_heatmap.ipynb")
p2_out = os.path.join(scripts_dir, "step2_congestion_heatmap.py")
if os.path.exists(p2_in):
    convert_notebook_to_script(p2_in, p2_out, "step2")
    print("Converted Step 2")

# Create Step 3
p3_out = os.path.join(scripts_dir, "step3_deployment_recommender.py")
with open(p3_out, "w", encoding="utf-8") as f:
    f.write(f"""import sys
import os
# Add the original ml modules to path
sys.path.append(r"{os.path.join(ml_dir, 'p3_deployment')}")
try:
    import demo_runner
    print("Step 3: Deployment Recommender executed.")
except Exception as e:
    print(f"Error running Step 3: {{e}}")
""")
print("Created Step 3 wrapper")

# Create Step 4
p4_out = os.path.join(scripts_dir, "step4_anomaly_simulator.py")
with open(p4_out, "w", encoding="utf-8") as f:
    f.write(f"""import sys
import os
# Add the original ml pipelines to path
sys.path.append(r"{os.path.join(ml_dir, 'pipelines')}")
try:
    import historical_replay_simulator
    print("Step 4: Anomaly Simulator executed.")
except Exception as e:
    print(f"Error running Step 4: {{e}}")
""")
print("Created Step 4 wrapper")

# Create PowerShell runner
runner_path = os.path.join(prod_dir, "run_all.ps1")
with open(runner_path, "w", encoding="utf-8") as f:
    f.write("""Write-Host "=========================================="
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
""")
print("Created run_all.ps1")
