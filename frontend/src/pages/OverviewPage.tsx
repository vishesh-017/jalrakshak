import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  MapPin,
  AlertTriangle,
  Radio,
  Navigation as NavigationIcon,
  ShieldCheck,
  Camera,
  Waves,
  RefreshCw,
  ArrowUpRight,
  Droplets,
  Activity,
  Layers,
  Sparkles,
  Shield,
  Eye
} from 'lucide-react';
import { getDashboardMetrics, getSites, getCleanupTasks } from '../lib/api';
import type { DashboardMetrics, MonitoringSite, CleanupTask, RiskLevel } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import { riskBadgeColor, riskMarkerColor, sourceBadge, fmt } from '../lib/utils';
import { useRbac } from '../context/RbacContext';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });

function createMiniMarker(riskLevel: RiskLevel, label: string) {
  const color = riskMarkerColor(riskLevel);
  const isChoking = riskLevel === 'Critical';

  const pulseRing = isChoking
    ? `<circle cx="16" cy="16" r="14" fill="#f43f5e" opacity="0.45" class="choke-pulse"/>`
    : `<circle cx="16" cy="16" r="13" fill="${color}" opacity="0.25"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    ${pulseRing}
    <circle cx="16" cy="16" r="10" fill="#040c18" stroke="${color}" stroke-width="2"/>
    <circle cx="16" cy="16" r="4.5" fill="${color}"/>
    <line x1="16" y1="26" x2="16" y2="38" stroke="${color}" stroke-width="2" stroke-dasharray="1,1"/>
    <text x="16" y="16" text-anchor="middle" dy=".35em" fill="white" font-size="7.5" font-family="monospace" font-weight="900">${label}</text>
  </svg>`;
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

function MiniMapPreview({ sites }: { sites: MonitoringSite[] }) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [19.085, 72.865],
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
    });
    // Esri Dark Gray Base + Reference (Zero watermark, high resolution dark GIS canvas)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: '&copy; Esri &copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || sites.length === 0) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    sites.forEach(s => {
      const marker = L.marker([s.latitude, s.longitude], {
        icon: createMiniMarker(s.current_risk_level, s.id.split('-')[1] || s.id),
      }).addTo(mapRef.current!);

      const isChoking = s.current_risk_score >= 70;
      const popupHtml = `
        <div style="font-family: inherit; font-size: 11px; padding: 4px; background: #040c18; color: #e2e8f0; border-radius: 8px;">
          <div style="font-weight: 800; color: #ffffff;">${s.name}</div>
          <div style="color: #38bdf8; font-size: 10px; margin-top: 2px;">${s.zone} (${s.id})</div>
          <div style="margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: ${isChoking ? '#f43f5e' : '#2dd4bf'};">
              ${isChoking ? '🚨 CHOKING' : 'Risk'}: ${s.current_risk_score.toFixed(0)}/100
            </span>
          </div>
          <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">
            Barrier: <strong style="color: #f1f5f9">${s.barrier_status}</strong>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      markersRef.current.push(marker);
    });
  }, [sites]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-cyan-950/80 shadow-2xl bg-[#020617]">
      <div className="absolute top-2.5 right-2.5 z-[500] bg-[#050f20]/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-cyan-500/40 shadow-xl flex items-center gap-2">
        <span className="text-[11px] font-bold text-cyan-300">10 Sensor Stations</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/map')}
          className="text-[11px] h-6 px-2 text-cyan-300 hover:text-white border-cyan-700/60"
        >
          Full GIS Map →
        </Button>
      </div>
      <div ref={containerRef} className="h-64 w-full" />
    </div>
  );
}

interface ClickableMetricCardProps {
  label: string;
  value: string | number;
  sub: string;
  variant: 'teal' | 'coral' | 'amber' | 'blue' | 'emerald' | 'cyan';
  to: string;
  badgeText?: string;
  badgeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  contextNote?: string;
}

function ClickableMetricCard({
  label,
  value,
  sub,
  variant = 'teal',
  to,
  badgeText,
  badgeColor = 'bg-slate-900 text-slate-300 border border-slate-700',
  icon: Icon,
  contextNote
}: ClickableMetricCardProps) {
  const navigate = useNavigate();

  const variantStyles: Record<string, {
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
  }> = {
    teal: {
      border: 'border-cyan-900/60 hover:border-cyan-400/80',
      bg: 'bg-[#050e1b]/95',
      iconBg: 'bg-cyan-950/80 border border-cyan-500/40',
      iconColor: 'text-cyan-400',
      valueColor: 'text-cyan-300'
    },
    coral: {
      border: 'border-rose-900/60 hover:border-rose-400/80',
      bg: 'bg-[#050e1b]/95',
      iconBg: 'bg-rose-950/80 border border-rose-500/40',
      iconColor: 'text-rose-400',
      valueColor: 'text-rose-300'
    },
    amber: {
      border: 'border-amber-900/60 hover:border-amber-400/80',
      bg: 'bg-[#050e1b]/95',
      iconBg: 'bg-amber-950/80 border border-amber-500/40',
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-300'
    },
    blue: {
      border: 'border-blue-900/60 hover:border-blue-400/80',
      bg: 'bg-[#050e1b]/95',
      iconBg: 'bg-blue-950/80 border border-blue-500/40',
      iconColor: 'text-blue-400',
      valueColor: 'text-blue-300'
    },
    emerald: {
      border: 'border-emerald-900/60 hover:border-emerald-400/80',
      bg: 'bg-[#050e1b]/95',
      iconBg: 'bg-emerald-950/80 border border-emerald-500/40',
      iconColor: 'text-emerald-400',
      valueColor: 'text-emerald-300'
    },
    cyan: {
      border: 'border-cyan-900/60 hover:border-cyan-400/80',
      bg: 'bg-[#050e1b]/95',
      iconBg: 'bg-cyan-950/80 border border-cyan-500/40',
      iconColor: 'text-cyan-400',
      valueColor: 'text-cyan-300'
    }
  };

  const scheme = variantStyles[variant] || variantStyles.teal;

  return (
    <button
      onClick={() => navigate(to)}
      className={`relative group rounded-2xl p-4 text-left transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/30 hover:-translate-y-0.5 border ${scheme.border} ${scheme.bg} block w-full overflow-hidden shadow-lg`}
    >
      <div className="absolute top-0 right-0 -mt-3 -mr-3 w-16 h-16 rounded-full bg-cyan-500/[0.04] group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

      {/* Top Header: Icon + Label + Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${scheme.iconBg} ${scheme.iconColor} shadow-xs shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-200 tracking-tight leading-tight">{label}</span>
        </div>
        {badgeText && (
          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${badgeColor} shrink-0`}>
            {badgeText}
          </span>
        )}
      </div>

      {/* Metric Value */}
      <div className="flex items-baseline justify-between mt-3">
        <p className={`text-2xl lg:text-3xl font-black font-heading tracking-tight leading-none ${scheme.valueColor}`}>
          {value}
        </p>
        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all inline-flex items-center gap-0.5">
          <span>Inspect</span>
          <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>

      {/* Contextual Description */}
      <p className="text-[11px] text-slate-400 mt-2 leading-snug">
        {sub}
      </p>

      {/* Context note pill */}
      {contextNote && (
        <div className="mt-2.5 pt-2 border-t border-cyan-950/60 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/80 group-hover:bg-cyan-400 transition-colors" />
          <span className="truncate">{contextNote}</span>
        </div>
      )}
    </button>
  );
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { role, roleConfig, isSiteAllowed } = useRbac();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [tasks, setTasks] = useState<CleanupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [m, s, t] = await Promise.all([
        getDashboardMetrics(),
        getSites(),
        getCleanupTasks({ status: 'In Progress' })
      ]);
      setMetrics(m);
      setSites(s);
      setTasks(t.slice(0, 5));
      setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner text="Connecting to Mumbai creek surveillance grid..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!metrics) return null;

  // Filter top 3 highest priority sites for the concise alert summary
  const topAlertSites = sites
    .filter(s => s.current_risk_score >= 60 || s.current_risk_level === 'Critical' || s.current_risk_level === 'High')
    .sort((a, b) => b.current_risk_score - a.current_risk_score)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Environmental Command Center Hero Section */}
      <div className="ocean-gradient-hero rounded-2xl p-6 text-white border border-cyan-500/30 shadow-2xl relative overflow-hidden">
        {/* Subtle Water Waves Texture */}
        <div className="absolute inset-0 opacity-15 water-waves-bg pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                <Waves className="w-3 h-3 text-cyan-300" />
                Mumbai Waterway Intelligence Grid
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#040e1c] text-cyan-300 border border-cyan-500/40">
                <Shield className="w-3 h-3 text-cyan-400" />
                RBAC: {roleConfig.badge}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Simulated Monsoon Cycle
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-heading">
              Waterway Surveillance & Plastic Interception Command
            </h1>

            <p className="text-sm text-cyan-100/90 font-medium leading-relaxed">
              Real-time creek sonar telemetry, YOLOv8 debris surveillance, and 3D digital twin choke simulation.
            </p>

            <div className="pt-2 flex items-center gap-4 text-xs text-slate-300 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Active Network: <strong className="text-white">10 Outfall Stations</strong></span>
              </div>
              <span className="text-cyan-900 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>Hydrodynamic Surge Model: <strong className="text-white">2.5× Monsoon Choke Rate</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Command Station Telemetry Widget */}
          <div className="bg-[#030914]/90 backdrop-blur-md rounded-2xl p-4 border border-cyan-500/30 text-xs space-y-3 min-w-[280px] shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-950/80">
              <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Live Sensor Telemetry
              </span>
              <button
                onClick={load}
                title="Refresh live telemetry"
                className="text-slate-400 hover:text-cyan-300 transition-colors p-1 rounded-lg hover:bg-cyan-950/50 flex items-center gap-1 text-[10px]"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{lastRefreshed || 'Sync'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 text-[10px] block">Tidal Surge Proxy</span>
                <span className="font-bold text-white text-xs">Ebb Flow (+1.8m)</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Fleet Optimizer</span>
                <span className="font-bold text-cyan-300 text-xs">OR-Tools VRPTW</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Surveillance Lens</span>
                <span className="font-bold text-white text-xs">YOLOv8 Medium</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Audit Integrity</span>
                <span className="font-bold text-emerald-400 text-xs">SHA-256 Ledger</span>
              </div>
            </div>

            <div className="pt-1">
              <Button
                size="sm"
                onClick={() => navigate('/simulator')}
                className="w-full text-xs font-black bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-slate-950 shadow-md shadow-cyan-950/50"
              >
                Launch 3D Sensor & Choke Twin →
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <ClickableMetricCard
          label="Monitored Outfalls"
          value={metrics.total_monitored_sites}
          sub="10 strategic drainage stations"
          variant="teal"
          to="/map"
          badgeText="10 STATIONS"
          badgeColor="bg-cyan-950 text-cyan-300 border border-cyan-500/40"
          icon={MapPin}
          contextNote="Mithi, Malad, Trombay"
        />

        <ClickableMetricCard
          label="Choking Hotspots"
          value={metrics.high_risk_outlets_count}
          sub="Plastic risk score ≥ 60"
          variant="coral"
          to="/map"
          badgeText="CRITICAL"
          badgeColor="bg-rose-950 text-rose-300 border border-rose-500/40"
          icon={AlertTriangle}
          contextNote="Mahim & Marve choke zones"
        />

        <ClickableMetricCard
          label="Active Risk Alerts"
          value={metrics.active_alerts_count}
          sub="Storm surge choke alerts"
          variant="amber"
          to="/forecast"
          badgeText="SIMULATED"
          badgeColor="bg-amber-950 text-amber-300 border border-amber-500/40"
          icon={Radio}
          contextNote="Hydrodynamic 4-factor formula"
        />

        <ClickableMetricCard
          label="Pending Dispatch"
          value={metrics.pending_cleanup_tasks_count}
          sub="Awaiting officer authorization"
          variant="blue"
          to="/cleanup"
          badgeText="DISPATCH"
          badgeColor="bg-blue-950 text-blue-300 border border-blue-500/40"
          icon={NavigationIcon}
          contextNote="OR-Tools waypoint queue"
        />

        <ClickableMetricCard
          label="Verified Recovery"
          value={`${fmt(metrics.verified_plastic_recovered_kg, 0)} kg`}
          sub="Logged in cryptographic ledger"
          variant="emerald"
          to="/recovery"
          badgeText="EPR AUDIT"
          badgeColor="bg-emerald-950 text-emerald-300 border border-emerald-500/40"
          icon={ShieldCheck}
          contextNote="SHA-256 tamper-proof chain"
        />

        <ClickableMetricCard
          label="Optical Detections"
          value={metrics.recent_detections_count}
          sub="CCTV creek feeds & drones"
          variant="cyan"
          to="/detection"
          badgeText="YOLOv8m"
          badgeColor="bg-cyan-950 text-cyan-300 border border-cyan-500/40"
          icon={Camera}
          contextNote="Water ripple filter enabled"
        />
      </div>

      {/* Choke Alerts + Map Preview Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Choke Risk Stations */}
        <div className="lg:col-span-6 space-y-3">
          <Card className="border-rose-900/60 bg-[#050e1b]/95">
            <CardHeader className="pb-2 border-b border-rose-950/70">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span className="text-rose-500 animate-pulse">⚠</span>
                    Active Choking Hotspots & Outfalls
                  </CardTitle>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ranked by predicted plastic accumulation mass and trash boom saturation
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/cleanup')} className="text-xs h-7 border-rose-800 text-rose-300 hover:text-white">
                  Dispatch Crew →
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-3">
              {topAlertSites.map((site, idx) => (
                <div
                  key={site.id}
                  className="p-3 bg-[#030914] border border-rose-900/40 rounded-xl flex items-center justify-between hover:border-rose-500/50 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5 shadow-sm">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{site.name}</p>
                      <p className="text-[10px] text-slate-400">{site.zone} ({site.id})</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold text-rose-300 bg-rose-950/70 border border-rose-500/30 px-1.5 py-0.5 rounded">
                          Barrier: {site.barrier_status}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Rain: <strong className="text-slate-200">{site.latest_rainfall?.toFixed(0) ?? 85} mm</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-rose-400 font-mono">{site.current_risk_score.toFixed(0)}/100</p>
                    <Badge className={riskBadgeColor(site.current_risk_level)}>{site.current_risk_level}</Badge>
                    <div className="mt-1">
                      <button
                        onClick={() => navigate('/cleanup')}
                        className="text-[10px] text-cyan-400 font-semibold hover:underline block"
                      >
                        Dispatch Crew →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {topAlertSites.length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center">No high-risk alerts at this moment.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Small Map Preview */}
        <div className="lg:col-span-6">
          <Card className="bg-[#050e1b]/95 border-cyan-950/80">
            <CardHeader className="pb-2 border-b border-cyan-950/70">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-white">
                    Mumbai Outfall Sensor Hotspot Grid
                  </CardTitle>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sensor positions color-coded by predicted choke risk level
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Critical</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> High</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Low</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <MiniMapPreview sites={sites} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rainfall vs Accumulation */}
        <Card className="bg-[#050e1b]/95 border-cyan-950/80">
          <CardHeader className="pb-2 border-b border-cyan-950/70">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  7-Day Monsoon Rainfall vs Plastic Accumulation Flush
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hydrodynamic simulation · Rainfall (mm) vs Est. Debris Accumulation (kg) & Recovery (kg)
                </p>
              </div>
              <Badge className="bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                SIMULATED SCENARIO
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={metrics.rainfall_accumulation_chart} margin={{ top: 10, right: 12, left: -5, bottom: 0 }}>
                <defs>
                  <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02}/>
                  </linearGradient>
                  <linearGradient id="debrisGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02}/>
                  </linearGradient>
                  <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#0b1b30" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#1e293b" />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#1e293b"
                  label={{ value: 'Rain (mm) / Mass (kg)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#030914', borderColor: '#06b6d4', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                  formatter={(value: any, name: any) => {
                    if (name === 'Rainfall Flush (mm)') return [`${value} mm`, name];
                    return [`${value} kg`, name];
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={32}
                  wrapperStyle={{ fontSize: 11, paddingTop: 0, color: '#94a3b8' }}
                />
                <Area
                  type="monotone"
                  dataKey="rainfall_mm"
                  name="Rainfall Flush (mm)"
                  stroke="#0284c7"
                  fill="url(#rainGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="plastic_accumulated_kg"
                  name="Est. Debris Accumulation (kg)"
                  stroke="#f43f5e"
                  fill="url(#debrisGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="recovered_kg"
                  name="Measured Recovery (kg)"
                  stroke="#0d9488"
                  fill="url(#recoveryGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-500 text-right mt-1">
              *Note: Curves demonstrate simulated correlation between rainfall flushes and debris accumulation; not sensor-measured values.
            </p>
          </CardContent>
        </Card>

        {/* Risk Trend by Basin */}
        <Card className="bg-[#050e1b]/95 border-cyan-950/80">
          <CardHeader className="pb-2 border-b border-cyan-950/70">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Intra-Day Choke Risk Trend by Basin
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hydrodynamic physical risk estimate (0–100 scale) · Tidal surge & rainfall flush dynamics
                </p>
              </div>
              <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
                PHYSICS MODEL
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={metrics.risk_trend_recent} margin={{ top: 10, right: 12, left: -5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0b1b30" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#1e293b" />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#1e293b"
                  label={{ value: 'Risk Score (0–100)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#030914', borderColor: '#06b6d4', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                  formatter={(value: any, name: any) => [`${value} / 100 Score`, name]}
                />
                <Legend
                  verticalAlign="top"
                  height={32}
                  wrapperStyle={{ fontSize: 11, paddingTop: 0, color: '#94a3b8' }}
                />
                <Line
                  type="monotone"
                  dataKey="mithi_risk"
                  name="Mithi River Basin"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#06b6d4' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="malad_risk"
                  name="Malad Creek Basin"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f97316' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="trombay_risk"
                  name="Trombay / Thane Creek Basin"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-500 text-right mt-1">
              *Note: Peak scores coincide with simulated high spring tides (&gt;4.2m) when gravity drainage slows down.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Priority Sites Table + Data Integrity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* All Monitored Pilot Sites Table */}
        <div className="lg:col-span-2">
          <Card className="bg-[#050e1b]/95 border-cyan-950/80">
            <CardHeader className="pb-2 border-b border-cyan-950/70">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    All 10 Monitored Creek Stations
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live coordinates, telemetry sensors & structural barrier statuses
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/map')} className="text-xs text-cyan-300 hover:text-white border-cyan-700/60">
                  Inspect on Map →
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-cyan-950/50 max-h-80 overflow-y-auto">
                {sites.map((site) => {
                  const inUserZone = isSiteAllowed(site.zone);
                  return (
                    <div
                      key={site.id}
                      onClick={() => navigate('/forecast')}
                      className="px-5 py-3 flex items-center justify-between hover:bg-cyan-950/40 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-mono text-cyan-400 bg-[#030914] px-2 py-0.5 rounded border border-cyan-900/60 font-semibold w-16 text-center">
                          {site.id}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white group-hover:text-cyan-300">{site.name}</p>
                            {inUserZone && (
                              <span className="text-[8px] font-bold text-cyan-300 bg-cyan-950/80 px-1 rounded border border-cyan-500/30">
                                YOUR ZONE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{site.zone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs text-slate-400 hidden sm:block">
                          <p>{site.latest_rainfall?.toFixed(0) ?? '—'} mm rain</p>
                          <p className="text-[10px] text-slate-500">Barrier: <strong className="text-slate-300">{site.barrier_status}</strong></p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-white font-mono">{site.current_risk_score.toFixed(0)}/100</p>
                          <Badge className={riskBadgeColor(site.current_risk_level)}>{site.current_risk_level}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Provenance & Prediction Target */}
        <div className="space-y-3">
          <Card className="bg-[#050e1b]/95 border-cyan-950/80">
            <CardHeader className="pb-2 border-b border-cyan-950/70">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Data Provenance Matrix
              </CardTitle>
              <p className="text-[11px] text-slate-400">Non-negotiable data honesty accounting</p>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-2">
                {Object.entries(metrics.source_breakdown).map(([src, count]) => (
                  <div key={src} className="flex items-center justify-between py-1.5 border-b border-cyan-950/50 last:border-0">
                    <Badge className={sourceBadge(src)}>{src}</Badge>
                    <span className="text-xs font-bold text-slate-300 font-mono">{count} records</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                *Simulated and scenario records are never mixed into verified real-data audit ledger results.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#041122] to-[#061830] border border-cyan-500/30 shadow-xl">
            <CardContent className="py-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Prototype Prediction Target
                </p>
                <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">SPECIFICATION</Badge>
              </div>
              <p className="text-[11px] text-slate-200 mt-2 leading-relaxed font-medium">
                "Relative likelihood of high visible plastic accumulation at a monitored outlet within 48 hours following a rainfall event."
              </p>
              <p className="text-[10px] text-cyan-400/80 mt-2">
                Decision-support metric; not a calibrated measurement of mass entering the sea.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
