import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type PredictRequest } from '../api/client';
import { Spinner } from '../components/Loading';
import {
  Crosshair,
  Send,
  Shield,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
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

export default function PredictionPage() {
  const [form, setForm] = useState<PredictRequest>({
    cause: 'accident',
    corridor: 'Mysore Road',
    zone: '',
    start_datetime: new Date().toISOString().slice(0, 16),
    lat: 12.95,
    lon: 77.55,
    is_planned: false,
  });

  const mutation = useMutation({
    mutationFn: (data: PredictRequest) => api.predict(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      start_datetime: new Date(form.start_datetime).toISOString(),
    });
  };

  const result = mutation.data;

  const radarData = result
    ? [
        { metric: 'Impact', value: result.composite_impact_score * 10 },
        { metric: 'Closure', value: result.closure_probability * 100 },
        { metric: 'Priority', value: result.priority_high_probability * 100 },
        { metric: 'Duration', value: Math.min(result.expected_duration_h * 5, 100) },
        { metric: 'P90 Duration', value: Math.min(result.expected_duration_p90_h * 3, 100) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <Crosshair size={24} /> Impact Prediction
        </h1>
        <p className="text-surface-700 text-sm mt-1">
          Predict incident impact using the P1 Impact Forecaster model
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">
            Incident Details
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-surface-700 mb-1 block">Cause</label>
                <select
                  className="input-field"
                  value={form.cause}
                  onChange={(e) => setForm({ ...form, cause: e.target.value })}
                >
                  {CAUSES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-surface-700 mb-1 block">Corridor</label>
                <select
                  className="input-field"
                  value={form.corridor}
                  onChange={(e) => setForm({ ...form, corridor: e.target.value })}
                >
                  <option value="">None</option>
                  {CORRIDORS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-surface-700 mb-1 block">Date & Time</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.start_datetime}
                onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-surface-700 mb-1 block">Latitude</label>
                <input
                  type="number"
                  step="0.001"
                  className="input-field"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-surface-700 mb-1 block">Longitude</label>
                <input
                  type="number"
                  step="0.001"
                  className="input-field"
                  value={form.lon}
                  onChange={(e) => setForm({ ...form, lon: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-planned"
                checked={form.is_planned}
                onChange={(e) => setForm({ ...form, is_planned: e.target.checked })}
                className="w-4 h-4 rounded accent-primary-500"
              />
              <label htmlFor="is-planned" className="text-sm text-surface-700">
                Pre-planned event
              </label>
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Spinner size={16} /> : <Send size={16} />}
              {mutation.isPending ? 'Predicting...' : 'Predict Impact'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Impact Score */}
              <div className="glass-card p-6 text-center animate-fade-in">
                <p className="text-xs text-surface-700 uppercase tracking-wider">
                  Composite Impact Score
                </p>
                <div className="mt-3">
                  <span
                    className={`text-6xl font-black ${
                      result.composite_impact_score >= 7
                        ? 'text-danger-400'
                        : result.composite_impact_score >= 4
                        ? 'text-warning-400'
                        : 'text-accent-400'
                    }`}
                  >
                    {result.composite_impact_score}
                  </span>
                  <span className="text-2xl text-surface-700">/10</span>
                </div>
              </div>

              {/* Detail Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-surface-700">
                    <AlertTriangle size={14} className="text-warning-400" />
                    Closure Probability
                  </div>
                  <p className="text-xl font-bold mt-1 text-surface-100">
                    {(result.closure_probability * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs mt-0.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        result.closure_decision
                          ? 'bg-danger-500/20 text-danger-400'
                          : 'bg-accent-500/20 text-accent-400'
                      }`}
                    >
                      {result.closure_decision ? 'LIKELY' : 'UNLIKELY'}
                    </span>
                  </p>
                </div>
                <div className="glass-card p-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-surface-700">
                    <Shield size={14} className="text-primary-400" />
                    Priority (High)
                  </div>
                  <p className="text-xl font-bold mt-1 text-surface-100">
                    {(result.priority_high_probability * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="glass-card p-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-surface-700">
                    <Clock size={14} className="text-accent-400" />
                    Expected Duration
                  </div>
                  <p className="text-xl font-bold mt-1 text-surface-100">
                    {result.expected_duration_h.toFixed(1)}h
                  </p>
                  <p className="text-xs text-surface-700">
                    P90: {result.expected_duration_p90_h.toFixed(1)}h
                  </p>
                </div>
                <div className="glass-card p-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-surface-700">
                    <TrendingUp size={14} className="text-warning-400" />
                    Threshold
                  </div>
                  <p className="text-xl font-bold mt-1 text-surface-100">
                    {(result.closure_threshold * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="glass-card p-6 animate-fade-in">
                <h3 className="text-xs text-surface-700 uppercase mb-2">
                  Impact Profile
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Radar
                      dataKey="value"
                      stroke="#00c853"
                      fill="#00c853"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="glass-card p-12 text-center text-surface-700">
              <Crosshair size={48} className="mx-auto mb-4 opacity-30" />
              <p>Fill in incident details and click Predict to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
