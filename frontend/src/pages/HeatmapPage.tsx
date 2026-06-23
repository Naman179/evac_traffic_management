/**
 * P2 — Congestion Heatmap & Spatial Analysis
 * API: GET /heatmap  → KDE intensity grid (lat/lon + intensity[][])
 *      GET /hotspots  → DBSCAN clusters as GeoJSON polygons
 *      GET /corridors/risk → ranked corridor risk table
 *
 * Per spec: use lat/lon directly (NOT junction grouping). Default time-band to
 * the two known peak windows: early_morning (4-7am) and evening (7-11pm).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type HotspotFeature, type CorridorRiskItem } from '../api/client';
import { PageLoader } from '../components/Loading';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { Map as MapIcon, Filter, Layers, TrendingUp, Clock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const CAUSES = [
  '', 'vehicle_breakdown', 'accident', 'pot_holes', 'construction',
  'water_logging', 'tree_fall', 'congestion', 'public_event', 'procession',
];

// Real peak windows per the data analysis in the spec
const TIME_BANDS = [
  { value: '',              label: 'All Times' },
  { value: 'early_morning', label: 'Peak AM  (4–7am)' },
  { value: 'evening',       label: 'Peak PM  (7–11pm)' },
  { value: 'off_peak',      label: 'Off-Peak' },
  { value: 'late_night',    label: 'Late Night' },
];

const RISK_LEVELS = ['', 'HIGH', 'MEDIUM', 'LOW'];

const RISK_STYLE: Record<string, { color: string; fillColor: string }> = {
  HIGH:   { color: '#ef4444', fillColor: '#ef4444' },
  MEDIUM: { color: '#f59e0b', fillColor: '#f59e0b' },
  LOW:    { color: '#2ecc71', fillColor: '#2ecc71' },
};

const RISK_COLORS: Record<string, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#2ecc71',
};

function HeatmapOverlay({ latGrid, lonGrid, intensity }: {
  latGrid: number[]; lonGrid: number[]; intensity: number[][];
}) {
  const maxIntensity = Math.max(...intensity.flat().filter(v => v > 0), 1e-10);
  const features = [];
  for (let i = 0; i < latGrid.length - 1; i++) {
    for (let j = 0; j < lonGrid.length - 1; j++) {
      const val = intensity[i]?.[j] || 0;
      if (val > maxIntensity * 0.05) {
        const normalised = Math.min(val / maxIntensity, 1);
        features.push({
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[
              [lonGrid[j],     latGrid[i]],
              [lonGrid[j + 1], latGrid[i]],
              [lonGrid[j + 1], latGrid[i + 1]],
              [lonGrid[j],     latGrid[i + 1]],
              [lonGrid[j],     latGrid[i]],
            ]],
          },
          properties: { intensity: normalised },
        });
      }
    }
  }
  if (features.length === 0) return null;
  const geojson = { type: 'FeatureCollection' as const, features };
  return (
    <GeoJSON
      key={JSON.stringify(geojson).slice(0, 100)}
      data={geojson as GeoJSON.FeatureCollection}
      style={feature => {
        const val = feature?.properties?.intensity || 0;
        const r = Math.round(255 * Math.min(val * 2, 1));
        const g = Math.round(255 * Math.max(0, 1 - val * 2));
        return { fillColor: `rgb(${r}, ${g}, 40)`, fillOpacity: val * 0.65, stroke: false };
      }}
    />
  );
}

export default function HeatmapPage() {
  const [cause, setCause]       = useState('');
  const [timeBand, setTimeBand] = useState('');
  const [riskLevel, setRiskLevel] = useState('');

  const heatmap = useQuery({
    queryKey: ['heatmap', cause, timeBand],
    queryFn:  () => api.getHeatmap(cause || undefined, timeBand || undefined),
  });

  const hotspots = useQuery({
    queryKey: ['hotspots', riskLevel],
    queryFn:  () => api.getHotspots(riskLevel || undefined),
  });

  const corridors = useQuery<CorridorRiskItem[]>({
    queryKey: ['corridors-heatmap'],
    queryFn:  () => api.getCorridorsRisk(5),
  });

  const card = {
    background: '#111417',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <MapIcon size={20} color="#f59e0b" />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f3f4f6', letterSpacing: '-0.03em' }}>
                Congestion Heatmap
              </h1>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
                KDE intensity surface · DBSCAN hotspot clusters · Corridor risk rankings
              </p>
            </div>
          </div>
        </div>

        {/* Peak window badges */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', color: '#fbbf24' }}>
            <Clock size={12} /> Peak AM: 4–7am
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px', color: '#f87171' }}>
            <Clock size={12} /> Peak PM: 7–11pm
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...card, padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
          <Filter size={15} color="#6b7280" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Filters
          </span>
        </div>
        <div>
          <label className="form-label">Cause</label>
          <select className="input-field" style={{ width: '180px' }} value={cause} onChange={e => setCause(e.target.value)}>
            <option value="">All Causes</option>
            {CAUSES.filter(Boolean).map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Time Band</label>
          <select className="input-field" style={{ width: '200px' }} value={timeBand} onChange={e => setTimeBand(e.target.value)}>
            {TIME_BANDS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Hotspot Risk Level</label>
          <select className="input-field" style={{ width: '160px' }} value={riskLevel} onChange={e => setRiskLevel(e.target.value)}>
            <option value="">All Levels</option>
            {RISK_LEVELS.filter(Boolean).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        {(cause || timeBand || riskLevel) && (
          <button
            onClick={() => { setCause(''); setTimeBand(''); setRiskLevel(''); }}
            className="btn-secondary"
            style={{ padding: '10px 16px', fontSize: '12px' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Map */}
      <div style={{ ...card, overflow: 'hidden', height: '60vh' }}>
        {heatmap.isLoading ? (
          <PageLoader />
        ) : (
          <MapContainer
            center={[12.97, 77.59]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CartoDB"
            />
            {heatmap.data && (
              <HeatmapOverlay
                latGrid={heatmap.data.lat_grid}
                lonGrid={heatmap.data.lon_grid}
                intensity={heatmap.data.intensity}
              />
            )}
            {hotspots.data && (
              <GeoJSON
                key={`hotspots-${riskLevel}-${hotspots.data.features.length}`}
                data={hotspots.data as GeoJSON.FeatureCollection}
                style={feature => {
                  const risk = (feature?.properties as HotspotFeature['properties'])?.risk_level || 'LOW';
                  const s = RISK_STYLE[risk] || RISK_STYLE.LOW;
                  return { color: s.color, fillColor: s.fillColor, fillOpacity: 0.2, weight: 2 };
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties as HotspotFeature['properties'];
                  layer.bindPopup(
                    `<div style="color:#111;font-family:Inter,sans-serif;padding:4px">
                      <b style="font-size:13px">Cluster #${p.cluster_id}</b><br/>
                      <span style="color:${RISK_COLORS[p.risk_level]||'#888'};font-weight:700">${p.risk_level} RISK</span><br/>
                      Events: <b>${p.event_count}</b><br/>
                      Avg Impact: <b>${p.mean_impact?.toFixed(1) ?? '—'}</b><br/>
                      Closure Rate: <b>${((p.closure_rate || 0) * 100).toFixed(1)}%</b>
                    </div>`
                  );
                }}
              />
            )}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={14} color="#6b7280" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>HOTSPOT CLUSTERS:</span>
        </div>
        {Object.entries(RISK_STYLE).map(([level, style]) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: style.fillColor }} />
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>{level}</span>
          </div>
        ))}
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>HEATMAP INTENSITY:</span>
          <div style={{ width: '80px', height: '6px', borderRadius: '3px', background: 'linear-gradient(90deg, #10b981, #fbbf24, #ef4444)' }} />
          <span style={{ fontSize: '11px', color: '#4b5563' }}>low → high</span>
        </div>
      </div>

      {/* Corridor Risk Table — P2 output: corridor_risk_scores */}
      <div style={{ ...card, padding: '24px', overflow: 'hidden' }}>
        <div className="section-header">
          <TrendingUp size={14} />
          Corridor Risk Rankings
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4b5563', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            Source: GET /corridors/risk
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
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
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j}><div className="skeleton" style={{ height: '14px', width: '80%' }} /></td>
                      ))}
                    </tr>
                  ))
                : corridors.data?.map((c, i) => (
                    <tr key={i}>
                      <td style={{ color: '#4b5563', fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, color: '#e5e7eb', textTransform: 'capitalize' }}>{c.corridor}</td>
                      <td>
                        <span className={`badge ${c.risk_tier === 'HIGH' ? 'badge-danger' : c.risk_tier === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>
                          {c.risk_tier}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: RISK_COLORS[c.risk_tier] ?? '#9ca3af' }}>
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
                      <td style={{ fontWeight: 600 }}>{c.peak_hour}:00</td>
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
