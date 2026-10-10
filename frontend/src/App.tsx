import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginModal from './components/LoginModal';
import AccessDenied from './components/AccessDenied';
import OverviewPage from './pages/OverviewPage';
import Simulator3DPage from './pages/Simulator3DPage';
import HotspotMapPage from './pages/HotspotMapPage';

import ForecastPage from './pages/ForecastPage';
import CleanupPage from './pages/CleanupPage';
import AnalyticsPage from './pages/AnalyticsPage';
import IoTManagementPage from './pages/IoTManagementPage';
import DroneMonitoringPage from './pages/DroneMonitoringPage';
import FieldReportingPage from './pages/FieldReportingPage';
import SatelliteMonitoringPage from './pages/SatelliteMonitoringPage';
import MonsoonMonitoringPage from './pages/MonsoonMonitoringPage';
import LandingPage from './pages/LandingPage';
import { RbacProvider, useRbac } from './context/RbacContext';
import { PanelLeftClose, PanelLeftOpen, Waves, Shield, KeyRound, UserCheck } from 'lucide-react';
import { cn } from './lib/utils';

function ProtectedRoute({ path, children }: { path: string; children: React.ReactNode }) {
  const { isRouteAllowed, user } = useRbac();
  const location = useLocation();

  if (!isRouteAllowed(path)) {
    // If user is at root '/' but their role does not have access to root (e.g. Field Worker or Drone Operator),
    // redirect smoothly to their home workspace
    if (location.pathname === '/' && user.homeRoute !== '/') {
      return <Navigate to={user.homeRoute} replace />;
    }
    return <AccessDenied path={path} />;
  }
  return <>{children}</>;
}

function UserHeaderStatus() {
  const { user, openLoginModal } = useRbac();

  return (
    <button
      onClick={openLoginModal}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#071322] border border-cyan-500/30 hover:border-cyan-400 hover:bg-[#0a1b32] transition-all text-xs text-left shadow-xs group"
      title="Click to switch role or view credentials"
    >
      <div className={cn('w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shrink-0 text-xs font-bold shadow-xs', user.avatarBg)}>
        <Shield className="w-3.5 h-3.5" />
      </div>
      <div className="hidden sm:block">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-100 text-[11px] truncate max-w-[130px] md:max-w-[160px]">
            {user.name.split('(')[0]}
          </span>
          <span className={cn('text-[8.5px] font-black px-1.5 py-0.2 rounded uppercase border', user.badgeColor)}>
            {user.badge}
          </span>
        </div>
        <p className="text-[9.5px] text-cyan-400/80 truncate max-w-[160px]">
          {user.clearanceLevel.split('—')[0]}
        </p>
      </div>
      <KeyRound className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 shrink-0 ml-0.5" />
    </button>
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
              10 Monitored Stations · Real ML Vision & Telemetry
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 hidden sm:inline">
              OPERATIONAL
            </span>
          </div>

          <div className="flex items-center gap-3">


            {/* API Live Telemetry Indicator */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[10px]">LIVE</span>
            </div>

            {/* User Profile & Role Switcher */}
            <UserHeaderStatus />
          </div>
        </header>

        {/* Page Routing (Role Protected) */}
        <main className="flex-1 p-4 md:p-6 bg-[#020617]">
          <Routes>
            <Route path="/overview" element={<ProtectedRoute path="/overview"><OverviewPage /></ProtectedRoute>} />
            <Route path="/map" element={<ProtectedRoute path="/map"><HotspotMapPage /></ProtectedRoute>} />
            <Route path="/drone" element={<ProtectedRoute path="/drone"><DroneMonitoringPage /></ProtectedRoute>} />
            <Route path="/worker" element={<ProtectedRoute path="/worker"><FieldReportingPage /></ProtectedRoute>} />
            <Route path="/satellite" element={<ProtectedRoute path="/satellite"><SatelliteMonitoringPage /></ProtectedRoute>} />
            <Route path="/iot-management" element={<ProtectedRoute path="/iot-management"><IoTManagementPage /></ProtectedRoute>} />
            <Route path="/forecast" element={<ProtectedRoute path="/forecast"><ForecastPage /></ProtectedRoute>} />
            <Route path="/cleanup" element={<ProtectedRoute path="/cleanup"><CleanupPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute path="/analytics"><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/simulator" element={<ProtectedRoute path="/simulator"><Simulator3DPage /></ProtectedRoute>} />
            <Route path="/monsoon" element={<ProtectedRoute path="/monsoon"><MonsoonMonitoringPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
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
        <LoginModal />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </RbacProvider>
    </BrowserRouter>
  );
}
