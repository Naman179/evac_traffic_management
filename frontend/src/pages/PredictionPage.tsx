import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, type PredictRequest } from '../api/client';
import { Spinner } from '../components/Loading';
import {
  Crosshair, Send, Shield, Clock, AlertTriangle, TrendingUp, BarChart2,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell,
} from 'recharts';
import toast from 'react-hot-toast';

const CAUSES = [
  'vehicle_breakdown', 'accident', 'pot_holes', 'construction',
  'water_logging', 'tree_fall', 'road_conditions', 'congestion',
  'public_event', 'procession', 'vip_movement', 'protest', 'debris',
];

const CORRIDORS = [
  'Mysore Road', 'Bellary Road 1', 'Bellary Road 2', 'Hosur Road',
  'Tumkur Road', 'ORR North 1', 'ORR North 2', 'ORR East 1', 'ORR East 2',
  'Old Madras Road', 'Magadi Road', 'Bannerghata Road', 'Hennur Main Road',
  'Varthur Road', 'Old Airport Road', 'CBD 1', 'CBD 2',
];

const card = {
  background: '#111417',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
  padding: '28px',
};

export default function PredictionPage() {
  const [form, setForm] = useState<PredictRequest>({
    cause: 'accident',
    corridor: 'Mysore Road',
    zone: '',
    veh_type: '',
    start_datetime: new Date().toISOString().slice(0, 16),
    lat: 12.95,
    lon: 77.55,
    is_planned: false,
  });

  const { data: featureImportance } = useQuery({
    queryKey: ['feature-importance'],
    queryFn: () => api.getFeatureImportance(),
  });

  const mutation = useMutation({
    mutationFn: (data: PredictRequest) => api.predict(data),
    onError: (err: Error) => toast.error(err.message),
    onSuccess: () => toast.success('Prediction complete!'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ ...form, start_datetime: new Date(form.start_datetime).toISOString() });
  };

  const result = mutation.data;

  const radarData = result ? [
    { metric: 'Impact',      value: result.composite_impact_score * 10 },
    { metric: 'Closure',     value: result.closure_probability * 100 },
    { metric: 'Priority',    value: result.priority_high_probability * 100 },
    { metric: 'Duration',    value: Math.min(result.expected_duration_h * 5, 100) },
    { metric: 'P90 Dur.',    value: Math.min(result.expected_duration_p90_h * 3, 100) },
  ] : [];

  const scoreColor = result
    ? result.composite_impact_score >= 7 ? '#ef4444'
    : result.composite_impact_score >= 4 ? '#f59e0b'
    : '#2ecc71'
    : '#2ecc71';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.2)' }}>
            <Crosshair size={20} color="#2ecc71" />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f3f4f6', letterSpacing: '-0.03em' }}>Impact Prediction</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>P1 Impact Forecaster · ML-powered incident analysis</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── Input Form ── */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <div style={{ width: '3px', height: '18px', background: '#2ecc71', borderRadius: '2px' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#e5e7eb' }}>Incident Details</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">Incident Cause</label>
                <select className="input-field" value={form.cause} onChange={e => setForm({ ...form, cause: e.target.value })}>
                  {CAUSES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Corridor</label>
                <select className="input-field" value={form.corridor} onChange={e => setForm({ ...form, corridor: e.target.value })}>
                  <option value="">None</option>
                  {CORRIDORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {form.cause === 'vehicle_breakdown' && (
              <div>
                <label className="form-label">Vehicle Type</label>
                <select className="input-field" value={form.veh_type} onChange={e => setForm({ ...form, veh_type: e.target.value })}>
                  <option value="">Select vehicle type...</option>
                  <option value="Two Wheeler">Two Wheeler</option>
                  <option value="Three Wheeler">Three Wheeler</option>
                  <option value="Four Wheeler">Four Wheeler</option>
                  <option value="Heavy Vehicle">Heavy Vehicle</option>
                </select>
              </div>
            )}

            <div>
              <label className="form-label">Date & Time</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.start_datetime}
                onChange={e => setForm({ ...form, start_datetime: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">Latitude</label>
                <input type="number" step="0.001" className="input-field" value={form.lat}
                  onChange={e => setForm({ ...form, lat: parseFloat(e.target.value) })} />
              </div>
              <div>
                <label className="form-label">Longitude</label>
                <input type="number" step="0.001" className="input-field" value={form.lon}
                  onChange={e => setForm({ ...form, lon: parseFloat(e.target.value) })} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <input
                type="checkbox"
                id="is-planned"
                checked={form.is_planned}
                onChange={e => setForm({ ...form, is_planned: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#2ecc71', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db' }}>Pre-planned event</div>
                <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>VIP movements, public events, etc.</div>
              </div>
            </label>

            <button
              type="submit"
              className="btn-primary"
              disabled={mutation.isPending}
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px' }}
            >
              {mutation.isPending ? <Spinner size={18} /> : <Send size={18} />}
              {mutation.isPending ? 'Predicting…' : 'Run Prediction'}
            </button>
          </form>
        </div>

        {/* ── Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {result ? (
            <>
              {/* Impact Score hero */}
              <div className="animate-fade-in" style={{
                ...card,
                textAlign: 'center',
                background: `linear-gradient(135deg, #111417, ${scoreColor}08)`,
                borderColor: `${scoreColor}30`,
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Composite Impact Score
                </div>
                <div style={{ fontSize: '80px', fontWeight: 900, lineHeight: 1, color: scoreColor, letterSpacing: '-0.04em' }}>
                  {result.composite_impact_score}
                </div>
                <div style={{ fontSize: '20px', color: '#4b5563', marginTop: '4px' }}>/10</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  marginTop: '16px', padding: '6px 16px', borderRadius: '999px',
                  background: `${scoreColor}15`, border: `1px solid ${scoreColor}30`,
                  fontSize: '12px', fontWeight: 700, color: scoreColor,
                }}>
                  {result.composite_impact_score >= 7 ? '⚠ HIGH IMPACT' : result.composite_impact_score >= 4 ? '⚡ MEDIUM IMPACT' : '✓ LOW IMPACT'}
                </div>
              </div>

              {/* 2x2 detail mini-cards */}
              <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Closure Probability', value: `${(result.closure_probability * 100).toFixed(1)}%`, sub: result.closure_decision ? 'LIKELY' : 'UNLIKELY', icon: <AlertTriangle size={16} />, color: result.closure_decision ? '#f87171' : '#2ecc71' },
                  { label: 'Priority (High)', value: `${(result.priority_high_probability * 100).toFixed(1)}%`, icon: <Shield size={16} />, color: '#2ecc71' },
                  { label: 'Expected Duration', value: `${result.expected_duration_h.toFixed(1)}h`, sub: `P90: ${result.expected_duration_p90_h.toFixed(1)}h`, icon: <Clock size={16} />, color: '#fbbf24' },
                  { label: 'Closure Threshold', value: `${(result.closure_threshold * 100).toFixed(0)}%`, icon: <TrendingUp size={16} />, color: '#60a5fa' },
                ].map((m, i) => (
                  <div key={i} style={{ ...card, padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: m.color }}>
                      {m.icon}
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>{m.value}</div>
                    {m.sub && (
                      <div style={{
                        display: 'inline-block', marginTop: '6px', padding: '2px 8px', borderRadius: '4px',
                        fontSize: '11px', fontWeight: 700, color: m.color,
                        background: `${m.color}18`, border: `1px solid ${m.color}30`,
                      }}>
                        {m.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Radar */}
              <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={card}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Impact Profile</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                      <Radar dataKey="value" stroke="#2ecc71" fill="#2ecc71" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Feature Importance */}
                <div style={card}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart2 size={14} /> Model Feature Importance
                  </div>
                  {featureImportance ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={Object.entries(featureImportance.features).slice(0, 5).map(([k, v]) => ({ name: k.replace('_cat', ''), value: v }))} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip contentStyle={{ background: '#111417', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {Object.entries(featureImportance.features).slice(0, 5).map((_, i) => (
                            <Cell key={i} fill="#60a5fa" opacity={0.8} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Spinner size={24} />
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: '64px 28px', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Crosshair size={28} color="#2ecc71" style={{ opacity: 0.5 }} />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#6b7280', marginBottom: '8px' }}>No prediction yet</div>
                <div style={{ fontSize: '13px', color: '#4b5563' }}>Fill in incident details and run a prediction</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
