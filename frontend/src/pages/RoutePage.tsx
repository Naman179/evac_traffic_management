import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type RouteRequest } from '../api/client';
import { Spinner } from '../components/Loading';
import {
  Route as RouteIcon,
  Send,
  Users,
  Shield,
  AlertTriangle,
  Navigation,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon
const DefaultIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#6366f1;border:2px solid white;box-shadow:0 0 6px rgba(99,102,241,0.5)"></div>`,
  iconSize: [16, 16],
});

const EndIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 0 6px rgba(239,68,68,0.5)"></div>`,
  iconSize: [16, 16],
});

const CAUSES = [
  'vehicle_breakdown', 'accident', 'pot_holes', 'construction',
  'water_logging', 'tree_fall', 'congestion', 'public_event',
  'procession', 'vip_movement', 'protest', 'debris',
];

export default function RoutePage() {
  const [form, setForm] = useState<RouteRequest>({
    event_cause: 'accident',
    corridor: 'Mysore Road',
    latitude: 12.95,
    longitude: 77.55,
    endlatitude: 12.96,
    endlongitude: 77.56,
    start_datetime: new Date().toISOString().slice(0, 16),
    priority: 'High',
    requires_road_closure: true,
  });

  const mutation = useMutation({
    mutationFn: (data: RouteRequest) => api.getRoute(data),
    onError: (err: Error) => toast.error(err.message),
    onSuccess: (data) => toast.success(`Recommendation: ${data.recommended_officers} officers, ${data.recommended_barricades} barricades`),
  });

  const result = mutation.data;
  const routeCoords =
    (result?.diversion_route as Record<string, unknown>)?.route_coords as number[][] | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <RouteIcon size={24} /> Deployment & Routing
        </h1>
        <p className="text-surface-700 text-sm mt-1">
          Generate deployment recommendations and evacuation diversion routes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">
            Incident Parameters
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({
                ...form,
                start_datetime: form.start_datetime
                  ? new Date(form.start_datetime).toISOString()
                  : undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-surface-700 mb-1 block">Cause</label>
                <select
                  className="input-field"
                  value={form.event_cause}
                  onChange={(e) => setForm({ ...form, event_cause: e.target.value })}
                >
                  {CAUSES.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-surface-700 mb-1 block">Corridor</label>
                <input
                  className="input-field"
                  value={form.corridor}
                  onChange={(e) => setForm({ ...form, corridor: e.target.value })}
                />
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
                <label className="text-xs text-surface-700 mb-1 block">Start Lat</label>
                <input
                  type="number"
                  step="0.001"
                  className="input-field"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-surface-700 mb-1 block">Start Lon</label>
                <input
                  type="number"
                  step="0.001"
                  className="input-field"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-surface-700 mb-1 block">End Lat</label>
                <input
                  type="number"
                  step="0.001"
                  className="input-field"
                  value={form.endlatitude}
                  onChange={(e) => setForm({ ...form, endlatitude: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-surface-700 mb-1 block">End Lon</label>
                <input
                  type="number"
                  step="0.001"
                  className="input-field"
                  value={form.endlongitude}
                  onChange={(e) => setForm({ ...form, endlongitude: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-surface-700 mb-1 block">Priority</label>
                <select
                  className="input-field"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-surface-700">
                  <input
                    type="checkbox"
                    checked={form.requires_road_closure}
                    onChange={(e) => setForm({ ...form, requires_road_closure: e.target.checked })}
                    className="w-4 h-4 accent-primary-500"
                  />
                  Road closure needed
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Spinner size={16} /> : <Send size={16} />}
              {mutation.isPending ? 'Computing...' : 'Generate Recommendation'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3 animate-fade-in">
                <div className="glass-card p-4 text-center">
                  <Users size={20} className="mx-auto text-primary-400" />
                  <p className="text-2xl font-bold mt-1">{result.recommended_officers}</p>
                  <p className="text-xs text-surface-700">Officers</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <Shield size={20} className="mx-auto text-warning-400" />
                  <p className="text-2xl font-bold mt-1">{result.recommended_barricades}</p>
                  <p className="text-xs text-surface-700">Barricades</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <AlertTriangle size={20} className="mx-auto text-danger-400" />
                  <p className="text-2xl font-bold mt-1">{result.impact_score}/10</p>
                  <p className="text-xs text-surface-700">Impact</p>
                </div>
              </div>

              {/* Equipment & Escalation */}
              <div className="glass-card p-4 animate-fade-in">
                <h3 className="text-xs text-surface-700 uppercase mb-2">Equipment</h3>
                <div className="flex flex-wrap gap-2">
                  {result.equipment.map((e, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-primary-500/10 text-primary-300 border border-primary-500/20">
                      {e}
                    </span>
                  ))}
                </div>
                {result.escalate_to.length > 0 && (
                  <>
                    <h3 className="text-xs text-surface-700 uppercase mt-3 mb-2">Escalate To</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.escalate_to.map((e, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-danger-500/10 text-danger-300 border border-danger-500/20">
                          {e}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Explanation */}
              <div className="glass-card p-4 animate-fade-in">
                <h3 className="text-xs text-surface-700 uppercase mb-2">
                  Decision Explanation
                </h3>
                <div className="space-y-1.5 text-xs text-surface-200">
                  {result.explanation.map((ex, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-primary-400 mt-0.5">→</span>
                      <span>{ex}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-surface-700 mt-3 italic">{result.notes}</p>
              </div>
            </>
          ) : (
            <div className="glass-card p-12 text-center text-surface-700">
              <Navigation size={48} className="mx-auto mb-4 opacity-30" />
              <p>Configure incident and click Generate to see recommendations</p>
            </div>
          )}
        </div>
      </div>

      {/* Map with Route */}
      {result && (
        <div className="glass-card overflow-hidden animate-fade-in" style={{ height: '400px' }}>
          <MapContainer
            center={[form.latitude, form.longitude]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            className="rounded-2xl"
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CartoDB"
            />
            <Marker position={[form.latitude, form.longitude]} icon={DefaultIcon}>
              <Popup>
                <span style={{ color: '#1e293b' }}>
                  <b>Incident Start</b><br />{form.event_cause}
                </span>
              </Popup>
            </Marker>
            {form.endlatitude && form.endlongitude && (
              <Marker position={[form.endlatitude, form.endlongitude]} icon={EndIcon}>
                <Popup><span style={{ color: '#1e293b' }}>Incident End</span></Popup>
              </Marker>
            )}
            {routeCoords && routeCoords.length > 0 && (
              <Polyline
                positions={routeCoords.map(([lat, lon]) => [lat, lon] as [number, number])}
                color="#6366f1"
                weight={4}
                opacity={0.8}
                dashArray="8 4"
              />
            )}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
