/**
 * EVAC API Client
 * ===============
 * Centralised API communication layer with retry logic,
 * error handling, and type-safe responses.
 */

const API_BASE = '/api';

interface ApiError {
  detail: string;
}

class EvacApiClient {
  private baseUrl: string;
  private retries: number;
  private timeout: number;

  constructor(baseUrl = API_BASE, retries = 2, timeout = 30000) {
    this.baseUrl = baseUrl;
    this.retries = retries;
    this.timeout = timeout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt = 0
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(error.detail);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.retries && error instanceof TypeError) {
        // Network error — retry
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        return this.request<T>(endpoint, options, attempt + 1);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ── Health & Metrics ────────────────────────────────────────────

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async getMetrics(): Promise<MetricsResponse> {
    return this.request<MetricsResponse>('/metrics');
  }

  // ── P1 Prediction ──────────────────────────────────────────────

  async predict(data: PredictRequest): Promise<PredictResponse> {
    return this.request<PredictResponse>('/predict', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFeatureImportance(): Promise<{ features: Record<string, number> }> {
    return this.request('/feature-importance');
  }

  // ── P2 Heatmap ─────────────────────────────────────────────────

  async getHeatmap(
    cause?: string,
    timeBand?: string
  ): Promise<HeatmapResponse> {
    const params = new URLSearchParams();
    if (cause) params.set('cause', cause);
    if (timeBand) params.set('time_band', timeBand);
    const qs = params.toString();
    return this.request<HeatmapResponse>(`/heatmap${qs ? `?${qs}` : ''}`);
  }

  async getHeatmapPoint(
    lat: number,
    lon: number
  ): Promise<HeatmapPointResponse> {
    return this.request<HeatmapPointResponse>(
      `/heatmap/point?lat=${lat}&lon=${lon}`
    );
  }

  async getHotspots(riskLevel?: string): Promise<HotspotResponse> {
    const qs = riskLevel ? `?risk_level=${riskLevel}` : '';
    return this.request<HotspotResponse>(`/hotspots${qs}`);
  }

  async getCorridorsRisk(minEvents = 10): Promise<CorridorRiskItem[]> {
    return this.request<CorridorRiskItem[]>(
      `/corridors/risk?min_events=${minEvents}`
    );
  }

  // ── P4 Anomaly ─────────────────────────────────────────────────

  async detectAnomalies(
    data: AnomalyDataPoint[]
  ): Promise<AnomalyDetectResponse> {
    return this.request<AnomalyDetectResponse>('/detect-anomaly', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  // ── P3 Route ───────────────────────────────────────────────────

  async getRoute(data: RouteRequest): Promise<RouteResponse> {
    return this.request<RouteResponse>('/route', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTemplates(): Promise<ResponseTemplate[]> {
    return this.request<ResponseTemplate[]>('/templates');
  }
}

// ── Type Definitions ──────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  models_loaded: boolean;
  model_count: number;
  uptime_seconds: number;
}

export interface MetricsResponse {
  total_predictions: number;
  total_anomaly_checks: number;
  total_route_requests: number;
  avg_prediction_latency_ms: number;
  uptime_seconds: number;
}

export interface PredictRequest {
  cause?: string;
  corridor?: string;
  zone?: string;
  veh_type?: string;
  police_station?: string;
  start_datetime: string;
  is_planned?: boolean;
  lat?: number;
  lon?: number;
}

export interface PredictResponse {
  closure_probability: number;
  closure_decision: boolean;
  closure_threshold: number;
  priority_high_probability: number;
  expected_duration_h: number;
  expected_duration_p90_h: number;
  composite_impact_score: number;
}

export interface HeatmapResponse {
  lat_grid: number[];
  lon_grid: number[];
  intensity: number[][];
  filter_applied: Record<string, string | null>;
}

export interface HeatmapPointResponse {
  lat: number;
  lon: number;
  density_score: number;
}

export interface HotspotResponse {
  type: string;
  features: HotspotFeature[];
  metadata: Record<string, unknown>;
}

export interface HotspotFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    cluster_id: number;
    risk_level: string;
    event_count: number;
    mean_impact: number;
    closure_rate: number;
    [key: string]: unknown;
  };
}

export interface CorridorRiskItem {
  corridor: string;
  event_count: number;
  closure_rate: number;
  mean_impact: number;
  peak_hour: number;
  risk_score: number;
  risk_tier: string;
  dominant_cause: string;
}

export interface AnomalyDataPoint {
  corridor: string;
  hour: number;
  event_count: number;
}

export interface AnomalyResult {
  corridor: string;
  hour: number;
  event_count: number;
  is_anomaly: boolean;
  confidence: number;
}

export interface AnomalyDetectResponse {
  total_points: number;
  anomaly_count: number;
  results: AnomalyResult[];
}

export interface RouteRequest {
  event_cause: string;
  corridor?: string;
  latitude: number;
  longitude: number;
  endlatitude?: number;
  endlongitude?: number;
  start_datetime?: string;
  priority?: string;
  requires_road_closure?: boolean;
}

export interface RouteResponse {
  incident_id: string;
  cause: string;
  corridor: string;
  impact_score: number;
  closure_probability: number;
  recommended_officers: number;
  recommended_barricades: number;
  equipment: string[];
  escalate_to: string[];
  diversion_triggered: boolean;
  diversion_route: Record<string, unknown> | null;
  explanation: string[];
  notes: string;
}

export interface ResponseTemplate {
  cause: string;
  base_officers: number;
  recovery_van: number;
  base_barricades: number;
  escalate_to: string[];
  equipment: string[];
  notes: string;
  priority_override: string | null;
}

// Singleton export
export const api = new EvacApiClient();
