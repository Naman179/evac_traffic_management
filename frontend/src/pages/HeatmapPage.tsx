import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type HotspotFeature } from '../api/client';
import { PageLoader } from '../components/Loading';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { Map as MapIcon, Layers, Filter } from 'lucide-react';
// No leaflet type import needed if not used
import 'leaflet/dist/leaflet.css';

const CAUSES = [
  '', 'vehicle_breakdown', 'accident', 'pot_holes', 'construction',
  'water_logging', 'others',
];
const TIME_BANDS = ['', 'early_morning', 'evening', 'late_night', 'off_peak'];
const RISK_LEVELS = ['', 'HIGH', 'MEDIUM', 'LOW'];

const RISK_STYLE: Record<string, { color: string; fillColor: string }> = {
  HIGH: { color: '#ef4444', fillColor: '#ef4444' },
  MEDIUM: { color: '#f59e0b', fillColor: '#f59e0b' },
  LOW: { color: '#10b981', fillColor: '#10b981' },
};

function HeatmapOverlay({
  latGrid,
  lonGrid,
  intensity,
}: {
  latGrid: number[];
  lonGrid: number[];
  intensity: number[][];
}) {
  // Use canvas overlay to draw heatmap rectangles
  // This is a simplified version — draws colored rectangles
  const maxIntensity = Math.max(
    ...intensity.flat().filter((v) => v > 0),
    1e-10
  );

  // Create GeoJSON polygons for each grid cell
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
            coordinates: [
              [
                [lonGrid[j], latGrid[i]],
                [lonGrid[j + 1], latGrid[i]],
                [lonGrid[j + 1], latGrid[i + 1]],
                [lonGrid[j], latGrid[i + 1]],
                [lonGrid[j], latGrid[i]],
              ],
            ],
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
      style={(feature) => {
        const val = feature?.properties?.intensity || 0;
        const r = Math.round(255 * Math.min(val * 2, 1));
        const g = Math.round(255 * Math.max(0, 1 - val * 2));
        return {
          fillColor: `rgb(${r}, ${g}, 40)`,
          fillOpacity: val * 0.6,
          stroke: false,
        };
      }}
    />
  );
}

export default function HeatmapPage() {
  const [cause, setCause] = useState('');
  const [timeBand, setTimeBand] = useState('');
  const [riskLevel, setRiskLevel] = useState('');

  const heatmap = useQuery({
    queryKey: ['heatmap', cause, timeBand],
    queryFn: () => api.getHeatmap(cause || undefined, timeBand || undefined),
  });

  const hotspots = useQuery({
    queryKey: ['hotspots', riskLevel],
    queryFn: () => api.getHotspots(riskLevel || undefined),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <MapIcon size={24} /> Congestion Heatmap
        </h1>
        <p className="text-surface-700 text-sm mt-1">
          KDE intensity heatmap with DBSCAN hotspot clusters overlay
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
        <Filter size={16} className="text-primary-400" />
        <div>
          <label className="text-xs text-surface-700 block mb-1">Cause Filter</label>
          <select
            className="input-field w-48"
            value={cause}
            onChange={(e) => setCause(e.target.value)}
          >
            <option value="">All Causes</option>
            {CAUSES.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-700 block mb-1">Time Band</label>
          <select
            className="input-field w-48"
            value={timeBand}
            onChange={(e) => setTimeBand(e.target.value)}
          >
            <option value="">All Times</option>
            {TIME_BANDS.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-700 block mb-1">Hotspot Risk</label>
          <select
            className="input-field w-48"
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
          >
            <option value="">All Levels</option>
            {RISK_LEVELS.filter(Boolean).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Map */}
      <div className="glass-card overflow-hidden" style={{ height: '65vh' }}>
        {heatmap.isLoading ? (
          <PageLoader />
        ) : (
          <MapContainer
            center={[12.97, 77.59]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            className="rounded-2xl"
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
                style={(feature) => {
                  const risk = (feature?.properties as HotspotFeature['properties'])?.risk_level || 'LOW';
                  const s = RISK_STYLE[risk] || RISK_STYLE.LOW;
                  return {
                    color: s.color,
                    fillColor: s.fillColor,
                    fillOpacity: 0.25,
                    weight: 2,
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties as HotspotFeature['properties'];
                  layer.bindPopup(
                    `<div style="color:#151a1d">
                      <b>Cluster #${p.cluster_id}</b><br/>
                      Risk: <b>${p.risk_level}</b><br/>
                      Events: ${p.event_count}<br/>
                      Mean Impact: ${p.mean_impact?.toFixed(1)}<br/>
                      Closure Rate: ${((p.closure_rate || 0) * 100).toFixed(1)}%
                    </div>`
                  );
                }}
              />
            )}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div className="glass-card p-4 flex items-center gap-6 text-xs">
        <Layers size={14} className="text-surface-700" />
        <span className="text-surface-700">Hotspot Clusters:</span>
        {Object.entries(RISK_STYLE).map(([level, style]) => (
          <div key={level} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: style.fillColor }}
            />
            <span className="text-surface-200">{level}</span>
          </div>
        ))}
        <span className="text-surface-700 ml-4">|</span>
        <span className="text-surface-700 ml-4">Heatmap intensity:</span>
        <div className="w-24 h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
      </div>
    </div>
  );
}
