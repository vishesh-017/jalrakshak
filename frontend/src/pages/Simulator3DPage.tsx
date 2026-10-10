import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useRbac } from '../context/RbacContext';
import { Badge } from '../components/ui/Badge';
import {
  MapPin, Crosshair, Radio, Split, Sparkles
} from 'lucide-react';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });

interface SensorNode {
  id: string;
  name: string;
  zone: string;
  riskScore: number;
  riskLevel: 'Critical' | 'High' | 'Moderate' | 'Low';
  lat: number;
  lng: number;
  sensorTypes: string[];
  waterDepth: number;
  plasticKg: number;
  status: 'Choking' | 'Warning' | 'Normal';
  cctvActive: boolean;
  sonarActive: boolean;
  barrierStatus: string;
}

const MUMBAI_SITES: SensorNode[] = [
  {
    id: 'MTH-01',
    name: 'Mahim Causeway Tidal Outlet',
    zone: 'Mithi River Basin',
    riskScore: 92,
    riskLevel: 'Critical',
    lat: 19.0435,
    lng: 72.8423,
    sensorTypes: ['Optical YOLOv8m CCTV', 'Ultrasonic Depth Sonar', 'Tidal Barrier Strain'],
    waterDepth: 4.4,
    plasticKg: 850,
    status: 'Choking',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Partially Blocked',
  },
  {
    id: 'MTH-02',
    name: 'Kurla BKC Nullah Confluence',
    zone: 'Mithi River Basin',
    riskScore: 88,
    riskLevel: 'Critical',
    lat: 19.0662,
    lng: 72.8715,
    sensorTypes: ['Optical YOLOv8m CCTV', 'Acoustic Doppler Velocity'],
    waterDepth: 3.8,
    plasticKg: 520,
    status: 'Choking',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Operational',
  },
  {
    id: 'MTH-03',
    name: 'Kalina Culvert & CST Road Sluice',
    zone: 'Mithi River Basin',
    riskScore: 68,
    riskLevel: 'High',
    lat: 19.0740,
    lng: 72.8611,
    sensorTypes: ['Optical CCTV', 'Water Level Radar'],
    waterDepth: 3.5,
    plasticKg: 460,
    status: 'Warning',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Operational',
  },
  {
    id: 'MTH-04',
    name: 'Powai Lake Spillway Outfall',
    zone: 'Mithi River Basin',
    riskScore: 32,
    riskLevel: 'Low',
    lat: 19.1215,
    lng: 72.9056,
    sensorTypes: ['Optical CCTV', 'Float Switch Sensor'],
    waterDepth: 2.9,
    plasticKg: 180,
    status: 'Normal',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Operational',
  },
  {
    id: 'MLD-01',
    name: 'Malad Marve Creek Mangrove Mouth',
    zone: 'Malad Creek Basin',
    riskScore: 92,
    riskLevel: 'Critical',
    lat: 19.1912,
    lng: 72.8124,
    sensorTypes: ['ReWater Aerial Drone Hub', 'Ultrasonic Sonar', 'Deflection Eco-Boom'],
    waterDepth: 4.2,
    plasticKg: 780,
    status: 'Choking',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Partially Blocked',
  },
  {
    id: 'MLD-02',
    name: 'Goregaon SV Road Storm Nullah',
    zone: 'Malad Creek Basin',
    riskScore: 65,
    riskLevel: 'High',
    lat: 19.1620,
    lng: 72.8410,
    sensorTypes: ['Optical CCTV', 'Turbidity Spectrometer'],
    waterDepth: 3.4,
    plasticKg: 410,
    status: 'Warning',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Operational',
  },
  {
    id: 'MLD-03',
    name: 'Oshiwara River Confluence',
    zone: 'Malad Creek Basin',
    riskScore: 52,
    riskLevel: 'Moderate',
    lat: 19.1485,
    lng: 72.8258,
    sensorTypes: ['Optical CCTV', 'Acoustic Sonar'],
    waterDepth: 2.8,
    plasticKg: 280,
    status: 'Normal',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Operational',
  },
  {
    id: 'TRM-01',
    name: 'Trombay Jetty Canal Outfall',
    zone: 'Trombay / Thane Creek Basin',
    riskScore: 75,
    riskLevel: 'High',
    lat: 19.0128,
    lng: 72.9150,
    sensorTypes: ['Optical CCTV', 'Ultrasonic Depth', 'Debris Trap Boom'],
    waterDepth: 3.9,
    plasticKg: 640,
    status: 'Warning',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Operational',
  },
  {
    id: 'TRM-02',
    name: 'Chembur Mahul Industrial Drain',
    zone: 'Trombay / Thane Creek Basin',
    riskScore: 64,
    riskLevel: 'High',
    lat: 19.0085,
    lng: 72.8942,
    sensorTypes: ['Optical CCTV', 'Subsurface Flowmeter'],
    waterDepth: 3.2,
    plasticKg: 390,
    status: 'Warning',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Operational',
  },
  {
    id: 'TRM-03',
    name: 'Vashi Creek Thane Basin Edge',
    zone: 'Trombay / Thane Creek Basin',
    riskScore: 35,
    riskLevel: 'Low',
    lat: 19.0650,
    lng: 72.9780,
    sensorTypes: ['Optical CCTV', 'Tidal Gauge Sensor'],
    waterDepth: 2.6,
    plasticKg: 190,
    status: 'Normal',
    cctvActive: true,
    sonarActive: true,
    barrierStatus: 'Operational',
  },
];

function createPinpointMapMarker(node: SensorNode, isSelected: boolean) {
  const isChoking = node.status === 'Choking';
  const color = isChoking ? '#f43f5e' : node.status === 'Warning' ? '#fb923c' : '#2dd4bf';

  const pulseRing = isChoking
    ? `<circle cx="18" cy="18" r="16" fill="#f43f5e" opacity="0.4" class="choke-pulse"/>`
    : `<circle cx="18" cy="18" r="14" fill="${color}" opacity="0.25"/>`;

  const borderStroke = isSelected ? '#ffffff' : color;
  const borderWidth = isSelected ? '3' : '2';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
    ${pulseRing}
    <circle cx="18" cy="20" r="11" fill="#040d1a" stroke="${borderStroke}" stroke-width="${borderWidth}"/>
    <circle cx="18" cy="20" r="5" fill="${color}"/>
    <circle cx="18" cy="7" r="3.5" fill="#38bdf8" stroke="#020617" stroke-width="1.5"/>
    <line x1="18" y1="31" x2="18" y2="44" stroke="${color}" stroke-width="2.5" stroke-dasharray="1,1"/>
    <text x="18" y="20" text-anchor="middle" dy=".35em" fill="#ffffff" font-size="7.5" font-family="monospace" font-weight="900">${node.id.split('-')[1]}</text>
  </svg>`;

  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -46],
  });
}

export default function Simulator3DPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mapMarkersRef = useRef<Record<string, L.Marker>>({});

  const { roleConfig } = useRbac();

  const [selectedSensor, setSelectedSensor] = useState<SensorNode | null>(MUMBAI_SITES[0]);
  const [sensorNodes] = useState<SensorNode[]>(MUMBAI_SITES);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');
  const tileLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.100, 72.875],
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
    });

    const tileGroup = L.layerGroup().addTo(map);
    tileLayerGroupRef.current = tileGroup;

    mapInstanceRef.current = map;

    sensorNodes.forEach(node => {
      const isSel = selectedSensor?.id === node.id;
      const marker = L.marker([node.lat, node.lng], {
        icon: createPinpointMapMarker(node, isSel),
      }).addTo(map);

      marker.on('click', () => {
        handleSelectSensor(node);
      });

      mapMarkersRef.current[node.id] = marker;
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerGroupRef.current = null;
    };
  }, []);

  // Update map tiles based on mapStyle
  useEffect(() => {
    if (!tileLayerGroupRef.current) return;
    tileLayerGroupRef.current.clearLayers();

    if (mapStyle === 'dark') {
      const base = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '&copy; Esri &copy; OpenStreetMap',
      });
      const ref = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
      });
      tileLayerGroupRef.current.addLayer(base);
      tileLayerGroupRef.current.addLayer(ref);
    } else {
      const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri, Maxar',
      });
      tileLayerGroupRef.current.addLayer(sat);
    }
  }, [mapStyle]);

  // Update map marker selections & pan when sensor changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    sensorNodes.forEach(node => {
      const m = mapMarkersRef.current[node.id];
      if (m) {
        const isSel = selectedSensor?.id === node.id;
        m.setIcon(createPinpointMapMarker(node, isSel));
      }
    });

    if (selectedSensor) {
      mapInstanceRef.current.panTo([selectedSensor.lat, selectedSensor.lng], { animate: true, duration: 0.8 });
    }
  }, [selectedSensor]);

  const handleSelectSensor = (node: SensorNode) => {
    setSelectedSensor(node);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([node.lat, node.lng], 14, { duration: 1.2 });
    }
  };

  const flyToZone = (zoneName: string) => {
    if (zoneName.includes('Mithi')) {
      mapInstanceRef.current?.flyTo([19.065, 72.860], 13);
    } else if (zoneName.includes('Malad')) {
      mapInstanceRef.current?.flyTo([19.170, 72.825], 13);
    } else if (zoneName.includes('Trombay')) {
      mapInstanceRef.current?.flyTo([19.030, 72.925], 13);
    } else {
      mapInstanceRef.current?.flyTo([19.100, 72.875], 11);
    }
  };

  return (
    <div className="space-y-4 text-slate-100">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400">
              MUMBAI WATERWAYS SENSOR NETWORK · 10 ACTIVE STATIONS
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-heading mt-1 flex items-center gap-2.5">
            Geospatial Pinpoint Map
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Live GIS satellite and GPS coordinates of autonomous sensors
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-3 py-1 font-bold animate-pulse">
            2 CRITICAL CHOKES ACTIVE
          </Badge>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#020612] shadow-2xl h-[660px]">
        {/* Leaflet Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Pinpoint Map Header Banner */}
        <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-none flex items-center justify-between">
          <div className="pointer-events-auto bg-[#040d1a]/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-cyan-500/40 text-xs shadow-2xl flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <div>
              <p className="font-bold text-white text-xs">Mumbai GPS Pinpoint Map</p>
              <p className="text-[10px] text-cyan-300 font-mono">10 Calibrated IoT Outfalls</p>
            </div>
          </div>

          {/* Zone Jumps */}
          <div className="pointer-events-auto flex items-center bg-[#050f20]/90 backdrop-blur-md rounded-xl p-1 border border-cyan-500/30 text-xs shadow-xl ml-4">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider px-2 hidden sm:inline">
              Fly Zone:
            </span>
            {[
              { label: 'All Mumbai', zone: 'Overview' },
              { label: 'Mithi (Zone 1)', zone: 'Mithi' },
              { label: 'Malad (Zone 2)', zone: 'Malad' },
              { label: 'Trombay (Zone 3)', zone: 'Trombay' },
            ].map(z => (
              <button
                key={z.zone}
                onClick={() => flyToZone(z.zone)}
                className="px-2.5 py-1 rounded-lg font-bold text-slate-200 hover:text-white hover:bg-cyan-500/20 transition-all text-[11px]"
              >
                {z.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="pointer-events-auto bg-[#040d1a]/95 backdrop-blur-md p-1 rounded-xl border border-cyan-500/40 text-[10px] flex items-center gap-1 shadow-2xl">
              <button
                onClick={() => setMapStyle('dark')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  mapStyle === 'dark'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Dark Canvas
              </button>
              <button
                onClick={() => setMapStyle('satellite')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  mapStyle === 'satellite'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Satellite
              </button>
            </div>

            <div className="pointer-events-auto bg-[#040d1a]/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-cyan-500/40 text-[10px] text-slate-200 hidden sm:flex items-center gap-2 shadow-2xl">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Choke</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Warning</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Normal</span>
            </div>
          </div>
        </div>

        {/* Quick Click Map Site Overlay (Selected Node Details) */}
        {selectedSensor && (
          <div className="absolute bottom-3 left-3 right-3 lg:left-[50%] lg:w-[400px] lg:-translate-x-[50%] z-[1000] pointer-events-auto bg-[#040d1a]/95 backdrop-blur-xl p-3.5 rounded-2xl border border-cyan-500/40 text-white shadow-2xl space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-[10px] text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                    {selectedSensor.id}
                  </span>
                  <Badge className={
                    selectedSensor.status === 'Choking'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                      : selectedSensor.status === 'Warning'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  }>
                    {selectedSensor.status === 'Choking' ? '🚨 CHOKE HOTSPOT' : selectedSensor.status}
                  </Badge>
                </div>
                <h4 className="font-bold text-sm text-white mt-1">{selectedSensor.name}</h4>
                <p className="text-[11px] text-cyan-300/80 font-mono">
                  📍 {selectedSensor.lat.toFixed(4)}° N, {selectedSensor.lng.toFixed(4)}° E · {selectedSensor.zone}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Choke Risk</span>
                <span className="font-mono font-black text-lg text-rose-400 leading-none">
                  {selectedSensor.riskScore} / 100
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-cyan-950/70 text-xs">
              <div className="bg-[#020612] p-1.5 rounded-xl border border-cyan-950">
                <span className="text-[9.5px] text-slate-400 block">Water Depth</span>
                <span className="font-mono font-bold text-cyan-300 text-xs">{selectedSensor.waterDepth} m</span>
              </div>
              <div className="bg-[#020612] p-1.5 rounded-xl border border-cyan-950">
                <span className="text-[9.5px] text-slate-400 block">Trapped Debris</span>
                <span className="font-mono font-bold text-amber-400 text-xs">~{selectedSensor.plasticKg} kg</span>
              </div>
              <div className="bg-[#020612] p-1.5 rounded-xl border border-cyan-950">
                <span className="text-[9.5px] text-slate-400 block">Barrier Status</span>
                <span className="font-bold text-slate-200 text-xs truncate block">{selectedSensor.barrierStatus}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ALL 10 PINPOINT STATIONS MATRIX (Interactive Bar) */}
      <div className="bg-[#050f20]/90 border border-cyan-500/30 rounded-2xl p-4 shadow-2xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-cyan-950/70">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-white font-heading">
              All 10 Monitored Stations · Live Telemetry & GPS Pinpoints
            </span>
          </div>
          <span className="text-[11px] text-cyan-400 font-mono">
            Click any station to focus map pinpoint
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {sensorNodes.map(node => {
            const isSelected = selectedSensor?.id === node.id;
            const isChoking = node.status === 'Choking';

            return (
              <button
                key={node.id}
                onClick={() => handleSelectSensor(node)}
                className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                  isSelected
                    ? 'bg-cyan-950/80 border-cyan-400 shadow-lg shadow-cyan-950/60 scale-[1.02]'
                    : 'bg-[#030914] border-cyan-950/70 hover:border-cyan-500/40 hover:bg-[#071326]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[10px] text-cyan-300 bg-cyan-950/90 px-1.5 py-0.5 rounded border border-cyan-500/30">
                    {node.id}
                  </span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase border ${
                    isChoking
                      ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                      : node.status === 'Warning'
                      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                  }`}>
                    {node.status}
                  </span>
                </div>

                <p className="font-bold text-white text-xs mt-1.5 truncate">{node.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{node.zone}</p>

                <div className="mt-2 flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-cyan-950/60">
                  <span className="text-slate-400">{node.lat.toFixed(3)}°N, {node.lng.toFixed(3)}°E</span>
                  <span className={isChoking ? 'text-rose-400 font-bold' : 'text-cyan-300 font-bold'}>
                    {node.riskScore}/100
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
