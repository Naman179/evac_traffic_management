import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Crosshair,
  Map,
  AlertTriangle,
  Route,
  BarChart3,
  Activity,
  Shield,
  ChevronLeft,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/predict', icon: Crosshair, label: 'Prediction' },
  { to: '/heatmap', icon: Map, label: 'Heatmap' },
  { to: '/anomaly', icon: AlertTriangle, label: 'Anomalies' },
  { to: '/route', icon: Route, label: 'Routing' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/monitoring', icon: Activity, label: 'Monitoring' },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-64 glass-card rounded-none border-r border-t-0 border-b-0 border-l-0 z-50 flex flex-col transition-all duration-300 ${
        isCollapsed ? '-translate-x-full' : 'translate-x-0'
      }`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-primary-500/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center pulse-glow">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">EVAC</h1>
            <p className="text-xs text-surface-700">Congestion System</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-surface-700 hover:text-surface-200 hover:bg-surface-800/50 cursor-pointer transition-colors"
          title="Collapse Sidebar"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary-600/20 text-primary-300 border border-primary-500/20'
                  : 'text-surface-700 hover:text-surface-200 hover:bg-surface-800/50'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-primary-500/10">
        <p className="text-xs text-surface-700 text-center">
          EVAC v1.0 • Bengaluru
        </p>
      </div>
    </aside>
  );
}

