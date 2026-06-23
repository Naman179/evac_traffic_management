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
  primary: 'from-primary-500/10 to-transparent border-primary-500/20',
  accent: 'from-primary-400/10 to-transparent border-primary-400/20',
  danger: 'from-danger-500/10 to-transparent border-danger-500/20',
  warning: 'from-warning-500/10 to-transparent border-warning-500/20',
};

const iconColorMap = {
  primary: 'text-primary-500',
  accent: 'text-primary-400',
  danger: 'text-danger-500',
  warning: 'text-warning-500',
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
          <p className="text-xs text-surface-200 uppercase tracking-wider font-medium">
            {title}
          </p>
          <p className="text-3xl font-bold mt-2 text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-surface-700 mt-1.5">{subtitle}</p>
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
