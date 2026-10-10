import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import {
  getSites,
  optimizeCleanupRoute,
  getHotspots,
  getHotspotSummary,
  getMumbaiBoundary,
  dispatchCleanupForHotspot,
  getImageUrl,
  type RouteResult
} from '../lib/api';
import type { MonitoringSite, RiskLevel, UnifiedHotspot, HotspotSummary, HotspotSourceType } from '../types';
import { riskMarkerColor, riskBadgeColor } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import { useRbac } from '../context/RbacContext';
import {
  MapPin,
  Waves,
  Navigation as DroneIcon,
  Orbit,
  UserCheck,
  Cpu,
  Layers,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink,
  Shield,
  Truck,
  Sparkles,
  RefreshCw,
  Eye,
  Sliders,
  Info,
  Maximize2,
  X
} from 'lucide-react';

// Fix default marker icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });

const SOURCE_COLORS: Record<HotspotSourceType, string> = {
  iot: '#06b6d4',         // Cyan
  satellite: '#a855f7',   // Purple
  drone: '#f59e0b',       // Amber
  field_worker: '#10b981' // Emerald
};

const SOURCE_LABELS: Record<HotspotSourceType, string> = {
  iot: 'IoT Sensor',
  satellite: 'Satellite MSI',
  drone: 'Drone Aerial',
  field_worker: 'Field Worker'
};

function createSourceMarker(source: HotspotSourceType, risk: RiskLevel, label: string, isChoking: boolean = false) {
  const color = SOURCE_COLORS[source] || '#06b6d4';
  const riskCol = riskMarkerColor(risk);
  const isHigh = risk === 'Critical' || risk === 'High';

  const pulseRing = isChoking || isHigh
    ? `<circle cx="20" cy="20" r="17" fill="${riskCol}" opacity="0.38" class="sensor-ping"/>`
    : `<circle cx="20" cy="20" r="14" fill="${color}" opacity="0.2"/>`;

  // Icons based on source
  let iconSvg = `<circle cx="20" cy="20" r="4.5" fill="${color}"/>`;
  if (source === 'iot') {
    iconSvg = `<path d="M16 20a4 4 0 0 1 8 0" stroke="${color}" stroke-width="2" fill="none"/><circle cx="20" cy="22" r="2.5" fill="${color}"/>`;
  } else if (source === 'drone') {
    iconSvg = `<circle cx="20" cy="20" r="3" fill="${color}"/><path d="M14 14l3 3m6 6l3 3m0-12l-3 3m-6 6l-3 3" stroke="${color}" stroke-width="1.8"/>`;
  } else if (source === 'satellite') {
    iconSvg = `<circle cx="20" cy="20" r="3" fill="${color}"/><ellipse cx="20" cy="20" rx="7" ry="3.5" fill="none" stroke="${color}" stroke-width="1.5" transform="rotate(-30 20 20)"/>`;
  } else if (source === 'field_worker') {
    iconSvg = `<circle cx="20" cy="18" r="2.5" fill="${color}"/><path d="M16 24c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" fill="${color}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
    ${pulseRing}
    <circle cx="20" cy="20" r="11" fill="#030a16" stroke="${color}" stroke-width="2.5" />
    ${iconSvg}
    <line x1="20" y1="31" x2="20" y2="46" stroke="${color}" stroke-width="2.5" stroke-dasharray="1,1"/>
    <text x="20" y="10" text-anchor="middle" fill="#ffffff" font-size="7.5" font-family="monospace" font-weight="900" style="text-shadow: 0 1px 3px black;">${label}</text>
  </svg>`;

  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [40, 50],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48],
  });
}

function createNumberedStopMarker(stopNumber: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="15" fill="#06b6d4" stroke="#ffffff" stroke-width="2"/>
    <text x="17" y="17" text-anchor="middle" dy=".35em" fill="#020617" font-size="12" font-weight="900">${stopNumber}</text>
  </svg>`;
  return L.divIcon({ className: '', html: svg, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17] });
}

function createDepotMarker() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
    <rect x="4" y="4" width="34" height="34" rx="8" fill="#040c18" stroke="#06b6d4" stroke-width="2.5"/>
    <text x="21" y="21" text-anchor="middle" dy=".35em" fill="#38bdf8" font-size="9" font-weight="900">DEPOT</text>
  </svg>`;
  return L.divIcon({ className: '', html: svg, iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -21] });
}

export default function HotspotMapPage() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routeStopMarkersRef = useRef<L.Marker[]>([]);

  const { roleConfig } = useRbac();
  const [searchParams] = useSearchParams();

  // Data states
  const [hotspots, setHotspots] = useState<UnifiedHotspot[]>([]);
  const [summary, setSummary] = useState<HotspotSummary | null>(null);
  const [boundaryGeoJson, setBoundaryGeoJson] = useState<any | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<UnifiedHotspot | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImageLightbox, setShowImageLightbox] = useState<boolean>(false);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [provenanceFilter, setProvenanceFilter] = useState<string>('all'); // all, Real, Simulated
  const [showBoundary, setShowBoundary] = useState<boolean>(true);

  // Dispatch Action State
  const [dispatching, setDispatching] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [hList, sum, bound] = await Promise.all([
        getHotspots({ limit: 300 }),
        getHotspotSummary(),
        getMumbaiBoundary()
      ]);
      setHotspots(hList);
      setSummary(sum);
      setBoundaryGeoJson(bound);

      const highlightId = searchParams.get('highlight') || searchParams.get('id') || searchParams.get('site');
      if (highlightId && hList.length > 0) {
        const hlLower = highlightId.toLowerCase();
        const matched = hList.find(h =>
          h.id.toLowerCase() === hlLower ||
          h.title?.toLowerCase().includes(hlLower) ||
          h.site_id?.toLowerCase() === hlLower ||
          (hlLower.includes('clust') && (h.title?.toLowerCase().includes(hlLower) || h.id.toLowerCase().includes(hlLower)))
        );
        if (matched) {
          setSelectedHotspot(matched);
        } else {
          setSelectedHotspot(hList[0]);
        }
      } else if (hList.length > 0) {
        setSelectedHotspot(hList[0]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load hotspot data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // When searchParams change or map finishes loading, fly to selected hotspot
  useEffect(() => {
    const highlightId = searchParams.get('highlight') || searchParams.get('id') || searchParams.get('site');
    if (highlightId && hotspots.length > 0) {
      const hlLower = highlightId.toLowerCase();
      const matched = hotspots.find(h =>
        h.id.toLowerCase() === hlLower ||
        h.title?.toLowerCase().includes(hlLower) ||
        h.site_id?.toLowerCase() === hlLower ||
        (hlLower.includes('clust') && (h.title?.toLowerCase().includes(hlLower) || h.id.toLowerCase().includes(hlLower)))
      );
      if (matched) {
        setSelectedHotspot(matched);
        if (matched.latitude && matched.longitude && mapRef.current) {
          mapRef.current.flyTo([matched.latitude, matched.longitude], 15, { animate: true, duration: 1.2 });
        }
      }
    }
  }, [searchParams, hotspots]);

  // Init Leaflet map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [19.076, 72.877],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: '&copy; Esri &copy; OpenStreetMap contributors',
    }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw Mumbai Boundary Polygon Overlay
  useEffect(() => {
    if (!mapRef.current || !boundaryGeoJson) return;

    if (boundaryLayerRef.current) {
      boundaryLayerRef.current.remove();
      boundaryLayerRef.current = null;
    }

    if (showBoundary) {
      const layer = L.geoJSON(boundaryGeoJson, {
        style: {
          color: '#06b6d4',
          weight: 2,
          dashArray: '5, 6',
          fillColor: '#0891b2',
          fillOpacity: 0.05,
        }
      }).addTo(mapRef.current);


      boundaryLayerRef.current = layer;
    }
  }, [boundaryGeoJson, showBoundary]);

  // Update Hotspot Markers on Map
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = hotspots.filter(h => {
      if (sourceFilter !== 'all' && h.source_type !== sourceFilter) return false;
      if (riskFilter !== 'all' && h.risk_category !== riskFilter) return false;
      if (statusFilter !== 'all' && h.cleanup_status !== statusFilter) return false;
      if (provenanceFilter !== 'all' && h.source_status !== provenanceFilter) return false;
      return h.latitude !== undefined && h.latitude !== null && h.longitude !== undefined && h.longitude !== null;
    });

    filtered.forEach(h => {
      if (h.latitude && h.longitude) {
        const isChoking = h.risk_category === 'Critical';
        const label = h.id.split('-')[1] || h.id.slice(-4);
        const marker = L.marker([h.latitude, h.longitude], {
          icon: createSourceMarker(h.source_type, h.risk_category, label, isChoking)
        });

        marker.on('click', () => setSelectedHotspot(h));
        marker.addTo(mapRef.current!);
        markersRef.current.push(marker);
      }
    });
  }, [hotspots, sourceFilter, riskFilter, statusFilter, provenanceFilter]);

  const handleDispatchCleanup = async (spotId: string) => {
    setDispatching(true);
    try {
      await dispatchCleanupForHotspot(spotId);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Dispatch failed');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Overview Top KPIs Bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-2xl bg-[#040c18] border border-cyan-500/20 shadow-md">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Mumbai Hotspots</span>
            <div className="text-xl font-black text-white font-mono mt-0.5">{summary.total_valid_hotspots}</div>
            <span className="text-[10px] text-emerald-400 font-semibold">BMC Territory Validated</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#040c18] border border-cyan-500/20 shadow-md">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">High / Critical Chokes</span>
            <div className="text-xl font-black text-rose-400 font-mono mt-0.5">
              {(summary.risk_breakdown?.Critical || 0) + (summary.risk_breakdown?.High || 0)}
            </div>
            <span className="text-[10px] text-rose-400">Immediate Action Req</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#040c18] border border-cyan-500/20 shadow-md">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">IoT Telemetry Nodes</span>
            <div className="text-xl font-black text-cyan-400 font-mono mt-0.5">
              {summary.source_breakdown?.iot || 0}
            </div>
            <span className="text-[10px] text-slate-400">Automated Creek Sensors</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#040c18] border border-cyan-500/20 shadow-md">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Drone Surveys</span>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
              {summary.source_breakdown?.drone || 0}
            </div>
            <span className="text-[10px] text-amber-400">Model A Aerial Flights</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#040c18] border border-cyan-500/20 shadow-md">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Satellite Slicks</span>
            <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
              {summary.source_breakdown?.satellite || 0}
            </div>
            <span className="text-[10px] text-purple-400">Model B Sentinel-2</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#040c18] border border-cyan-500/20 shadow-md">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Field Worker Reports</span>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              {summary.source_breakdown?.field_worker || 0}
            </div>
            <span className="text-[10px] text-emerald-400">Ground Inspections</span>
          </div>
        </div>
      )}

      {/* Main Map & Filter Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[580px]">
        {/* Left Side: Filter List & Hotspots List (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3 bg-[#040c18] border border-cyan-500/20 rounded-2xl p-3.5 overflow-hidden">
          {/* Filter Bar */}
          <div className="space-y-2 border-b border-cyan-500/10 pb-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Centralized Filters</span>
              </span>
              <button
                onClick={() => setShowBoundary(!showBoundary)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  showBoundary
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                Mumbai Boundary {showBoundary ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Source Filter Tabs */}
            <div className="grid grid-cols-5 gap-1 text-[10px] font-bold">
              {[
                { id: 'all', label: 'All' },
                { id: 'iot', label: 'IoT' },
                { id: 'satellite', label: 'Sat' },
                { id: 'drone', label: 'Drone' },
                { id: 'field_worker', label: 'Worker' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSourceFilter(tab.id)}
                  className={`py-1 rounded-lg border text-center transition-all ${
                    sourceFilter === tab.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-Filters: Risk & Provenance */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] focus:outline-none"
              >
                <option value="all">All Risk Levels</option>
                <option value="Critical">Critical Choke</option>
                <option value="High">High Risk</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <select
                value={provenanceFilter}
                onChange={(e) => setProvenanceFilter(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] focus:outline-none"
              >
                <option value="all">Real & Simulated</option>
                <option value="Real">Real Data Only</option>
                <option value="Simulated">Simulated Only</option>
              </select>
            </div>
          </div>

          {/* Hotspots Scroll List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="py-12 flex justify-center"><LoadingSpinner /></div>
            ) : hotspots.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">No hotspots matching filters</div>
            ) : (
              hotspots
                .filter(h => {
                  if (sourceFilter !== 'all' && h.source_type !== sourceFilter) return false;
                  if (riskFilter !== 'all' && h.risk_category !== riskFilter) return false;
                  if (provenanceFilter !== 'all' && h.source_status !== provenanceFilter) return false;
                  return true;
                })
                .map((spot) => {
                  const isSelected = selectedHotspot?.id === spot.id;
                  const isChoking = spot.risk_category === 'Critical';

                  return (
                    <div
                      key={spot.id}
                      onClick={() => setSelectedHotspot(spot)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-950/60'
                          : 'border-slate-800/80 bg-[#030914] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: SOURCE_COLORS[spot.source_type] }}
                          />
                          <Badge className="bg-slate-900 text-slate-300 text-[9px] border-slate-800">
                            {SOURCE_LABELS[spot.source_type]}
                          </Badge>
                          <Badge
                            className={`text-[9px] ${
                              spot.source_status === 'Real'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {spot.source_status}
                          </Badge>
                        </div>
                        <Badge className={riskBadgeColor(spot.risk_category)}>
                          {spot.risk_category}
                        </Badge>
                      </div>

                      <h4 className="text-xs font-bold text-white mt-1.5 line-clamp-1">{spot.title}</h4>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-cyan-400 font-semibold">{spot.id}</span>
                        <span className="text-rose-400 font-mono font-bold">
                          {spot.estimated_debris_kg ? `${spot.estimated_debris_kg} kg` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Right Side: Map Canvas & Bottom HUD Drawer (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3 h-full">
          {/* Map View */}
          <div className="relative flex-1 rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl bg-[#020617]">
            <div ref={containerRef} className="absolute inset-0" />

            {/* Quick Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-[#050f20]/90 backdrop-blur-md rounded-xl p-2.5 border border-cyan-500/30 text-[10px] text-slate-300 space-y-1 shadow-xl">
              <div className="font-bold text-white mb-1">Source Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>IoT Water Level Node</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Drone Aerial (Model A)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span>Sentinel-2 Debris (Model B)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Field Worker Ground Report</span>
              </div>
            </div>
          </div>

          {/* Selected Hotspot Detail HUD Drawer */}
          {selectedHotspot && (
            <div className="bg-[#050f20]/95 border border-cyan-500/40 rounded-2xl p-4 shadow-2xl animate-in fade-in duration-200 text-slate-100 shrink-0">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                      {selectedHotspot.id}
                    </span>
                    <Badge className={riskBadgeColor(selectedHotspot.risk_category)}>
                      {selectedHotspot.risk_category} Priority
                    </Badge>
                    <Badge className="bg-slate-900 border-slate-700 text-slate-300 text-xs">
                      {SOURCE_LABELS[selectedHotspot.source_type]}
                    </Badge>
                    <Badge
                      className={
                        selectedHotspot.boundary_status === 'VALID_MUMBAI'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px]'
                          : 'bg-rose-950 text-rose-300 border-rose-500/40 text-[10px]'
                      }
                    >
                      {selectedHotspot.boundary_status}
                    </Badge>
                    <Badge
                      className={
                        selectedHotspot.source_status === 'Real'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-amber-950 text-amber-300'
                      }
                    >
                      {selectedHotspot.source_status === 'Real' ? 'REAL EVIDENCE' : 'SIMULATED DATA'}
                    </Badge>
                  </div>
                  <h2 className="text-sm md:text-base font-extrabold text-white mt-1.5 font-heading">
                    {selectedHotspot.title}
                  </h2>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {selectedHotspot.cleanup_status === 'Task Assigned' ? (
                    <Link
                      to={`/cleanup?hotspot=${selectedHotspot.id}&site=${selectedHotspot.site_id || ''}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold text-xs h-8 transition-colors"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      View Cleanup Task
                    </Link>
                  ) : (
                    roleConfig.canApproveDispatch && (
                      <Button
                        size="sm"
                        onClick={() => handleDispatchCleanup(selectedHotspot.id)}
                        disabled={dispatching}
                        className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs h-8"
                      >
                        <Truck className="w-3.5 h-3.5 mr-1" />
                        {dispatching ? 'Dispatching...' : 'Dispatch Cleanup'}
                      </Button>
                    )
                  )}
                  <button
                    onClick={() => setSelectedHotspot(null)}
                    className="text-slate-400 hover:text-white text-xs p-1 rounded-lg hover:bg-slate-800"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Grid: Evidence Snapshot + Explainable Risk Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                {/* Evidence Thumbnail (3 cols) */}
                <div
                  className="md:col-span-3 rounded-xl overflow-hidden border border-slate-800 bg-black h-28 relative group cursor-pointer"
                  onClick={() => selectedHotspot.evidence_url && setShowImageLightbox(true)}
                  title="Click to view high-resolution photo"
                >
                  {selectedHotspot.evidence_url ? (
                    <>
                      <img
                        src={getImageUrl(selectedHotspot.evidence_url)}
                        alt={selectedHotspot.title || 'Hotspot Evidence'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'http://localhost:8000/api/static/sample_feeds/malad_marve_drone_survey.jpg';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-[11px] font-bold backdrop-blur-[1px]">
                        <Maximize2 className="w-3.5 h-3.5" /> Inspect Photo
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-[11px]">
                      No Image Evidence
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1.5 text-[9px] bg-black/70 px-1.5 py-0.5 rounded font-mono text-cyan-300">
                    {selectedHotspot.location_method}
                  </div>
                </div>

                {/* Explainable Risk Factors (6 cols) */}
                <div className="md:col-span-6 bg-[#030914] rounded-xl p-2.5 border border-cyan-950 space-y-1">
                  <div className="font-bold text-slate-300 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      Explainable Risk Score: {selectedHotspot.risk_score}/100
                    </span>
                    <span className="text-[10px] text-slate-400">Multi-Signal Evaluation</span>
                  </div>
                  <div className="text-[10px] text-slate-300 whitespace-pre-line leading-relaxed max-h-20 overflow-y-auto pr-1">
                    {selectedHotspot.risk_explanation || 'Baseline monitoring priority assigned.'}
                  </div>
                </div>

                {/* Key Metrics (3 cols) */}
                <div className="md:col-span-3 grid grid-cols-2 gap-1.5">
                  <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950 text-center">
                    <span className="text-[9px] text-slate-400 block">Debris Load</span>
                    <span className="font-black text-rose-400 text-sm font-mono">
                      {selectedHotspot.estimated_debris_kg ? `${selectedHotspot.estimated_debris_kg} kg` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950 text-center">
                    <span className="text-[9px] text-slate-400 block">Confidence</span>
                    <span className="font-black text-emerald-400 text-sm font-mono">
                      {((selectedHotspot.confidence_avg || 0.8) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950 text-center">
                    <span className="text-[9px] text-slate-400 block">Water Level</span>
                    <span className="font-black text-cyan-400 text-sm font-mono">
                      {selectedHotspot.water_level_m ? `${selectedHotspot.water_level_m}m` : '—'}
                    </span>
                  </div>
                  <div className="bg-[#030914] rounded-xl p-2 border border-cyan-950 text-center">
                    <span className="text-[9px] text-slate-400 block">Deduplicated</span>
                    <span className="font-black text-amber-400 text-sm font-mono">
                      × {selectedHotspot.associated_observations_count}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* High-Resolution Photo Lightbox Modal */}
      {showImageLightbox && selectedHotspot && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-[#030914] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-950 bg-[#040a14]">
              <div>
                <h3 className="font-bold text-white text-sm">{selectedHotspot.title}</h3>
                <p className="text-[11px] text-cyan-400">
                  {selectedHotspot.source_type.toUpperCase()} · Geotagged at [{selectedHotspot.latitude?.toFixed(4)}, {selectedHotspot.longitude?.toFixed(4)}]
                </p>
              </div>
              <button
                onClick={() => setShowImageLightbox(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 max-h-[75vh] flex items-center justify-center bg-black">
              <img
                src={getImageUrl(selectedHotspot.evidence_url)}
                alt="High-Res Evidence"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'http://localhost:8000/api/static/sample_feeds/malad_marve_drone_survey.jpg';
                }}
              />
            </div>
            <div className="px-4 py-2.5 bg-[#040a14] border-t border-cyan-950 flex items-center justify-between text-xs text-slate-400">
              <span>Risk: <strong className="text-rose-400">{selectedHotspot.risk_score}/100 ({selectedHotspot.risk_category})</strong></span>
              <a
                href={getImageUrl(selectedHotspot.evidence_url)}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                Open Original in New Tab <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
