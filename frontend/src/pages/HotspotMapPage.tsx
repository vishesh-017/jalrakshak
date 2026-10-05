import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { getSites, optimizeCleanupRoute, type RouteResult } from '../lib/api';
import type { MonitoringSite, RiskLevel } from '../types';
import { riskMarkerColor, riskBadgeColor } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import { useRbac } from '../context/RbacContext';
import {
  MapPin,
  Waves,
  Navigation as NavigationIcon,
  ShieldAlert,
  AlertTriangle,
  Layers,
  Filter,
  CheckCircle2,
  Compass,
  ArrowRight,
  Radio,
  Eye,
  Shield,
  Activity,
  Crosshair
} from 'lucide-react';

// Fix default marker icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });

const RISK_LEVELS: RiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];

function createCustomMarker(riskLevel: RiskLevel, label: string, isChoking: boolean = false) {
  const color = riskMarkerColor(riskLevel);
  const isHighRisk = riskLevel === 'Critical' || riskLevel === 'High';

  const pulseRing = isChoking
    ? `<circle cx="20" cy="20" r="18" fill="#f43f5e" opacity="0.45" class="choke-pulse"/>
       <circle cx="20" cy="20" r="12" fill="#ef4444" opacity="0.3"/>`
    : isHighRisk
    ? `<circle cx="20" cy="20" r="16" fill="${color}" opacity="0.35" class="sensor-ping"/>`
    : `<circle cx="20" cy="20" r="14" fill="${color}" opacity="0.2"/>`;

  const sensorBeacon = `<circle cx="20" cy="8" r="3.5" fill="#38bdf8" stroke="#030712" stroke-width="1.5" />`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
    ${pulseRing}
    <circle cx="20" cy="24" r="11" fill="#09182b" stroke="${color}" stroke-width="2.5" />
    <circle cx="20" cy="24" r="5" fill="${color}"/>
    ${sensorBeacon}
    <line x1="20" y1="35" x2="20" y2="48" stroke="${color}" stroke-width="2.5" stroke-dasharray="1,1"/>
    <text x="20" y="24" text-anchor="middle" dy=".35em" fill="#ffffff" font-size="8" font-family="monospace" font-weight="900">${label}</text>
  </svg>`;

  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50],
  });
}

function createNumberedStopMarker(stopNumber: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="15" fill="#06b6d4" stroke="#ffffff" stroke-width="2" shadow="0 4px 10px rgba(0,0,0,0.5)"/>
    <text x="17" y="17" text-anchor="middle" dy=".35em" fill="#020617" font-size="12" font-weight="900">${stopNumber}</text>
  </svg>`;
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function createDepotMarker() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
    <rect x="4" y="4" width="34" height="34" rx="8" fill="#040c18" stroke="#06b6d4" stroke-width="2.5"/>
    <text x="21" y="21" text-anchor="middle" dy=".35em" fill="#38bdf8" font-size="9" font-weight="900">DEPOT</text>
  </svg>`;
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -21],
  });
}

export default function HotspotMapPage() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routeStopMarkersRef = useRef<L.Marker[]>([]);

  const { roleConfig, isSiteAllowed } = useRbac();

  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [selected, setSelected] = useState<MonitoringSite | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterZone, setFilterZone] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await getSites();
      setSites(data);
      if (data.length > 0) setSelected(data[0]);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Init map with dark tiles
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [19.076, 72.877],
      zoom: 11,
      zoomControl: true,
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

  // Update site markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = sites.filter(s => {
      if (filterZone && !s.zone.includes(filterZone)) return false;
      if (filterRisk && s.current_risk_level !== filterRisk) return false;
      if (filterStatus && !s.response_status.includes(filterStatus)) return false;
      return true;
    });

    filtered.forEach(site => {
      const isChoking = site.current_risk_score >= 70 || site.current_risk_level === 'Critical';
      const marker = L.marker([site.latitude, site.longitude], {
        icon: createCustomMarker(site.current_risk_level, site.id.split('-')[1] || site.id, isChoking),
      });

      marker.on('click', () => setSelected(site));
      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [sites, filterZone, filterRisk, filterStatus]);

  // Route drawing & stop markers
  useEffect(() => {
    if (!mapRef.current) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    routeStopMarkersRef.current.forEach(m => m.remove());
    routeStopMarkersRef.current = [];

    if (activeRoute && activeRoute.polyline?.length > 1) {
      const latlngs = activeRoute.polyline.map(pt => [pt[0], pt[1]] as [number, number]);
      routeLayerRef.current = L.polyline(latlngs, {
        color: '#06b6d4',
        weight: 4,
        dashArray: '6, 8',
        opacity: 0.9
      }).addTo(mapRef.current);

      const depotPt = activeRoute.polyline[0];
      const depotMarker = L.marker([depotPt[0], depotPt[1]], { icon: createDepotMarker() })
        .bindPopup("<div style='color:#020617;font-size:11px;'><strong>BMC Central Operations Hub (Dadar)</strong><br/>Patrol Base</div>")
        .addTo(mapRef.current);
      routeStopMarkersRef.current.push(depotMarker);

      activeRoute.stops.forEach(st => {
        const stopMarker = L.marker([st.latitude, st.longitude], {
          icon: createNumberedStopMarker(st.stop_index)
        }).bindPopup(`<div style='color:#020617;font-size:11px;'><strong>Stop ${st.stop_index}: ${st.name}</strong><br/>Arrival: +${st.arrival_time_offset_min} min<br/>Est Debris: ${st.estimated_debris_kg} kg</div>`)
          .addTo(mapRef.current!);
        routeStopMarkersRef.current.push(stopMarker);
      });

      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [activeRoute]);

  async function handleGenerateRoute() {
    setRoutingLoading(true);
    try {
      const res = await optimizeCleanupRoute({ max_shift_hours: 8.0 });
      setActiveRoute(res);
    } catch (e: any) {
      alert(`Route optimization error: ${e.message}`);
    } finally {
      setRoutingLoading(false);
    }
  }

  function handleClearRoute() {
    setActiveRoute(null);
    if (mapRef.current) mapRef.current.setView([19.076, 72.877], 11);
  }

  const zones = [...new Set(sites.map(s => s.zone))];
  const filtered = sites.filter(s => {
    if (filterZone && !s.zone.includes(filterZone)) return false;
    if (filterRisk && s.current_risk_level !== filterRisk) return false;
    if (filterStatus && !s.response_status.includes(filterStatus)) return false;
    return true;
  });

  return (
    <div className="space-y-4 text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Geospatial Sensor & Choke Surveillance Map
            </h1>
            <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">10 BASIN STATIONS</Badge>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Real-time IoT ultrasonic depth sensors, optical CCTV towers, and predicted plastic choking hotspots across Mumbai creeks
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <div className="px-2.5 py-1.5 rounded-xl bg-[#061220] text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Scope: {roleConfig.badge}</span>
          </div>

          {!activeRoute ? (
            <Button
              size="sm"
              onClick={handleGenerateRoute}
              loading={routingLoading}
              className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white shadow-sm text-xs font-bold"
            >
              <NavigationIcon className="w-3.5 h-3.5 mr-1" />
              Generate OR-Tools Dispatch Route
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleClearRoute} className="text-xs border-cyan-800 text-cyan-300 hover:bg-cyan-950">
              ✕ Clear Route Layer
            </Button>
          )}

          <Link
            to="/simulator"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-950/50"
          >
            <Waves className="w-3.5 h-3.5" />
            <span>3D Digital Twin</span>
          </Link>
        </div>
      </div>

      {/* Main Map + Sidebar Workspace */}
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-12rem)] min-h-[600px]">
        {/* Left: GIS Filter + Site List (Explicit width so it never takes 100% on desktop) */}
        <div className="w-full lg:w-[380px] flex flex-col gap-3 shrink-0 h-full">
          {/* Filters & Counts */}
          <div className="bg-[#050f20]/95 border border-cyan-500/30 rounded-2xl p-3.5 space-y-3 shadow-xl shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                Basin & Risk Filter
              </span>
              <span className="text-[10px] text-cyan-300 font-mono font-semibold">{filtered.length} of {sites.length} stations</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-300 font-medium block mb-1">Basin Area</label>
                <select
                  value={filterZone}
                  onChange={e => setFilterZone(e.target.value)}
                  className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-1.5 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">All Basins</option>
                  {zones.map(z => <option key={z} value={z.split(' ')[0]}>{z.split(' ')[0]}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-300 font-medium block mb-1">Risk Severity</label>
                <select
                  value={filterRisk}
                  onChange={e => setFilterRisk(e.target.value)}
                  className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-1.5 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">All Levels</option>
                  {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Quick Status Legend Row */}
            <div className="pt-2 border-t border-cyan-950/70 flex items-center justify-between text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                Choke Critical
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                High
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                Medium
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Low
              </span>
            </div>
          </div>

          {/* Outfall List with Mini Risk Gauges */}
          <div className="flex-1 overflow-y-auto bg-[#050f20]/95 border border-cyan-500/30 rounded-2xl divide-y divide-cyan-950/60 p-2 shadow-xl">
            {loading && <LoadingSpinner text="Loading stations..." />}
            {error && <ErrorMessage message={error} />}
            {filtered.map(site => {
              const isSelected = selected?.id === site.id;
              const isChoking = site.current_risk_score >= 70 || site.current_risk_level === 'Critical';
              const inUserZone = isSiteAllowed(site.zone);

              return (
                <div
                  key={site.id}
                  onClick={() => {
                    setSelected(site);
                    mapRef.current?.setView([site.latitude, site.longitude], 14, { animate: true });
                  }}
                  className={`p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-cyan-950/90 border border-cyan-400 shadow-lg shadow-cyan-950/60'
                      : 'hover:bg-[#071326] border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-cyan-300 font-bold bg-[#030914] px-1.5 py-0.5 rounded border border-cyan-500/30">
                          {site.id}
                        </span>
                        <p className="text-xs font-bold text-white leading-tight">{site.name}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-[10.5px] text-cyan-300/80 font-medium">{site.zone}</p>
                        {inUserZone && (
                          <span className="text-[8.5px] font-bold text-cyan-200 bg-cyan-900/60 px-1.5 py-0.2 rounded border border-cyan-400/40">
                            YOUR ZONE
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={riskBadgeColor(site.current_risk_level)}>{site.current_risk_level}</Badge>
                  </div>

                  {/* Risk Progress Bar */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          isChoking
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse'
                            : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                        }`}
                        style={{ width: `${Math.min(site.current_risk_score, 100)}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-bold font-mono w-10 text-right ${isChoking ? 'text-rose-400' : 'text-cyan-300'}`}>
                      {site.current_risk_score.toFixed(0)}/100
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-300">
                      Barrier: <strong className="text-white">{site.barrier_status}</strong>
                    </span>
                    {isChoking ? (
                      <span className="text-rose-300 font-bold flex items-center gap-1 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        Choke Hotspot
                      </span>
                    ) : (
                      <span className="text-slate-300">{site.latest_rainfall?.toFixed(0) ?? 85} mm rain</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Map + Overlay Controls */}
        <div className="flex-1 flex flex-col gap-3 min-h-[420px] h-full">
          <div className="relative flex-1 rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl bg-[#020617]">
            <div ref={containerRef} className="absolute inset-0" />

            {/* Active Route Floating Card Overlay */}
            {activeRoute && (
              <div className="absolute top-3 right-3 z-[1000] bg-[#050f20]/95 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl max-w-sm border border-cyan-500/40 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <p className="font-extrabold text-white font-heading">{activeRoute.team_name}</p>
                  </div>
                  <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">OR-Tools VRPTW</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div className="bg-[#030914] p-2 rounded-xl border border-cyan-950/80">
                    <span className="text-[10px] text-slate-300 block">Total Patrol Distance</span>
                    <p className="font-extrabold text-cyan-300 text-sm font-mono">{activeRoute.total_distance_km} km</p>
                  </div>
                  <div className="bg-[#030914] p-2 rounded-xl border border-cyan-950/80">
                    <span className="text-[10px] text-slate-300 block">Estimated Shift Time</span>
                    <p className="font-extrabold text-teal-300 text-sm font-mono">{activeRoute.total_duration_hours} hrs</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                    Patrol Sequence ({activeRoute.stops.length} Priority Stations):
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {activeRoute.stops.map(st => (
                      <div key={st.stop_index} className="flex items-center justify-between text-[11px] py-1 border-b border-cyan-950/50 last:border-0">
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 font-black flex items-center justify-center text-[9px]">
                            {st.stop_index}
                          </span>
                          <span className="font-semibold text-white truncate max-w-[130px]">{st.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400">+{st.arrival_time_offset_min}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Site Detail HUD Panel */}
          {selected && (
            <div className="bg-[#050f20]/95 border border-cyan-500/40 rounded-2xl p-4 shadow-2xl animate-in fade-in duration-200 text-slate-100 shrink-0">
              <div className="flex items-start justify-between mb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                      {selected.id}
                    </span>
                    <Badge className={riskBadgeColor(selected.current_risk_level)}>{selected.current_risk_level}</Badge>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-300 font-medium">{selected.zone}</span>
                  </div>
                  <h2 className="text-base font-extrabold text-white mt-1 font-heading">{selected.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/simulator"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-950/50 transition-all"
                  >
                    <Waves className="w-3.5 h-3.5" />
                    <span>View in 3D Twin</span>
                  </Link>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-200 bg-[#030914] px-2.5 py-1.5 rounded-xl mb-3 border border-cyan-950/70">
                📍 {selected.location_description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
                <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950/70">
                  <p className="text-[10px] text-slate-300 font-medium">Risk Score</p>
                  <p className="font-extrabold text-cyan-300 font-mono text-sm">{selected.current_risk_score.toFixed(0)}/100</p>
                </div>
                <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950/70">
                  <p className="text-[10px] text-slate-300 font-medium">Rainfall 24h</p>
                  <p className="font-extrabold text-white font-mono text-sm">{selected.latest_rainfall?.toFixed(0) ?? '85'} mm</p>
                </div>
                <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950/70">
                  <p className="text-[10px] text-slate-300 font-medium">Catchment</p>
                  <p className="font-extrabold text-white font-mono text-sm">{selected.catchment_area_sqkm} km²</p>
                </div>
                <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950/70">
                  <p className="text-[10px] text-slate-300 font-medium">Urban Density</p>
                  <p className="font-semibold text-slate-100 text-[11px]">{selected.upstream_urban_density}</p>
                </div>
                <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950/70">
                  <p className="text-[10px] text-slate-300 font-medium">Barrier Type</p>
                  <p className="font-semibold text-slate-100 text-[11px] truncate">{selected.barrier_type}</p>
                </div>
                <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950/70">
                  <p className="text-[10px] text-slate-300 font-medium">Barrier Condition</p>
                  <p className="font-semibold text-slate-100 text-[11px]">{selected.barrier_status}</p>
                </div>
                <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950/70">
                  <p className="text-[10px] text-slate-300 font-medium">Operation Status</p>
                  <p className="font-semibold text-slate-100 text-[11px]">{selected.response_status}</p>
                </div>
                <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950/70">
                  <p className="text-[10px] text-slate-300 font-medium">Sensors Active</p>
                  <p className="font-bold text-cyan-300 text-[11px] flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5 text-cyan-400" />
                    Sonar + CCTV
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
