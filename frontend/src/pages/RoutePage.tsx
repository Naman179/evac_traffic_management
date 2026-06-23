/**
 * P3 — Deployment Recommendation Engine
 * API: POST /route  → officer count, barricades, equipment, escalation, diversion, explanation
 *      GET  /templates → response-template rule table (editable, show to commanders)
 *
 * Per spec: rule engine scales officer count using P1 composite impact score.
 * Diversion route pulled from OSM (via OSMnx + NetworkX on backend).
 * Templates table shows why a recommendation was made (transparency).
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, type RouteRequest, type ResponseTemplate } from '../api/client';
import { Spinner } from '../components/Loading';
import {
  Route as RouteIcon, Send, Users, Shield, AlertTriangle,
  Navigation, ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';

const StartIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#2ecc71;border:2px solid white;box-shadow:0 0 8px rgba(46,204,113,0.7)"></div>`,
  iconSize: [16, 16],
});
const EndIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 0 8px rgba(239,68,68,0.7)"></div>`,
  iconSize: [16, 16],
});

const CAUSES = [
  'vehicle_breakdown', 'accident', 'pot_holes', 'construction',
  'water_logging', 'tree_fall', 'congestion', 'public_event',
  'procession', 'vip_movement', 'protest', 'debris',
];

const CORRIDORS = [
  'Mysore Road', 'Bellary Road 1', 'Bellary Road 2', 'Hosur Road',
  'Tumkur Road', 'ORR North 1', 'ORR North 2', 'ORR East 1', 'ORR East 2',
  'Old Madras Road', 'Magadi Road', 'Bannerghatta Road', 'Hennur Main Road',
  'Varthur Road', 'Old Airport Road', 'CBD 1', 'CBD 2',
];

const card = {
  background: '#111417',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
};

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

  const [showTemplates, setShowTemplates] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: RouteRequest) => api.getRoute(data),
    onError: (err: Error) => toast.error(err.message),
    onSuccess: data => toast.success(`Recommended: ${data.recommended_officers} officers · ${data.recommended_barricades} barricades`),
  });

  const templates = useQuery<ResponseTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => api.getTemplates(),
    enabled: showTemplates,
  });

  const result = mutation.data;
  const routeCoords =
    (result?.diversion_route as Record<string, unknown>)?.route_coords as number[][] | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade-in">

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <RouteIcon size={20} color="#60a5fa" />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f3f4f6', letterSpacing: '-0.03em' }}>
              Deployment Recommender
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
              Rule engine · officer count scaled by P1 impact score · OSM diversion routing
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── Input Form ── */}
        <div style={{ ...card, padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <div style={{ width: '3px', height: '18px', background: '#60a5fa', borderRadius: '2px' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#e5e7eb' }}>Incident Parameters</span>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              mutation.mutate({
                ...form,
                start_datetime: form.start_datetime
                  ? new Date(form.start_datetime).toISOString()
                  : undefined,
              });
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="form-label">Incident Cause</label>
                <select className="input-field" value={form.event_cause} onChange={e => setForm({ ...form, event_cause: e.target.value })}>
                  {CAUSES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Corridor</label>
                <select className="input-field" value={form.corridor} onChange={e => setForm({ ...form, corridor: e.target.value })}>
                  {CORRIDORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Date & Time</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.start_datetime}
                onChange={e => setForm({ ...form, start_datetime: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="form-label">Start Latitude</label>
                <input type="number" step="0.001" className="input-field" value={form.latitude}
                  onChange={e => setForm({ ...form, latitude: parseFloat(e.target.value) })} />
              </div>
              <div>
                <label className="form-label">Start Longitude</label>
                <input type="number" step="0.001" className="input-field" value={form.longitude}
                  onChange={e => setForm({ ...form, longitude: parseFloat(e.target.value) })} />
              </div>
              <div>
                <label className="form-label">End Latitude</label>
                <input type="number" step="0.001" className="input-field" value={form.endlatitude}
                  onChange={e => setForm({ ...form, endlatitude: parseFloat(e.target.value) })} />
              </div>
              <div>
                <label className="form-label">End Longitude</label>
                <input type="number" step="0.001" className="input-field" value={form.endlongitude}
                  onChange={e => setForm({ ...form, endlongitude: parseFloat(e.target.value) })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="form-label">Priority</label>
                <select className="input-field" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                  padding: '10px 14px', borderRadius: '10px', width: '100%',
                  border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)',
                }}>
                  <input
                    type="checkbox"
                    checked={form.requires_road_closure}
                    onChange={e => setForm({ ...form, requires_road_closure: e.target.checked })}
                    style={{ width: '15px', height: '15px', accentColor: '#2ecc71', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#d1d5db' }}>Road closure needed</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={mutation.isPending}
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px' }}
            >
              {mutation.isPending ? <Spinner size={18} /> : <Send size={18} />}
              {mutation.isPending ? 'Computing…' : 'Generate Deployment Plan'}
            </button>
          </form>
        </div>

        {/* ── Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {result ? (
            <>
              {/* 3 key numbers */}
              <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Officers', value: result.recommended_officers, icon: <Users size={20} />, color: '#2ecc71' },
                  { label: 'Barricades', value: result.recommended_barricades, icon: <Shield size={20} />, color: '#f59e0b' },
                  { label: 'Impact', value: `${result.impact_score}/10`, icon: <AlertTriangle size={20} />, color: '#f87171' },
                ].map(m => (
                  <div key={m.label} style={{ ...card, padding: '20px', textAlign: 'center' }}>
                    <div style={{ color: m.color, display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>{m.icon}</div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#f3f4f6', letterSpacing: '-0.02em' }}>{m.value}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '4px' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Equipment + Escalation */}
              <div className="animate-fade-in" style={{ ...card, padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                  Equipment Required
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {result.equipment.map((e, i) => (
                    <span key={i} style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(46,204,113,0.1)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.2)' }}>
                      {e}
                    </span>
                  ))}
                </div>
                {result.escalate_to.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '16px', marginBottom: '10px' }}>
                      Escalate To
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {result.escalate_to.map((e, i) => (
                        <span key={i} style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Rule-based explanation */}
              <div className="animate-fade-in" style={{ ...card, padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                  Decision Explanation (Rule Engine)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {result.explanation.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#2ecc71', marginTop: '1px', fontWeight: 700, fontSize: '14px' }}>→</span>
                      <span style={{ fontSize: '13px', color: '#d1d5db', lineHeight: 1.55 }}>{ex}</span>
                    </div>
                  ))}
                </div>
                {result.notes && (
                  <p style={{ fontSize: '12px', color: '#4b5563', marginTop: '12px', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                    {result.notes}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div style={{ ...card, padding: '64px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '300px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Navigation size={28} color="#60a5fa" style={{ opacity: 0.5 }} />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#6b7280', marginBottom: '8px' }}>No plan generated yet</div>
                <div style={{ fontSize: '13px', color: '#4b5563' }}>Configure the incident and click Generate</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map with diversion route */}
      {result && (
        <div className="animate-fade-in" style={{ ...card, overflow: 'hidden', height: '420px' }}>
          <MapContainer
            center={[form.latitude, form.longitude]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CartoDB"
            />
            <Marker position={[form.latitude, form.longitude]} icon={StartIcon}>
              <Popup><span style={{ color: '#111', fontWeight: 700 }}>Incident Start<br/>{form.event_cause.replace(/_/g,' ')}</span></Popup>
            </Marker>
            {form.endlatitude && form.endlongitude && (
              <Marker position={[form.endlatitude, form.endlongitude]} icon={EndIcon}>
                <Popup><span style={{ color: '#111', fontWeight: 700 }}>Incident End</span></Popup>
              </Marker>
            )}
            {routeCoords && routeCoords.length > 0 && (
              <Polyline
                positions={routeCoords.map(([lat, lon]) => [lat, lon] as [number, number])}
                color="#2ecc71"
                weight={4}
                opacity={0.85}
                dashArray="8 4"
              />
            )}
          </MapContainer>
        </div>
      )}

      {/* Response Templates — rule table viewer (transparency feature from spec) */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <button
          onClick={() => setShowTemplates(v => !v)}
          style={{
            width: '100%', padding: '20px 24px', background: 'none', border: 'none',
            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
          }}
        >
          <BookOpen size={16} color="#6b7280" />
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#9ca3af' }}>Response Rule Templates</span>
          <span style={{ fontSize: '12px', color: '#4b5563', marginLeft: '6px' }}>
            (underlying rules the engine uses — GET /templates)
          </span>
          <span style={{ marginLeft: 'auto', color: '#6b7280' }}>
            {showTemplates ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </button>

        {showTemplates && (
          <div style={{ padding: '0 24px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {templates.isLoading ? (
              <div style={{ paddingTop: '16px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: '48px', width: '100%', marginBottom: '8px' }} />
                ))}
              </div>
            ) : templates.data && templates.data.length > 0 ? (
              <div style={{ overflowX: 'auto', paddingTop: '16px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cause</th>
                      <th>Base Officers</th>
                      <th>Recovery Van</th>
                      <th>Barricades</th>
                      <th>Escalate To</th>
                      <th>Equipment</th>
                      <th>Priority Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.data.map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: '#e5e7eb', textTransform: 'capitalize' }}>{t.cause.replace(/_/g, ' ')}</td>
                        <td>{t.base_officers}</td>
                        <td>{t.recovery_van}</td>
                        <td>{t.base_barricades}</td>
                        <td style={{ fontSize: '12px', color: '#9ca3af' }}>{t.escalate_to.join(', ') || '—'}</td>
                        <td style={{ fontSize: '12px', color: '#9ca3af' }}>{t.equipment.join(', ') || '—'}</td>
                        <td>
                          {t.priority_override
                            ? <span className="badge badge-warning">{t.priority_override}</span>
                            : <span style={{ color: '#4b5563', fontSize: '12px' }}>—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#4b5563', fontSize: '13px', paddingTop: '16px' }}>No templates loaded from API.</p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
