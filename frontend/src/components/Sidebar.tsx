import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Crosshair,
  Map,
  AlertTriangle,
  Route,
  BarChart3,
  Activity,
  Shield,
  ChevronRight,
  ChevronLeft,
  Zap,
} from 'lucide-react';

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',   desc: 'Overview & metrics' },
  { to: '/predict',   icon: Crosshair,        label: 'Prediction',  desc: 'Impact forecasting' },
  { to: '/heatmap',   icon: Map,              label: 'Heatmap',     desc: 'Geo risk view' },
  { to: '/anomaly',   icon: AlertTriangle,    label: 'Anomalies',   desc: 'Incident detection' },
  { to: '/route',     icon: Route,            label: 'Routing',     desc: 'Evac route planner' },
  { to: '/analytics', icon: BarChart3,        label: 'Analytics',   desc: 'Deep analysis' },
  { to: '/monitoring',icon: Activity,         label: 'Monitoring',  desc: 'System live health' },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* ── Toggle button always visible on the right edge ── */}
      <button
        onClick={onToggle}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute',
          right: '-14px',
          top: '72px',
          width: '28px',
          height: '28px',
          background: '#1b2024',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#9ca3af',
          zIndex: 200,
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = '#2ecc71';
          (e.currentTarget as HTMLElement).style.color = '#fff';
          (e.currentTarget as HTMLElement).style.borderColor = '#2ecc71';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = '#1b2024';
          (e.currentTarget as HTMLElement).style.color = '#9ca3af';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
        }}
      >
        {isCollapsed
          ? <ChevronRight size={14} />
          : <ChevronLeft  size={14} />
        }
      </button>

      {/* ── Logo ── */}
      <div
        style={{
          padding: isCollapsed ? '20px 0' : '24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          minHeight: '72px',
        }}
      >
        <div
          className="pulse-glow"
          style={{
            width: '38px', height: '38px', minWidth: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #009e42, #2ecc71)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(46,204,113,0.3)',
          }}
        >
          <Shield size={18} color="#fff" />
        </div>
        {!isCollapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
              EVAC
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px', letterSpacing: '0.04em', fontWeight: 500 }}>
              Traffic Intelligence
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: isCollapsed ? '12px 8px' : '12px', overflowY: 'auto', overflowX: 'hidden' }}>
        {!isCollapsed && (
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 6px 12px', marginTop: '4px' }}>
            Navigation
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                onMouseEnter={() => setHoveredItem(item.to)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`sidebar-nav-link ${isActive ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '12px' : '10px 14px',
                }}
              >
                <item.icon
                  size={18}
                  style={{ minWidth: '18px', flexShrink: 0, color: isActive ? '#2ecc71' : (hoveredItem === item.to ? '#e5e7eb' : '#6b7280') }}
                />
                {!isCollapsed && (
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.2 }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* ── Footer ── */}
      {!isCollapsed && (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px rgba(46,204,113,0.8)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>EVAC v1.0</div>
            <div style={{ fontSize: '11px', color: '#4b5563' }}>Bengaluru</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Zap size={14} color="#2ecc71" />
          </div>
        </div>
      )}
    </aside>
  );
}
