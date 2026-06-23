import sys
import os
# Add the original ml modules to path
sys.path.append(r"c:\Users\HP\Downloads\gridhackathon\gridhackathon\EVAC_Congestion_System-main\EVAC_Congestion_System-main\ml\p3_deployment")
try:
    import demo_runner
    print("Step 3: Deployment Recommender executed.")
except Exception as e:
    print(f"Error running Step 3: {e}")
