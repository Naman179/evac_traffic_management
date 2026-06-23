import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type AnomalyDataPoint } from '../api/client';
import { Spinner } from '../components/Loading';
import StatCard from '../components/StatCard';
import { AlertTriangle, Plus, Trash2, Search, ShieldAlert, CheckCircle } from 'lucide-react';
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <AlertTriangle size={24} /> Anomaly Detection
        </h1>
        <p className="text-surface-700 text-sm mt-1">
          Detect unusual traffic patterns using Isolation Forest
        </p>
      </div>

      {/* Stat Row */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
          <StatCard
            title="Total Points"
            value={result.total_points}
            icon={<Search size={20} />}
            color="primary"
          />
          <StatCard
            title="Anomalies Found"
            value={result.anomaly_count}
            subtitle={`${((result.anomaly_count / result.total_points) * 100).toFixed(1)}% anomaly rate`}
            icon={<ShieldAlert size={20} />}
            color="danger"
          />
          <StatCard
            title="Normal Points"
            value={result.total_points - result.anomaly_count}
            icon={<CheckCircle size={20} />}
            color="accent"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Input */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">
            Input Data Points
          </h2>

          {/* Add Row */}
          <div className="flex gap-2 mb-4">
            <input
              className="input-field flex-1"
              placeholder="Corridor name"
              value={newPoint.corridor}
              onChange={(e) => setNewPoint({ ...newPoint, corridor: e.target.value })}
            />
            <input
              type="number"
              className="input-field w-20"
              min={0}
              max={23}
              value={newPoint.hour}
              onChange={(e) => setNewPoint({ ...newPoint, hour: parseInt(e.target.value) })}
            />
            <input
              type="number"
              className="input-field w-24"
              min={0}
              value={newPoint.event_count}
              onChange={(e) => setNewPoint({ ...newPoint, event_count: parseInt(e.target.value) })}
            />
            <button
              type="button"
              onClick={addPoint}
              className="btn-primary px-3"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Data Table */}
          <div className="max-h-[350px] overflow-y-auto space-y-1.5">
            {dataPoints.map((dp, i) => {
              const res = result?.results[i];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    res?.is_anomaly
                      ? 'bg-danger-500/10 border border-danger-500/20'
                      : 'bg-surface-900/50'
                  }`}
                >
                  <span className="flex-1 text-surface-200 truncate">
                    {dp.corridor}
                  </span>
                  <span className="text-surface-700 w-14 text-right">
                    {dp.hour}:00
                  </span>
                  <span className="text-surface-200 w-16 text-right font-mono">
                    {dp.event_count}
                  </span>
                  {res && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold w-20 text-center ${
                        res.is_anomaly
                          ? 'bg-danger-500/20 text-danger-400'
                          : 'bg-accent-500/20 text-accent-400'
                      }`}
                    >
                      {res.is_anomaly ? `⚠ ${(res.confidence * 100).toFixed(0)}%` : 'Normal'}
                    </span>
                  )}
                  <button
                    onClick={() => removePoint(i)}
                    className="text-surface-700 hover:text-danger-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => mutation.mutate(dataPoints)}
            className="btn-primary w-full mt-4 justify-center"
            disabled={mutation.isPending || dataPoints.length === 0}
          >
            {mutation.isPending ? <Spinner size={16} /> : <Search size={16} />}
            {mutation.isPending ? 'Analyzing...' : 'Detect Anomalies'}
          </button>
        </div>

        {/* Results Chart */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">
            Event Count Distribution
          </h2>
          {result ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={result.results}>
                <XAxis
                  dataKey="corridor"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  angle={-30}
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
                  formatter={(value: any, name: any) => {
                    if (name === 'event_count') return [value, 'Events'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="event_count" radius={[6, 6, 0, 0]}>
                  {result.results.map((r, i) => (
                    <Cell
                      key={i}
                      fill={r.is_anomaly ? '#ef4444' : '#00c853'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-96 text-surface-700">
              <div className="text-center">
                <AlertTriangle size={48} className="mx-auto mb-4 opacity-30" />
                <p>Run anomaly detection to see results</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
