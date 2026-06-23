/**
 * System overview cards — static, not dismissible.
 * Shows the 4 ML features of the EVAC system so users understand what each page does.
 */

import { Crosshair, Map, Route, AlertTriangle } from 'lucide-react';

const FEATURES = [
  {
    id: 'P1',
    icon: Crosshair,
    label: 'Impact Forecaster',
    page: '/predict',
    color: '#2ecc71',
    bg: 'rgba(46,204,113,0.08)',
    border: 'rgba(46,204,113,0.2)',
    desc: 'Given any incoming incident — planned or not — how bad will it get?',
    outputs: ['Closure probability', 'Priority classification', 'Expected duration', 'Composite impact score (1–10)'],
  },
  {
    id: 'P2',
    icon: Map,
    label: 'Congestion Heatmap',
    page: '/heatmap',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    desc: 'Show WHERE congestion concentrates and how risky each corridor already is.',
    outputs: ['KDE intensity surface', 'DBSCAN hotspot clusters', 'Corridor risk rankings', 'Time-band filter (peak windows)'],
  },
  {
    id: 'P3',
    icon: Route,
    label: 'Deployment Recommender',
    page: '/route',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
    desc: 'Turn a predicted impact into an actual field instruction — officers, barricades, diversion.',
    outputs: ['Officer count recommendation', 'Barricade placement', 'Diversion route (OSM-based)', 'Rule-based explanation'],
  },
  {
    id: 'P4',
    icon: AlertTriangle,
    label: 'Anomaly Detection',
    page: '/anomaly',
    color: '#f87171',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
    desc: 'Catch unplanned spikes as they happen and make the system smarter after every event.',
    outputs: ['Isolation Forest spike detection', 'Per-corridor anomaly flags', 'Confidence scores', 'Event-count distribution'],
  },
];

export default function SystemOverview() {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '13px', fontWeight: 700, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            System Capabilities
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: '999px',
            background: 'rgba(46,204,113,0.12)', border: '1px solid rgba(46,204,113,0.25)',
            fontSize: '11px', fontWeight: 700, color: '#2ecc71',
          }}>
            4 ML Features
          </span>
        </div>
        <span style={{ fontSize: '12px', color: '#4b5563' }}>
          Click a feature card to navigate →
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '16px',
      }}>
        {FEATURES.map(f => {
          const Icon = f.icon;
          return (
            <a
              key={f.id}
              href={f.page}
              style={{ textDecoration: 'none' }}
              onClick={e => { e.preventDefault(); window.location.href = f.page; }}
            >
              <div
                style={{
                  background: f.bg,
                  border: `1px solid ${f.border}`,
                  borderRadius: '14px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'translateY(-4px)';
                  el.style.boxShadow = `0 12px 40px rgba(0,0,0,0.5)`;
                  el.style.borderColor = f.color;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = 'none';
                  el.style.borderColor = f.border;
                }}
              >
                {/* Accent line */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: `linear-gradient(90deg, transparent, ${f.color}, transparent)`,
                }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: `${f.color}18`,
                    border: `1px solid ${f.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} color={f.color} />
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em',
                    color: f.color, padding: '3px 8px', borderRadius: '6px',
                    background: `${f.color}15`,
                  }}>
                    {f.id}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#f3f4f6', marginBottom: '6px' }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.55 }}>
                    {f.desc}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: 'auto' }}>
                  {f.outputs.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>{o}</span>
                    </div>
                  ))}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
