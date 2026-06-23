import { useState, useRef } from 'react';
import { X, AlertTriangle, CheckCircle, RefreshCw, Zap, Info } from 'lucide-react';

type InsightType = 'alert' | 'success' | 'tip' | 'update';

interface Insight {
  id: number;
  type: InsightType;
  tag: string;
  title: string;
  text: string;
  action?: string;
}

const ALL_INSIGHTS: Insight[] = [
  {
    id: 1, type: 'alert', tag: 'HIGH PRIORITY',
    title: 'Congestion Spike Expected',
    text: 'Mysore Road predicted to hit critical congestion between 17:00–19:00 today. Consider early rerouting via Tumkur Road.',
    action: 'View Route',
  },
  {
    id: 2, type: 'success', tag: 'IMPROVEMENT',
    title: 'Closure Rate Down 12%',
    text: 'ORR North corridors saw a 12% reduction in average incident closure time over the last 7 days. Great response efficiency.',
    action: 'See Analytics',
  },
  {
    id: 3, type: 'update', tag: 'SYSTEM',
    title: 'Model Recalibrated',
    text: 'P1 Impact Forecaster completed weekly retraining. Prediction accuracy improved by 2.4%. All systems nominal.',
    action: 'View Monitoring',
  },
  {
    id: 4, type: 'tip', tag: 'INSIGHT',
    title: 'Peak Hours Detected',
    text: 'CBD corridors consistently show peak congestion at 08:30 and 18:45. Pre-deploying resources at these times can cut response time by 30%.',
    action: 'View Heatmap',
  },
  {
    id: 5, type: 'alert', tag: 'ANOMALY',
    title: 'Unusual Event Pattern',
    text: 'Bannerghata Road showing an anomalous spike in public events. Possible procession or gathering. Monitor closely.',
    action: 'View Anomalies',
  },
];

const typeConfig = {
  alert:   { icon: AlertTriangle, iconColor: '#f87171',  tagColor: 'rgba(239,68,68,0.15)',  tagText: '#f87171',  border: 'rgba(239,68,68,0.25)',  bg: 'rgba(239,68,68,0.04)' },
  success: { icon: CheckCircle,   iconColor: '#2ecc71',  tagColor: 'rgba(46,204,113,0.12)', tagText: '#2ecc71',  border: 'rgba(46,204,113,0.25)', bg: 'rgba(46,204,113,0.04)' },
  tip:     { icon: Zap,           iconColor: '#fbbf24',  tagColor: 'rgba(245,158,11,0.12)', tagText: '#fbbf24',  border: 'rgba(245,158,11,0.25)', bg: 'rgba(245,158,11,0.03)' },
  update:  { icon: RefreshCw,     iconColor: '#60a5fa',  tagColor: 'rgba(96,165,250,0.12)', tagText: '#60a5fa',  border: 'rgba(96,165,250,0.25)', bg: 'rgba(96,165,250,0.03)' },
};

export default function InteractiveInsights() {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());
  const [allDone, setAllDone] = useState(false);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const visible = ALL_INSIGHTS.filter(i => !dismissed.has(i.id));

  const dismiss = (id: number) => {
    setDismissing(prev => new Set(prev).add(id));
    setTimeout(() => {
      setDismissed(prev => {
        const next = new Set(prev).add(id);
        if (next.size === ALL_INSIGHTS.length) setAllDone(true);
        return next;
      });
      setDismissing(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 380);
  };

  const reset = () => {
    setDismissed(new Set());
    setDismissing(new Set());
    setAllDone(false);
  };

  if (allDone) {
    return (
      <div className="animate-fade-in" style={{ marginBottom: '32px' }}>
        <div style={{
          background: '#111417',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
        }}>
          <CheckCircle size={40} color="#2ecc71" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
            All insights reviewed!
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
            You're fully caught up. Check back later for new alerts.
          </div>
          <button
            onClick={reset}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', borderRadius: '10px',
              background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.25)',
              color: '#2ecc71', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(46,204,113,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(46,204,113,0.1)')}
          >
            <RefreshCw size={14} /> Restore Insights
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ marginBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info size={15} color="#6b7280" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Actionable Insights
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: '999px',
            background: 'rgba(46,204,113,0.12)', border: '1px solid rgba(46,204,113,0.25)',
            fontSize: '11px', fontWeight: 700, color: '#2ecc71',
          }}>
            {visible.length}
          </span>
        </div>
        <button
          onClick={reset}
          style={{
            fontSize: '12px', color: '#4b5563', cursor: 'pointer',
            background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '5px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
        >
          <RefreshCw size={12} /> Restore all
        </button>
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {visible.map((insight, idx) => {
          const cfg = typeConfig[insight.type];
          const Icon = cfg.icon;
          const isDismissing = dismissing.has(insight.id);
          return (
            <div
              key={insight.id}
              ref={el => { if (el) cardRefs.current.set(insight.id, el); }}
              onClick={() => dismiss(insight.id)}
              className="animate-fade-in"
              style={{
                animationDelay: `${idx * 60}ms`,
                background: cfg.bg || '#111417',
                border: `1px solid ${isDismissing ? 'transparent' : cfg.border}`,
                borderRadius: '14px',
                padding: isDismissing ? '0' : '20px',
                cursor: 'pointer',
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                maxHeight: isDismissing ? '0' : '300px',
                opacity: isDismissing ? 0 : 1,
                transform: isDismissing ? 'scale(0.92) translateY(-8px)' : 'scale(1)',
                marginBottom: isDismissing ? '-16px' : '0',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isDismissing) {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.5)';
                }
              }}
              onMouseLeave={e => {
                if (!isDismissing) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }
              }}
            >
              {/* Dismiss X */}
              <button
                onClick={e => { e.stopPropagation(); dismiss(insight.id); }}
                style={{
                  position: 'absolute', top: '12px', right: '12px',
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#6b7280', transition: 'all 0.15s',
                  opacity: 0,
                }}
                className="dismiss-btn"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'; (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
              >
                <X size={12} />
              </button>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '36px', height: '36px', minWidth: '36px',
                  borderRadius: '10px', background: cfg.tagColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={17} color={cfg.iconColor} />
                </div>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em',
                    color: cfg.tagText, background: cfg.tagColor,
                    padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '6px',
                  }}>
                    {insight.tag}
                  </span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f3f4f6', lineHeight: 1.3, marginBottom: '6px' }}>
                    {insight.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6 }}>
                    {insight.text}
                  </div>
                  {insight.action && (
                    <div style={{
                      marginTop: '12px', fontSize: '12px', fontWeight: 600,
                      color: cfg.iconColor, display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      {insight.action} →
                    </div>
                  )}
                </div>
              </div>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: '2px',
                background: `linear-gradient(90deg, ${cfg.iconColor}33, ${cfg.iconColor}, ${cfg.iconColor}33)`,
              }} />
            </div>
          );
        })}
      </div>

      <style>{`
        .animate-fade-in .dismiss-btn { opacity: 0; }
        div:hover > .dismiss-btn { opacity: 1 !important; }
        [style*="cursor: pointer"]:hover .dismiss-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
