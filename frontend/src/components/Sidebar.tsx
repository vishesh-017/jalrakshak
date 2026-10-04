import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Waves,
  MapPin,
  Scan,
  TrendingUp,
  Navigation,
  FileCheck2,
  BarChart3,
  Coins,
  Cpu,
  Sliders,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useRbac } from '../context/RbacContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'SURVEILLANCE & DIGITAL TWIN',
    items: [
      { to: '/', label: 'Command Center', icon: LayoutDashboard },
      { to: '/simulator', label: '3D Sensor Twin', icon: Waves, badge: '3D+MAP' },
      { to: '/map', label: 'Hotspot GIS Map', icon: MapPin },
      { to: '/detection', label: 'AI Optical Studio', icon: Scan },
      { to: '/forecast', label: 'Risk Forecaster', icon: TrendingUp },
    ],
  },
  {
    title: 'OPERATIONS & RECOVERY',
    items: [
      { to: '/cleanup', label: 'Cleanup Dispatch', icon: Navigation },
      { to: '/recovery', label: 'Evidence Ledger', icon: FileCheck2 },
      { to: '/analytics', label: 'Analytics & Impact', icon: BarChart3 },
      { to: '/economics', label: 'Pilot Economics', icon: Coins },
    ],
  },
  {
    title: 'SYSTEM ARCHITECTURE',
    items: [
      { to: '/model-card', label: 'Model Benchmarks', icon: Cpu },
      { to: '/settings', label: 'Storm Simulation', icon: Sliders },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { role, roleConfig } = useRbac();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 bg-[#020617] text-slate-300 border-r border-cyan-500/20 flex flex-col z-30 shadow-2xl transition-all duration-300 ease-in-out select-none',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Identity & Collapse Trigger */}
      <div className={cn(
        'border-b border-cyan-500/20 bg-[#040a14]/90 backdrop-blur-md transition-all flex items-center',
        collapsed ? 'p-3 justify-center' : 'px-4 py-3.5 justify-between'
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Custom Ocean Wave Current Logo */}
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 p-0.5 shadow-md shadow-cyan-950/60 shrink-0">
            <div className="w-full h-full bg-[#030914] rounded-[10px] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-transparent" />
              <Waves className="w-5 h-5 text-cyan-400 animate-pulse relative z-10" />
            </div>
          </div>
          {!collapsed && (
            <div className="transition-opacity duration-200 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-tight text-white font-heading">
                  JalRakshak
                </h1>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-cyan-300/80 font-medium tracking-wide truncate">
                Creek Outfall Intelligence
              </p>
            </div>
          )}
        </div>

        {/* Sidebar Collapse Toggle Button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className={cn(
              'p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-900/80 transition-colors',
              collapsed && 'mt-2'
            )}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Active RBAC Role Pill */}
      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 bg-[#050e1d] border border-cyan-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <p className="text-[10.5px] text-cyan-300 font-bold tracking-wide uppercase truncate">
                {roleConfig.badge}
              </p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          </div>
          <p className="text-[10px] text-slate-300 mt-0.5 leading-snug truncate">
            {roleConfig.zoneScope}
          </p>
        </div>
      )}

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, badge }) => {
                const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    title={collapsed ? label : undefined}
                    className={cn(
                      'group flex items-center rounded-xl text-xs font-medium transition-all duration-150',
                      collapsed
                        ? 'justify-center p-2.5 my-1'
                        : 'justify-between px-3 py-2',
                      isActive
                        ? 'bg-cyan-950/70 text-cyan-300 border-l-2 border-cyan-400 font-semibold shadow-[inset_0_0_12px_rgba(6,182,212,0.15)]'
                        : 'text-slate-300 hover:bg-[#071326] hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Icon className={cn('w-4 h-4 transition-colors shrink-0', isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300')} />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </div>
                    {!collapsed && badge && (
                      <span className={cn(
                        'text-[8.5px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0 ml-1.5',
                        isActive
                          ? 'bg-cyan-400 text-slate-950 animate-pulse'
                          : 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/40'
                      )}>
                        {badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed ? (
        <div className="px-4 py-3 border-t border-cyan-950/70 bg-[#030814]/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] font-bold text-slate-200">10 Monitored Stations</p>
            </div>
            <span className="text-[9.5px] font-mono text-cyan-400 font-bold">SHA-256</span>
          </div>
          <p className="text-[9.5px] text-slate-500 mt-0.5 leading-snug">
            Autonomous Marine Choke Defense
          </p>
        </div>
      ) : (
        <div className="p-3 border-t border-cyan-950/70 flex justify-center">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="System Live" />
        </div>
      )}
    </aside>
  );
}

