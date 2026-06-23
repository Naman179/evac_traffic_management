export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      style={{ animation: 'spin 0.8s linear infinite', color: '#2ecc71' }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ opacity: 0.15 }}
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Spinner size={40} />
        </div>
        <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: 500 }}>Loading data...</p>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: '#111417', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '16px', padding: '24px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="skeleton" style={{ height: '12px', width: '40%' }} />
        <div className="skeleton" style={{ height: '32px', width: '60%' }} />
        <div className="skeleton" style={{ height: '11px', width: '70%' }} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: '48px', width: '100%' }} />
      ))}
    </div>
  );
}
