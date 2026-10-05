import { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import OverviewPage from './pages/OverviewPage';
import Simulator3DPage from './pages/Simulator3DPage';
import HotspotMapPage from './pages/HotspotMapPage';
import DetectionPage from './pages/DetectionPage';
import ForecastPage from './pages/ForecastPage';
import CleanupPage from './pages/CleanupPage';
import RecoveryPage from './pages/RecoveryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import EconomicsPage from './pages/EconomicsPage';
import ModelCardPage from './pages/ModelCardPage';
import SettingsPage from './pages/SettingsPage';
import { RbacProvider, useRbac, ROLES, type UserRole } from './context/RbacContext';
import { PanelLeftClose, PanelLeftOpen, Waves, Shield, ChevronDown, UserCheck, AlertTriangle } from 'lucide-react';
import { cn } from './lib/utils';

function RbacRoleSelector() {
  const { role, roleConfig, setRole } = useRbac();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleColors: Record<UserRole, { badge: string; border: string }> = {
    COMMISSIONER: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', border: 'border-emerald-500/30' },
    ZONAL_MITHI: { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', border: 'border-cyan-500/30' },
    ZONAL_MALAD: { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40', border: 'border-blue-500/30' },
    ZONAL_TROMBAY: { badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', border: 'border-purple-500/30' },
    OPERATOR: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', border: 'border-amber-500/30' },
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#071322] border hover:border-cyan-500/60 transition-all text-xs text-left shadow-xs',
          roleColors[role].border
        )}
      >
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-600 to-teal-800 flex items-center justify-center text-white shrink-0 shadow-xs">
          <Shield className="w-3.5 h-3.5" />
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 text-[11px] truncate max-w-[140px] md:max-w-[170px]">
              {roleConfig.title.split('(')[0]}
            </span>
            <span className={cn('text-[9px] font-black px-1 py-0.2 rounded uppercase border', roleColors[role].badge)}>
              {roleConfig.badge}
            </span>
          </div>
          <p className="text-[9.5px] text-cyan-400/80 truncate max-w-[170px]">
            Scope: {roleConfig.zoneScope}
          </p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#050e1b] border border-cyan-900/60 shadow-2xl p-2 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-cyan-950/80 mb-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
              Select Operating Role (RBAC)
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Simulates multi-tier municipal officer authorization
            </p>
          </div>

          <div className="space-y-1">
            {(Object.keys(ROLES) as UserRole[]).map((rKey) => {
              const rCfg = ROLES[rKey];
              const isSelected = role === rKey;
              return (
                <button
                  key={rKey}
                  onClick={() => {
                    setRole(rKey);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5',
                    isSelected
                      ? 'bg-cyan-950/60 border border-cyan-500/40 text-white'
                      : 'hover:bg-slate-900/70 text-slate-300 hover:text-white border border-transparent'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                    isSelected ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  )}>
                    <UserCheck className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-[11px] truncate text-slate-100">
                        {rCfg.title}
                      </span>
                      <span className={cn('text-[8.5px] font-extrabold px-1 rounded uppercase border shrink-0', roleColors[rKey].badge)}>
                        {rCfg.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {rCfg.department}
                    </p>
                    <p className="text-[9.5px] text-cyan-400/90 mt-0.5">
                      📍 {rCfg.zoneScope}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('jalrakshak_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('jalrakshak_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#020617] font-sans text-slate-100 antialiased flex selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navigation Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-h-screen bg-[#020617] transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        )}
      >
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-14 bg-[#040a14]/90 backdrop-blur-md border-b border-cyan-500/20 px-4 md:px-6 flex items-center justify-between shadow-lg shadow-black/40">
          <div className="flex items-center gap-3">
            {/* Sidebar Collapse Toggle Button */}
            <button
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Hide Sidebar'}
              className="p-1.5 rounded-lg border border-cyan-900/60 bg-[#071322] text-slate-300 hover:text-cyan-300 hover:border-cyan-400 transition-colors shadow-xs"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <span className="text-[11px] font-extrabold uppercase tracking-wider text-white font-heading">
              Mumbai Creek Surveillance & Choke Prevention
            </span>
            <span className="text-slate-600 hidden sm:inline">/</span>
            <span className="text-[11px] font-medium text-slate-300 hidden md:inline">
              10 Monitored Stations · IoT Sonar + CCTV + Choke Beacons
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 hidden sm:inline">
              OPERATIONAL
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct 3D Digital Twin Quick Link */}
            <Link
              to="/simulator"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-cyan-200 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 transition-all shadow-xs shadow-cyan-950/50 hover:shadow-cyan-500/20"
            >
              <Waves className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>3D Sensor Twin</span>
            </Link>

            {/* API Live Telemetry Indicator */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[10px]">LIVE</span>
            </div>

            {/* Interactive RBAC Role Selector Dropdown */}
            <RbacRoleSelector />
          </div>
        </header>

        {/* Page Routing */}
        <main className="flex-1 p-4 md:p-6 bg-[#020617]">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/simulator" element={<Simulator3DPage />} />
            <Route path="/map" element={<HotspotMapPage />} />
            <Route path="/detection" element={<DetectionPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/cleanup" element={<CleanupPage />} />
            <Route path="/recovery" element={<RecoveryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/economics" element={<EconomicsPage />} />
            <Route path="/model-card" element={<ModelCardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RbacProvider>
        <MainLayout />
      </RbacProvider>
    </BrowserRouter>
  );
}

