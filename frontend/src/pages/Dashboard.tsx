import { useQuery } from '@tanstack/react-query';
import {
  api,
  type HealthResponse,
  type CorridorRiskItem,
} from '../api/client';
import StatCard from '../components/StatCard';
import { SkeletonCard } from '../components/Loading';
import {
  Shield,
  AlertTriangle,
  Clock,
  MapPin,
  TrendingUp,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const RISK_COLORS = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

export default function Dashboard() {
  const health = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 10000,
  });

  const corridors = useQuery<CorridorRiskItem[]>({
    queryKey: ['corridors'],
    queryFn: () => api.getCorridorsRisk(10),
  });

  const highRisk = corridors.data?.filter((c) => c.risk_tier === 'HIGH') || [];
  const medRisk = corridors.data?.filter((c) => c.risk_tier === 'MEDIUM') || [];
  const totalEvents = corridors.data?.reduce((s, c) => s + c.event_count, 0) || 0;

  const riskPieData = [
    { name: 'HIGH', value: highRisk.length, color: RISK_COLORS.HIGH },
    { name: 'MEDIUM', value: medRisk.length, color: RISK_COLORS.MEDIUM },
    {
      name: 'LOW',
      value: (corridors.data?.length || 0) - highRisk.length - medRisk.length,
      color: RISK_COLORS.LOW,
    },
  ];

  const topCorridors = corridors.data?.slice(0, 8) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold gradient-text">
          Command Center Dashboard
        </h1>
        <p className="text-surface-700 text-sm mt-1">
          Real-time overview of Bengaluru traffic congestion & incident management
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {health.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="System Status"
              value={health.data?.status === 'healthy' ? 'Healthy' : 'Degraded'}
              subtitle={`${health.data?.model_count || 0}/4 models loaded`}
              icon={<Shield size={20} />}
              color={health.data?.status === 'healthy' ? 'accent' : 'danger'}
            />
            <StatCard
              title="High-Risk Corridors"
              value={highRisk.length}
              subtitle={`${medRisk.length} medium, ${totalEvents.toLocaleString()} total events`}
              icon={<AlertTriangle size={20} />}
              color="danger"
            />
            <StatCard
              title="Monitored Corridors"
              value={corridors.data?.length || 0}
              subtitle="Active corridor monitoring"
              icon={<MapPin size={20} />}
              color="primary"
            />
            <StatCard
              title="Uptime"
              value={formatUptime(health.data?.uptime_seconds || 0)}
              subtitle="API uptime"
              icon={<Clock size={20} />}
              color="accent"
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Corridors by Risk Score */}
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-primary-400" />
            Top Corridors by Risk Score
          </h2>
          {corridors.isLoading ? (
            <div className="skeleton h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topCorridors} layout="vertical">
                <XAxis type="number" domain={[0, 1]} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="corridor"
                  width={120}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#151a1d',
                    border: '1px solid rgba(46,204,113,0.3)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(value: any) => [Number(value).toFixed(3), 'Risk Score']}
                />
                <Bar dataKey="risk_score" radius={[0, 6, 6, 0]}>
                  {topCorridors.map((c, i) => (
                    <Cell
                      key={i}
                      fill={
                        RISK_COLORS[c.risk_tier as keyof typeof RISK_COLORS] ||
                        '#00c853'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Risk Distribution Pie */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-accent-400" />
            Risk Distribution
          </h2>
          {corridors.isLoading ? (
            <div className="skeleton h-64 w-full rounded-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={riskPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {riskPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#151a1d',
                    border: '1px solid rgba(46,204,113,0.3)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Corridor Table */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-surface-200 mb-4">
          All Monitored Corridors
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-surface-700 border-b border-surface-800">
                <th className="pb-3 px-3">Corridor</th>
                <th className="pb-3 px-3">Risk Tier</th>
                <th className="pb-3 px-3">Risk Score</th>
                <th className="pb-3 px-3">Events</th>
                <th className="pb-3 px-3">Closure Rate</th>
                <th className="pb-3 px-3">Peak Hour</th>
                <th className="pb-3 px-3">Dominant Cause</th>
              </tr>
            </thead>
            <tbody>
              {corridors.data?.map((c, i) => (
                <tr
                  key={i}
                  className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors"
                >
                  <td className="py-3 px-3 font-medium text-surface-200 capitalize">
                    {c.corridor}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        c.risk_tier === 'HIGH'
                          ? 'bg-danger-500/20 text-danger-400'
                          : c.risk_tier === 'MEDIUM'
                          ? 'bg-warning-500/20 text-warning-400'
                          : 'bg-accent-500/20 text-accent-400'
                      }`}
                    >
                      {c.risk_tier}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-surface-200">
                    {c.risk_score.toFixed(3)}
                  </td>
                  <td className="py-3 px-3 text-surface-200">
                    {c.event_count.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-surface-200">
                    {(c.closure_rate * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-surface-200">
                    {c.peak_hour}:00
                  </td>
                  <td className="py-3 px-3 text-surface-700 capitalize">
                    {c.dominant_cause.replace('_', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
