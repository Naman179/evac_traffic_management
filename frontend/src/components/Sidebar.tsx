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
      className={`fixed left-0 top-0 h-screen glass-card rounded-none border-r border-white/5 border-t-0 border-b-0 border-l-0 z-50 flex flex-col transition-all duration-300 overflow-hidden ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className={`p-6 border-b border-white/5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 min-w-[40px] rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center pulse-glow shadow-lg shadow-primary-500/20">
            <Shield size={20} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden transition-all">
              <h1 className="text-lg font-bold gradient-text whitespace-nowrap">EVAC</h1>
              <p className="text-xs text-surface-700 whitespace-nowrap">Congestion System</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-surface-700 hover:text-surface-200 hover:bg-surface-800/50 cursor-pointer transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>
      
      {isCollapsed && (
        <button
          onClick={onToggle}
          className="absolute top-8 right-[-12px] bg-surface-800 p-1 rounded-full text-surface-700 hover:text-surface-200 border border-white/5 cursor-pointer z-50"
          title="Expand Sidebar"
        >
          <ChevronLeft size={14} className="rotate-180" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isCollapsed ? 'justify-center px-0' : ''
              } ${
                isActive
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-sm'
                  : 'text-surface-200 hover:text-white hover:bg-surface-800/50'
              }`
            }
          >
            <item.icon size={18} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <p className={`text-xs text-surface-700 text-center ${isCollapsed ? 'hidden' : 'block'}`}>
          EVAC v1.0 • Bengaluru
        </p>
      </div>
    </aside>
  );
}

