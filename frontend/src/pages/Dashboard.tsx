import { useQuery } from '@tanstack/react-query';
import {
  api,
  type HealthResponse,
  type CorridorRiskItem,
} from '../api/client';
import StatCard from '../components/StatCard';
import { SkeletonCard } from '../components/Loading';
import InteractiveInsights from '../components/InteractiveInsights';
import {
  Shield,
  AlertTriangle,
  Clock,
  MapPin,
  TrendingUp,
  Activity,
  Cpu,
  Wifi,
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
  HIGH:   '#ef4444',
  MEDIUM: '#f59e0b',
  LOW:    '#2ecc71',
};

const TOOLTIP_STYLE = {
  background: '#1b2024',
  border: '1px solid rgba(46,204,113,0.25)',
  borderRadius: '10px',
  fontSize: '12px',
  color: '#e5e7eb',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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

  const highRisk   = corridors.data?.filter(c => c.risk_tier === 'HIGH')   || [];
  const medRisk    = corridors.data?.filter(c => c.risk_tier === 'MEDIUM') || [];
  const totalEvents = corridors.data?.reduce((s, c) => s + c.event_count, 0) || 0;

  const riskPieData = [
    { name: 'HIGH',   value: highRisk.length,                                                        color: RISK_COLORS.HIGH },
    { name: 'MEDIUM', value: medRisk.length,                                                          color: RISK_COLORS.MEDIUM },
    { name: 'LOW',    value: (corridors.data?.length || 0) - highRisk.length - medRisk.length,        color: RISK_COLORS.LOW },
  ].filter(d => d.value > 0);

  const topCorridors = corridors.data?.slice(0, 8) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: health.data?.status === 'healthy' ? '#2ecc71' : '#ef4444',
              boxShadow: `0 0 10px ${health.data?.status === 'healthy' ? 'rgba(46,204,113,0.8)' : 'rgba(239,68,68,0.8)'}`,
            }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Live Dashboard
            </span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#f3f4f6', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Command Center
          </h1>
          <p style={{ fontSize: '15px', color: '#6b7280', marginTop: '8px', fontWeight: 400 }}>
            Real-time Bengaluru traffic intelligence & incident management
          </p>
        </div>

        {/* Live badge */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', borderRadius: '12px',
            background: '#111417', border: '1px solid rgba(255,255,255,0.07)',
            fontSize: '13px', color: '#9ca3af',
          }}>
            <Cpu size={14} color="#2ecc71" />
            <span>{health.data?.model_count || 0}/4 models</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', borderRadius: '12px',
            background: '#111417', border: '1px solid rgba(255,255,255,0.07)',
            fontSize: '13px', color: '#9ca3af',
          }}>
            <Wifi size={14} color="#2ecc71" />
            <span>Auto-refresh 10s</span>
          </div>
        </div>
      </div>

      {/* ── Insights Widget ── */}
      <InteractiveInsights />

      {/* ── Stat Cards ── */}
      <div>
        <div className="section-header">
          <Activity size={14} />
          Key Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {health.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                title="System Status"
                value={health.data?.status === 'healthy' ? 'Healthy' : 'Degraded'}
                subtitle={`${health.data?.model_count || 0}/4 models loaded`}
                icon={<Shield size={22} />}
                color={health.data?.status === 'healthy' ? 'accent' : 'danger'}
              />
              <StatCard
                title="High-Risk Corridors"
                value={highRisk.length}
                subtitle={`${medRisk.length} medium risk · ${totalEvents.toLocaleString()} total events`}
                icon={<AlertTriangle size={22} />}
                color="danger"
              />
              <StatCard
                title="Monitored Corridors"
                value={corridors.data?.length || 0}
                subtitle="Active corridor monitoring"
                icon={<MapPin size={22} />}
                color="primary"
              />
              <StatCard
                title="API Uptime"
                value={formatUptime(health.data?.uptime_seconds || 0)}
                subtitle="Continuous operation"
                icon={<Clock size={22} />}
                color="accent"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Bar Chart */}
        <div style={{
          background: '#111417', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <div className="section-header">
            <TrendingUp size={14} />
            Top Corridors — Risk Score
          </div>
          {corridors.isLoading ? (
            <div className="skeleton" style={{ height: '280px', width: '100%' }} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCorridors} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 1]} tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="corridor"
                  width={130}
                  tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: any) => [Number(value).toFixed(3), 'Risk Score']}
                  cursor={{ fill: 'rgba(46,204,113,0.04)' }}
                />
                <Bar dataKey="risk_score" radius={[0, 6, 6, 0]}>
                  {topCorridors.map((c, i) => (
                    <Cell
                      key={i}
                      fill={RISK_COLORS[c.risk_tier as keyof typeof RISK_COLORS] || '#2ecc71'}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div style={{
          background: '#111417', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <div className="section-header">
            <Activity size={14} />
            Risk Distribution
          </div>
          {corridors.isLoading ? (
            <div className="skeleton" style={{ height: '280px', width: '100%' }} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={riskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {riskPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {riskPieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#f3f4f6' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Corridors Table ── */}
      <div style={{
        background: '#111417', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '24px', overflow: 'hidden',
      }}>
        <div className="section-header">
          <MapPin size={14} />
          All Monitored Corridors
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Corridor</th>
                <th>Risk Tier</th>
                <th>Risk Score</th>
                <th>Events</th>
                <th>Closure Rate</th>
                <th>Peak Hour</th>
                <th>Dominant Cause</th>
              </tr>
            </thead>
            <tbody>
              {corridors.isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j}><div className="skeleton" style={{ height: '16px', width: '80%' }} /></td>
                      ))}
                    </tr>
                  ))
                : corridors.data?.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: '#e5e7eb', textTransform: 'capitalize' }}>{c.corridor}</td>
                      <td>
                        <span className={`badge ${c.risk_tier === 'HIGH' ? 'badge-danger' : c.risk_tier === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>
                          {c.risk_tier}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: RISK_COLORS[c.risk_tier as keyof typeof RISK_COLORS] || '#9ca3af' }}>
                        {c.risk_score.toFixed(3)}
                      </td>
                      <td>{c.event_count.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', maxWidth: '60px' }}>
                            <div style={{ height: '100%', background: '#2ecc71', borderRadius: '2px', width: `${c.closure_rate * 100}%` }} />
                          </div>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{(c.closure_rate * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>{c.peak_hour}:00</td>
                      <td style={{ color: '#6b7280', textTransform: 'capitalize', fontSize: '13px' }}>{c.dominant_cause.replace(/_/g, ' ')}</td>
                    </tr>
                  ))
              }
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
