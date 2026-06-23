import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'accent' | 'danger' | 'warning';
  onClick?: () => void;
}

const colorConfig = {
  primary: {
    iconBg: 'rgba(46,204,113,0.12)',
    iconColor: '#2ecc71',
    borderGlow: 'rgba(46,204,113,0.3)',
    accentLine: '#2ecc71',
  },
  accent: {
    iconBg: 'rgba(61,220,132,0.12)',
    iconColor: '#3ddc84',
    borderGlow: 'rgba(61,220,132,0.3)',
    accentLine: '#3ddc84',
  },
  danger: {
    iconBg: 'rgba(239,68,68,0.12)',
    iconColor: '#f87171',
    borderGlow: 'rgba(239,68,68,0.3)',
    accentLine: '#ef4444',
  },
  warning: {
    iconBg: 'rgba(245,158,11,0.12)',
    iconColor: '#fbbf24',
    borderGlow: 'rgba(245,158,11,0.3)',
    accentLine: '#f59e0b',
  },
};

export default function StatCard({ title, value, subtitle, icon, color = 'primary', onClick }: StatCardProps) {
  const cfg = colorConfig[color];

  return (
    <div
      onClick={onClick}
      style={{
        background: '#111417',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '24px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="animate-fade-in stat-card-hover"
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-4px)';
        el.style.borderColor = cfg.borderGlow;
        el.style.boxShadow = `0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.borderGlow}`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(0)';
        el.style.borderColor = 'rgba(255,255,255,0.06)';
        el.style.boxShadow = 'none';
      }}
    >
      {/* Accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '24px', right: '24px',
        height: '2px',
        background: `linear-gradient(90deg, transparent, ${cfg.accentLine}60, transparent)`,
        borderRadius: '0 0 4px 4px',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            {title}
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#f3f4f6', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '8px' }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', lineHeight: 1.4 }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: cfg.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.iconColor, flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}
