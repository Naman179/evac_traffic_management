import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'accent' | 'danger' | 'warning';
}

const colorMap = {
  primary: 'from-primary-600/20 to-primary-500/5 border-primary-500/20',
  accent: 'from-accent-600/20 to-accent-500/5 border-accent-500/20',
  danger: 'from-danger-600/20 to-danger-500/5 border-danger-500/20',
  warning: 'from-warning-600/20 to-warning-500/5 border-warning-500/20',
};

const iconColorMap = {
  primary: 'text-primary-400',
  accent: 'text-accent-400',
  danger: 'text-danger-400',
  warning: 'text-warning-400',
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
}: StatCardProps) {
  return (
    <div
      className={`glass-card p-5 bg-gradient-to-br ${colorMap[color]} animate-fade-in`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-surface-700 uppercase tracking-wider font-medium">
            {title}
          </p>
          <p className="text-2xl font-bold mt-1.5 text-surface-100">{value}</p>
          {subtitle && (
            <p className="text-xs text-surface-700 mt-1">{subtitle}</p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-xl bg-surface-900/50 flex items-center justify-center ${iconColorMap[color]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
