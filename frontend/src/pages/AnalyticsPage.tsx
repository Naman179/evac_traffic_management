import { useQuery } from '@tanstack/react-query';
import { api, type CorridorRiskItem } from '../api/client';
import { PageLoader } from '../components/Loading';
import { BarChart3, Clock, MapPin, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis,
  LineChart, Line, CartesianGrid,
} from 'recharts';

export default function AnalyticsPage() {
  const corridors = useQuery<CorridorRiskItem[]>({
    queryKey: ['corridors-analytics'],
    queryFn: () => api.getCorridorsRisk(0),
  });

  const featureImportance = useQuery({
    queryKey: ['feature-importance'],
    queryFn: () => api.getFeatureImportance(),
  });

  if (corridors.isLoading) return <PageLoader />;

  const data = corridors.data || [];

  // Cause distribution
  const causeMap = new Map<string, number>();
  data.forEach((c) => {
    const cause = c.dominant_cause;
    causeMap.set(cause, (causeMap.get(cause) || 0) + c.event_count);
  });
  const causeData = Array.from(causeMap.entries())
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    .sort((a, b) => b.value - a.value);

  // Peak hour distribution
  const hourMap = new Map<number, number>();
  data.forEach((c) => {
    hourMap.set(c.peak_hour, (hourMap.get(c.peak_hour) || 0) + 1);
  });
  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    corridors: hourMap.get(h) || 0,
  }));

  // Closure rate vs risk score scatter
  const scatterData = data.map((c) => ({
    name: c.corridor,
    closure_rate: c.closure_rate * 100,
    risk_score: c.risk_score,
    events: c.event_count,
    tier: c.risk_tier,
  }));

  // Feature importance
  const featureData = featureImportance.data
    ? Object.entries(featureImportance.data.features)
        .slice(0, 12)
        .map(([name, value]) => ({
          name: name.replace(/_/g, ' ').replace(' te', ''),
          importance: Number((value * 100).toFixed(2)),
        }))
    : [];

  const TIER_COLORS: Record<string, string> = {
    HIGH: '#ef4444',
    MEDIUM: '#f59e0b',
    LOW: '#10b981',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <BarChart3 size={24} /> Analytics & Insights
        </h1>
        <p className="text-surface-700 text-sm mt-1">
          Historical trends, risk analysis, and model insights
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cause Distribution */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-primary-400" />
            Events by Dominant Cause
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={causeData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
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
              />
              <Bar dataKey="value" fill="#00c853" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hour Distribution */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-accent-400" />
            Peak Hour Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourData}>
              <CartesianGrid stroke="#151a1d" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#151a1d',
                  border: '1px solid rgba(46,204,113,0.3)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="corridors"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Closure Rate vs Risk Score */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-warning-400" />
            Closure Rate vs Risk Score
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <XAxis
                type="number"
                dataKey="closure_rate"
                name="Closure Rate %"
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="risk_score"
                name="Risk Score"
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="events" range={[50, 500]} />
              <Tooltip
                contentStyle={{
                  background: '#151a1d',
                  border: '1px solid rgba(46,204,113,0.3)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(value: any, name: any) => {
                  if (name === 'Closure Rate %') return [`${Number(value).toFixed(1)}%`, name];
                  return [value, name];
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={TIER_COLORS[entry.tier] || '#00c853'}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Feature Importance */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-danger-400" />
            Model Feature Importance (Closure Classifier)
          </h2>
          {featureData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={featureData} layout="vertical">
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#151a1d',
                    border: '1px solid rgba(46,204,113,0.3)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="importance" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-surface-700 text-sm text-center py-12">
              Feature importance data not available
            </p>
          )}
        </div>
      </div>

      {/* Events per corridor bar */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-surface-200 mb-4">
          Events per Corridor
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.filter((d) => d.corridor !== 'non-corridor')}>
            <XAxis
              dataKey="corridor"
              tick={{ fill: '#94a3b8', fontSize: 9 }}
              angle={-35}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: '#151a1d',
                border: '1px solid rgba(46,204,113,0.3)',
                borderRadius: 10,
                fontSize: 12,
              }}
            />
            <Bar dataKey="event_count" radius={[6, 6, 0, 0]}>
              {data
                .filter((d) => d.corridor !== 'non-corridor')
                .map((c, i) => (
                  <Cell
                    key={i}
                    fill={TIER_COLORS[c.risk_tier] || '#00c853'}
                  />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
