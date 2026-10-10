import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Waves,
  MapPin,
  Scan,
  TrendingUp,
  Navigation,
  BarChart3,
  Cpu,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
  Orbit,
  LogOut,
  User,
  KeyRound,
  CloudRain
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

const ALL_NAV_SECTIONS: NavSection[] = [
  {
    title: 'SURVEILLANCE & AI DETECTION',
    items: [
      { to: '/', label: 'Command Center', icon: LayoutDashboard },
      { to: '/map', label: 'Hotspot GIS Map', icon: MapPin },
      { to: '/drone', label: 'Drone Aerial (ReWater)', icon: Navigation, badge: 'VIDEO' },
      { to: '/worker', label: 'Field Reporting', icon: UserCheck, badge: 'BMC' },
      { to: '/satellite', label: 'Satellite Monitoring', icon: Orbit, badge: 'MARIDA' },
      { to: '/iot-management', label: 'IoT Live Monitoring', icon: Cpu, badge: 'LIVE' },
      { to: '/monsoon', label: 'Monsoon Blockage', icon: CloudRain, badge: 'NEW' },
    ],
  },
  {
    title: 'OPERATIONS & FORECASTS',
    items: [
      { to: '/forecast', label: 'Risk Forecaster', icon: TrendingUp },
      { to: '/cleanup', label: 'Cleanup Dispatch', icon: Navigation },
      { to: '/analytics', label: 'Analytics & Impact', icon: BarChart3 },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { user, isRouteAllowed, openLoginModal, logout } = useRbac();

  // Filter sections and items dynamically according to user's allowed routes
  const filteredSections = ALL_NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => isRouteAllowed(item.to))
  })).filter(section => section.items.length > 0);

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

      {/* Active User Card & Scope Pill */}
      {!collapsed ? (
        <div className="mx-3 mt-3 p-3 bg-[#050e1d] border border-cyan-500/30 rounded-xl relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn(
                'w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shrink-0 text-xs font-bold shadow-xs',
                user.avatarBg
              )}>
                {user.badge.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <span className={cn('text-[8.5px] font-black px-1.5 py-0.2 rounded uppercase border inline-block leading-tight', user.badgeColor)}>
                  {user.badge}
                </span>
                <p className="text-[11px] font-bold text-slate-100 truncate mt-0.5">
                  {user.name.split('(')[0]}
                </p>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          </div>
          
          <p className="text-[9.5px] text-slate-400 mt-1 truncate">
            {user.zoneScope}
          </p>

          <button
            onClick={openLoginModal}
            className="mt-2 w-full py-1 px-2 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <KeyRound className="w-3 h-3" /> Switch Persona / Log In
          </button>
        </div>
      ) : (
        <div className="my-3 flex justify-center">
          <button
            onClick={openLoginModal}
            title={`Active: ${user.name} (${user.badge}) - Click to Switch`}
            className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300 flex items-center justify-center hover:bg-cyan-900 transition-colors"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dynamic Navigation Sections (Role Scoped) */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {filteredSections.map((section) => (
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
                        'text-[8.5px] font-black px-1.5 py-0.5 rounded shadow-xs shrink-0 ml-1.5',
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

      {/* Footer & Logout */}
      {!collapsed ? (
        <div className="px-4 py-3 border-t border-cyan-950/70 bg-[#030814]/90 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] text-slate-400 font-mono">
              Cleared: {user.allowedRoutes.length} View{user.allowedRoutes.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={logout}
              className="text-[10.5px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold hover:underline"
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
          <p className="text-[9.5px] text-slate-500 leading-snug">
            Autonomous Marine Choke Defense
          </p>
        </div>
      ) : (
        <div className="p-3 border-t border-cyan-950/70 flex justify-center">
          <button
            onClick={logout}
            title="Sign Out"
            className="text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-slate-900"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
