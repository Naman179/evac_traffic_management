import { useQuery } from '@tanstack/react-query';
import { api, type HealthResponse, type MetricsResponse } from '../api/client';
import StatCard from '../components/StatCard';
import { SkeletonCard } from '../components/Loading';
import {
  Activity,
  Cpu,
  Zap,
  Clock,
  BarChart2,
  Server,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function MonitoringPage() {
  const health = useQuery<HealthResponse>({
    queryKey: ['health-monitoring'],
    queryFn: () => api.getHealth(),
    refetchInterval: 5000,
  });

  const metrics = useQuery<MetricsResponse>({
    queryKey: ['metrics-monitoring'],
    queryFn: () => api.getMetrics(),
    refetchInterval: 5000,
  });

  const h = health.data;
  const m = metrics.data;

  const services = [
    { name: 'P1 Impact Forecaster', status: h?.model_count ? h.model_count >= 1 : false },
    { name: 'P2 Spatial / Heatmap', status: h?.model_count ? h.model_count >= 2 : false },
    { name: 'P3 Deployment Engine', status: h?.model_count ? h.model_count >= 4 : false },
    { name: 'P4 Anomaly Detector', status: h?.model_count ? h.model_count >= 3 : false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <Activity size={24} /> System Monitoring
        </h1>
        <p className="text-surface-700 text-sm mt-1">
          Backend health, API performance, and model status
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {health.isLoading || metrics.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="API Status"
              value={h?.status === 'healthy' ? 'Healthy' : 'Degraded'}
              subtitle={`v${h?.version || '?'}`}
              icon={<Server size={20} />}
              color={h?.status === 'healthy' ? 'accent' : 'danger'}
            />
            <StatCard
              title="Total Predictions"
              value={m?.total_predictions || 0}
              subtitle={`${m?.total_anomaly_checks || 0} anomaly checks`}
              icon={<BarChart2 size={20} />}
              color="primary"
            />
            <StatCard
              title="Avg Latency"
              value={`${(m?.avg_prediction_latency_ms || 0).toFixed(1)}ms`}
              subtitle="Per prediction"
              icon={<Zap size={20} />}
              color="warning"
            />
            <StatCard
              title="Uptime"
              value={formatUptime(m?.uptime_seconds || 0)}
              subtitle="Since last restart"
              icon={<Clock size={20} />}
              color="accent"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Status */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <Cpu size={16} className="text-primary-400" />
            Model Services
          </h2>
          <div className="space-y-3">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-900/50"
              >
                <div className="flex items-center gap-3">
                  {svc.status ? (
                    <CheckCircle size={18} className="text-accent-400" />
                  ) : (
                    <XCircle size={18} className="text-danger-400" />
                  )}
                  <span className="text-sm text-surface-200">{svc.name}</span>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    svc.status
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'bg-danger-500/20 text-danger-400'
                  }`}
                >
                  {svc.status ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* API Metrics Detail */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-accent-400" />
            API Usage Breakdown
          </h2>
          <div className="space-y-4">
            <MetricRow
              label="Impact Predictions"
              value={m?.total_predictions || 0}
              color="primary"
            />
            <MetricRow
              label="Anomaly Checks"
              value={m?.total_anomaly_checks || 0}
              color="warning"
            />
            <MetricRow
              label="Route Requests"
              value={m?.total_route_requests || 0}
              color="accent"
            />
            <MetricRow
              label="Avg Prediction Latency"
              value={`${(m?.avg_prediction_latency_ms || 0).toFixed(2)} ms`}
              color="danger"
            />
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-accent-400 pulse-glow" />
        <p className="text-xs text-surface-700">
          Auto-refreshing every 5 seconds • Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: 'text-primary-400',
    accent: 'text-accent-400',
    danger: 'text-danger-400',
    warning: 'text-warning-400',
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-900/50">
      <span className="text-sm text-surface-700">{label}</span>
      <span className={`text-lg font-bold ${colorClasses[color] || 'text-surface-200'}`}>
        {value}
      </span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
