import pandas as pd
import time
import os
import sys
from datetime import datetime, timedelta

# Add the models directory to the path so we can import anomaly_detector
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'models'))
from anomaly_detector import AnomalyDetector, PostEventComparator

def load_data(csv_path):
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path, low_memory=False)
    df['start_datetime'] = pd.to_datetime(df['start_datetime'], errors='coerce')
    df = df.dropna(subset=['start_datetime'])
    df = df.sort_values('start_datetime')
    return df

def simulate_replay(df, speed_factor=1000):
    """
    Simulates a live feed by replaying the CSV dataset chronologically.
    """
    # Create baseline (e.g., first 3 months as baseline)
    min_date = df['start_datetime'].min()
    baseline_cutoff = min_date + timedelta(days=90)
    
    baseline_df = df[df['start_datetime'] < baseline_cutoff].copy()
    stream_df = df[df['start_datetime'] >= baseline_cutoff].copy()
    
    print(f"Baseline events: {len(baseline_df)}")
    print(f"Streaming events: {len(stream_df)}")
    
    # Compute baseline event counts per corridor per hour
    baseline_df['hour'] = baseline_df['start_datetime'].dt.hour
    baseline_df['corridor'] = baseline_df['corridor'].fillna('Non-corridor')
    
    baseline_counts = baseline_df.groupby(['corridor', 'hour']).size().reset_index(name='event_count')
    
    # Train Anomaly Detector
    detector = AnomalyDetector(contamination=0.05)
    try:
        detector.train(baseline_counts)
        print("Anomaly Detector Trained Successfully.")
    except ValueError as e:
        print(f"Error training detector: {e}")
        return
    
    comparator = PostEventComparator()
    
    # Stream events day by day
    stream_df['date'] = stream_df['start_datetime'].dt.date
    stream_df['hour'] = stream_df['start_datetime'].dt.hour
    stream_df['corridor'] = stream_df['corridor'].fillna('Non-corridor')
    
    unique_dates = stream_df['date'].unique()
    
    total_anomalies = 0
    
    for current_date in unique_dates:
        daily_events = stream_df[stream_df['date'] == current_date]
        print(f"\n--- Replaying Date: {current_date} ({len(daily_events)} events) ---")
        
        # Aggregate current day's events by corridor and hour
        daily_counts = daily_events.groupby(['corridor', 'hour']).size().reset_index(name='event_count')
        
        if not daily_counts.empty:
            results = detector.detect_anomalies(daily_counts)
            anomalies = results[results['is_anomaly'] == True]
            if not anomalies.empty:
                print(f"ANOMALY DETECTED: {len(anomalies)} corridor-hour spikes.")
                total_anomalies += len(anomalies)
                for _, row in anomalies.iterrows():
                    print(f"  - Corridor: {row['corridor']}, Hour: {row['hour']}:00, Events: {row['event_count']}")
                    
        # Simulate post-event comparator logging
        for _, event in daily_events.iterrows():
            # Mock predicted values for demonstration since P1 models are not directly integrated here
            predicted_priority = "High" if event.get('event_cause') == 'vehicle_breakdown' else "Low"
            predicted_closure = True if event.get('requires_road_closure') == True else False
            predicted_duration = 2.0
            
            # Extract actual
            actual_priority = event.get('priority', "Low")
            actual_closure = event.get('requires_road_closure', False)
            actual_duration = None # We lack parsed duration
            
            comparator.add_event(
                event.get('id', 'Unknown'), predicted_priority, predicted_closure, predicted_duration,
                actual_priority, actual_closure, actual_duration
            )
            
        time.sleep(1 / speed_factor)
        
    print("\n==================================")
    print("--- Simulation Complete ---")
    print(f"Total anomalies flagged: {total_anomalies}")
    print("Accuracy Metrics:")
    metrics = comparator.get_accuracy_metrics()
    for k, v in metrics.items():
        print(f"  {k}: {v:.2f}")
    print("==================================")

if __name__ == "__main__":
    # Point to the actual data file
    data_path = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv')
    if os.path.exists(data_path):
        df = load_data(data_path)
        simulate_replay(df, speed_factor=100) # Speed factor controls sleep duration
    else:
        print(f"Data file not found at {data_path}. Please check the path.")
