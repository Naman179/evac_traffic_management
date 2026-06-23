import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type AnomalyDataPoint } from '../api/client';
import { Spinner } from '../components/Loading';
import StatCard from '../components/StatCard';
import { AlertTriangle, Plus, Trash2, Search, ShieldAlert, CheckCircle, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import toast from 'react-hot-toast';

const SAMPLE_DATA: AnomalyDataPoint[] = [
  { corridor: 'Mysore Road', hour: 6, event_count: 15 },
  { corridor: 'Mysore Road', hour: 7, event_count: 45 },
  { corridor: 'Bellary Road 1', hour: 5, event_count: 8 },
  { corridor: 'Bellary Road 1', hour: 20, event_count: 62 },
  { corridor: 'ORR North 1', hour: 19, event_count: 30 },
  { corridor: 'Hosur Road', hour: 21, event_count: 55 },
  { corridor: 'Tumkur Road', hour: 22, event_count: 12 },
  { corridor: 'Old Madras Road', hour: 4, event_count: 70 },
];

const card = {
  background: '#111417',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
  padding: '24px',
};

export default function AnomalyPage() {
  const [dataPoints, setDataPoints] = useState<AnomalyDataPoint[]>(SAMPLE_DATA);
  const [newPoint, setNewPoint] = useState<AnomalyDataPoint>({
    corridor: '',
    hour: 12,
    event_count: 10,
  });

  const mutation = useMutation({
    mutationFn: (data: AnomalyDataPoint[]) => api.detectAnomalies(data),
    onError: (err: Error) => toast.error(err.message),
    onSuccess: (data) => {
      toast.success(`Detected ${data.anomaly_count} anomalies out of ${data.total_points} points`);
    },
  });

  const addPoint = () => {
    if (!newPoint.corridor) {
      toast.error('Enter a corridor name');
      return;
    }
    setDataPoints([...dataPoints, { ...newPoint }]);
    setNewPoint({ corridor: '', hour: 12, event_count: 10 });
  };

  const removePoint = (index: number) => {
    setDataPoints(dataPoints.filter((_, i) => i !== index));
  };

  const result = mutation.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade-in">
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Activity size={20} color="#ef4444" />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f3f4f6', letterSpacing: '-0.03em' }}>
              Anomaly Detection
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
              Catch unplanned traffic spikes using the Isolation Forest model
            </p>
          </div>
        </div>
      </div>

      {/* Stat Row */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }} className="animate-fade-in">
          <StatCard
            title="Total Points Analyzed"
            value={result.total_points}
            icon={<Search size={20} />}
            color="primary"
            description="The total number of corridor-hour data points fed into the anomaly detection model for scanning."
          />
          <StatCard
            title="Anomalies Found"
            value={result.anomaly_count}
            subtitle={`${((result.anomaly_count / result.total_points) * 100).toFixed(1)}% anomaly rate`}
            icon={<ShieldAlert size={20} />}
            color="danger"
            description="The number of unusual spikes in traffic events that deviate significantly from historical baselines. These require attention."
          />
          <StatCard
            title="Normal Traffic Patterns"
            value={result.total_points - result.anomaly_count}
            icon={<CheckCircle size={20} />}
            color="accent"
            description="Data points that perfectly match the expected traffic patterns and historical event frequencies."
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'start' }}>
        {/* Data Input */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <div style={{ width: '3px', height: '18px', background: '#ef4444', borderRadius: '2px' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#e5e7eb' }}>Data Pipeline Input</span>
          </div>

          {/* Add Row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input
              className="input-field"
              style={{ flex: '1 1 120px' }}
              placeholder="Corridor name"
              value={newPoint.corridor}
              onChange={(e) => setNewPoint({ ...newPoint, corridor: e.target.value })}
            />
            <input
              type="number"
              className="input-field"
              style={{ width: '80px' }}
              min={0}
              max={23}
              placeholder="Hour (0-23)"
              title="Hour (0-23)"
              value={newPoint.hour}
              onChange={(e) => setNewPoint({ ...newPoint, hour: parseInt(e.target.value) })}
            />
            <input
              type="number"
              className="input-field"
              style={{ width: '90px' }}
              min={0}
              placeholder="Events"
              title="Event Count"
              value={newPoint.event_count}
              onChange={(e) => setNewPoint({ ...newPoint, event_count: parseInt(e.target.value) })}
            />
            <button
              type="button"
              onClick={addPoint}
              className="btn-primary"
              style={{ padding: '0 16px', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Data Table */}
          <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
            {dataPoints.map((dp, i) => {
              const res = result?.results[i];
              const isAnomaly = res?.is_anomaly;
              
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: '10px',
                    background: isAnomaly ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isAnomaly ? 'rgba(239,68,68,0.2)' : 'transparent'}`,
                  }}
                >
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dp.corridor}
                  </span>
                  <span style={{ fontSize: '13px', color: '#9ca3af', width: '45px', textAlign: 'right' }}>
                    {dp.hour}:00
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#d1d5db', width: '50px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {dp.event_count}
                  </span>
                  
                  {res ? (
                    <span
                      style={{
                        fontSize: '11px', fontWeight: 700, width: '70px', textAlign: 'center',
                        padding: '4px 0', borderRadius: '6px',
                        background: isAnomaly ? 'rgba(239,68,68,0.15)' : 'rgba(46,204,113,0.15)',
                        color: isAnomaly ? '#f87171' : '#2ecc71',
                      }}
                    >
                      {isAnomaly ? `⚠ ${(res.confidence * 100).toFixed(0)}%` : '✓ Normal'}
                    </span>
                  ) : (
                    <span style={{ width: '70px' }} />
                  )}

                  <button
                    onClick={() => removePoint(i)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => mutation.mutate(dataPoints)}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '20px', padding: '14px' }}
            disabled={mutation.isPending || dataPoints.length === 0}
          >
            {mutation.isPending ? <Spinner size={16} /> : <Search size={16} />}
            {mutation.isPending ? 'Analyzing Isolation Forest...' : 'Run Anomaly Detection'}
          </button>
        </div>

        {/* Results Chart */}
        <div style={{ ...card, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <div style={{ width: '3px', height: '18px', background: '#3b82f6', borderRadius: '2px' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#e5e7eb' }}>Event Distribution & Flags</span>
          </div>

          {result ? (
            <ResponsiveContainer width="100%" height={440}>
              <BarChart data={result.results} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <XAxis
                  dataKey="corridor"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  height={80}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#111417',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  itemStyle={{ color: '#d1d5db' }}
                  labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                  formatter={(value: any, name: any) => {
                    if (name === 'event_count') return [value, 'Event Count'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="event_count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {result.results.map((r, i) => (
                    <Cell
                      key={i}
                      fill={r.is_anomaly ? '#ef4444' : '#2ecc71'}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '440px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <AlertTriangle size={32} color="#4b5563" />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px' }}>No Data Analyzed</div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Add points and run the detector to visualize spikes</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
