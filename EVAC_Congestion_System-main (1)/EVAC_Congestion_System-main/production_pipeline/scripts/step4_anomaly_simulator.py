import sys
import os
# Add the original ml pipelines to path
sys.path.append(r"c:\Users\HP\Downloads\gridhackathon\gridhackathon\EVAC_Congestion_System-main\EVAC_Congestion_System-main\ml\pipelines")
try:
    import historical_replay_simulator
    print("Step 4: Anomaly Simulator executed.")
except Exception as e:
    print(f"Error running Step 4: {e}")
