import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest

class AnomalyDetector:
    def __init__(self, contamination=0.05, random_state=42):
        """
        Initializes the Anomaly Detector using Isolation Forest.
        """
        self.model = IsolationForest(contamination=contamination, random_state=random_state)
        self.is_trained = False
        
    def extract_features(self, df):
        """
        Extracts features for anomaly detection. We look at the rolling event counts.
        Expected columns: 'corridor', 'hour', 'event_count'
        """
        # For a simple anomaly detection on volume, we use the event_count
        features = df[['event_count']].fillna(0)
        return features

    def train(self, historical_baseline_df):
        """
        Trains the Isolation Forest on a historical baseline of event counts.
        historical_baseline_df should have 'corridor', 'hour', and 'event_count'.
        """
        X = self.extract_features(historical_baseline_df)
        if len(X) > 0:
            self.model.fit(X)
            self.is_trained = True
        else:
            raise ValueError("Empty baseline provided for training.")

    def detect_anomalies(self, current_df):
        """
        Detects if current event counts are anomalies.
        Returns the dataframe with an 'is_anomaly' boolean column.
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before calling detect_anomalies.")
            
        X = self.extract_features(current_df)
        preds = self.model.predict(X)
        # IsolationForest returns -1 for anomaly, 1 for normal
        current_df = current_df.copy()
        current_df['is_anomaly'] = (preds == -1)
        return current_df

class PostEventComparator:
    """
    Logs predicted closure/priority/duration next to real outcomes to track accuracy.
    """
    def __init__(self):
        self.log = []

    def add_event(self, incident_id, predicted_priority, predicted_closure, predicted_duration,
                  actual_priority, actual_closure, actual_duration):
        self.log.append({
            'incident_id': incident_id,
            'predicted_priority': predicted_priority,
            'predicted_closure': predicted_closure,
            'predicted_duration': predicted_duration,
            'actual_priority': actual_priority,
            'actual_closure': actual_closure,
            'actual_duration': actual_duration,
        })

    def get_accuracy_metrics(self):
        df = pd.DataFrame(self.log)
        if df.empty:
            return {}
        
        metrics = {}
        if 'predicted_closure' in df.columns and 'actual_closure' in df.columns:
            metrics['closure_accuracy'] = (df['predicted_closure'] == df['actual_closure']).mean()
            
        if 'predicted_priority' in df.columns and 'actual_priority' in df.columns:
            metrics['priority_accuracy'] = (df['predicted_priority'] == df['actual_priority']).mean()

        if 'predicted_duration' in df.columns and 'actual_duration' in df.columns:
            # Drop null actual durations to compute MAE
            valid_duration = df.dropna(subset=['actual_duration', 'predicted_duration'])
            if not valid_duration.empty:
                metrics['duration_mae'] = np.abs(valid_duration['predicted_duration'] - valid_duration['actual_duration']).mean()
            
        return metrics
