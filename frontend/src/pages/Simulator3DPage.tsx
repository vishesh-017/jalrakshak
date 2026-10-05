import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import L from 'leaflet';
import { getSites } from '../lib/api';
import { useRbac } from '../context/RbacContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Compass, Play, RotateCcw, Eye, Ship, Layers,
  Sparkles, CheckCircle2, ChevronRight, Info, ShieldCheck, MapPin,
  Camera, Radio, AlertOctagon, Activity, Video, Gauge, Zap,
  Maximize2, Minimize2, Split, Navigation, Crosshair
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
  coords3D: [number, number, number];
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

const MUMBAI_SITES_3D: SensorNode[] = [
  {
    id: 'MTH-01',
    name: 'Mahim Causeway Tidal Outlet',
    zone: 'Mithi River Basin',
    riskScore: 92,
    riskLevel: 'Critical',
    coords3D: [-6, 0.4, 4],
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
    coords3D: [-2, 0.4, 0],
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
    coords3D: [-4, 0.4, 2],
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
    coords3D: [1, 0.4, -3],
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
    coords3D: [-12, 0.4, -8],
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
    coords3D: [-10, 0.4, -12],
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
    coords3D: [-8, 0.4, -5],
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
    coords3D: [8, 0.4, 6],
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
    coords3D: [12, 0.4, 9],
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
    coords3D: [14, 0.4, 3],
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
  const mountRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mapMarkersRef = useRef<Record<string, L.Marker>>({});

  const { roleConfig } = useRbac();

  // View Layout Modes: 'dual' (Default: 3D + Pinpoint Map side-by-side), '3d' (Full 3D), 'map' (Full GIS Map)
  const [viewMode, setViewMode] = useState<'dual' | '3d' | 'map'>('dual');
  const [selectedSensor, setSelectedSensor] = useState<SensorNode | null>(MUMBAI_SITES_3D[0]);
  const [sensorNodes] = useState<SensorNode[]>(MUMBAI_SITES_3D);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');
  const tileLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // 3D Scene Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const skimmerMeshRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const beaconMeshRefs = useRef<THREE.Mesh[]>([]);

  // 1. Initialize Leaflet Pinpoint Map
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

    // Add markers for all 10 sites
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

  // Update map tiles based on mapStyle (Zero watermark, professional GIS basemaps)
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

  // Handle resizing Leaflet when viewMode changes
  useEffect(() => {
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
      if (rendererRef.current && cameraRef.current && mountRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    }, 200);
  }, [viewMode]);

  // 2. Initialize Three.js 3D Digital Twin
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x020612);
    scene.fog = new THREE.FogExp2(0x020612, 0.018);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.set(0, 32, 38);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 8;
    controls.maxDistance = 120;
    controls.target.set(0, 1, 0);

    // Ambient & Tactical Directional Lighting
    const ambientLight = new THREE.AmbientLight(0x0c2540, 1.8);
    scene.add(ambientLight);

    const cyanSpot = new THREE.DirectionalLight(0x38bdf8, 2.8);
    cyanSpot.position.set(25, 45, 20);
    scene.add(cyanSpot);

    const tealFill = new THREE.PointLight(0x0d9488, 3.5, 90);
    tealFill.position.set(-20, 15, -15);
    scene.add(tealFill);

    // Glowing Deep Water Plane
    const waterGeo = new THREE.PlaneGeometry(160, 160, 48, 48);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x02162e,
      roughness: 0.1,
      metalness: 0.9,
      wireframe: false,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0;
    scene.add(water);

    // Grid Floor Overlay
    const gridHelper = new THREE.GridHelper(160, 32, 0x0369a1, 0x072847);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // Embankments / Coastline Blocks
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x06111f, roughness: 0.8 });
    const island1 = new THREE.Mesh(new THREE.BoxGeometry(40, 2.5, 12), islandMat);
    island1.position.set(-18, 1, 14);
    const island2 = new THREE.Mesh(new THREE.BoxGeometry(32, 2.5, 18), islandMat);
    island2.position.set(24, 1, 12);
    const island3 = new THREE.Mesh(new THREE.BoxGeometry(26, 2.5, 22), islandMat);
    island3.position.set(-12, 1, -22);
    scene.add(island1, island2, island3);

    // Construct 3D Sensor Towers
    beaconMeshRefs.current = [];
    sensorNodes.forEach(node => {
      const pylonGroup = createSensorStation3D(node);
      scene.add(pylonGroup);
    });

    // 1,200 Dynamic Leaking Plastic Particles Flow
    const particleCount = 1200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 60;
      particlePos[i * 3 + 1] = 0.15 + Math.random() * 0.2;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      particleSpeeds[i] = 0.04 + Math.random() * 0.08;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xf43f5e,
      size: 0.42,
      transparent: true,
      opacity: 0.85,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particlesRef.current = particles;
    scene.add(particles);

    // Autonomous Skimmer Catamaran Vessel
    const skimmer = createSkimmerCatamaran();
    skimmerMeshRef.current = skimmer;
    skimmer.position.set(-6, 0.4, 4);
    scene.add(skimmer);

    // Click Detection on 3D Objects
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let parent: THREE.Object3D | null = hit.object;
        while (parent && !parent.userData.nodeId) {
          parent = parent.parent;
        }
        if (parent && parent.userData.nodeId) {
          const match = sensorNodes.find(n => n.id === parent?.userData.nodeId);
          if (match) {
            handleSelectSensor(match);
            break;
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Bobbing Skimmer Vessel Physics
      if (skimmerMeshRef.current) {
        skimmerMeshRef.current.position.y = 0.4 + Math.sin(elapsed * 2.2) * 0.08;
        skimmerMeshRef.current.rotation.z = Math.sin(elapsed * 1.8) * 0.03;
        skimmerMeshRef.current.rotation.x = Math.cos(elapsed * 1.5) * 0.02;
      }

      // Pulsing Choke Beacons
      beaconMeshRefs.current.forEach(beacon => {
        const p = beacon.userData.phase || 0;
        const scale = 1.0 + Math.sin(elapsed * 3.5 + p) * 0.35;
        beacon.scale.set(scale, 1, scale);
      });

      // Plastic Particles Flow Dynamics
      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3 + 2] += particleSpeeds[i];
          positions[i * 3] += Math.sin(elapsed + i) * 0.02;
          if (positions[i * 3 + 2] > 32) {
            positions[i * 3 + 2] = -32;
            positions[i * 3] = (Math.random() - 0.5) * 50;
          }
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  function createSensorStation3D(node: SensorNode): THREE.Group {
    const group = new THREE.Group();
    group.position.set(...node.coords3D);
    group.userData = { nodeId: node.id };

    const isCritical = node.status === 'Choking';
    const isWarning = node.status === 'Warning';
    const beaconColor = isCritical ? 0xf43f5e : isWarning ? 0xf97316 : 0x06b6d4;

    // 1. Steel Sensor Mast Tower
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.28, 4.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 2.1;
    group.add(pole);

    // 2. Optical CCTV Frustum (Cyan cone of vision)
    const coneGeo = new THREE.ConeGeometry(2.2, 5.0, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 3.8, 1.8);
    cone.rotation.x = Math.PI / 4;
    group.add(cone);

    // 3. Choking Volumetric Beacon
    const beaconHeight = isCritical ? 10 : isWarning ? 6.5 : 4;
    const beaconGeo = new THREE.CylinderGeometry(0.2, 0.45, beaconHeight, 12, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: beaconColor,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = beaconHeight / 2;
    beacon.userData = { isBeacon: true, phase: Math.random() * Math.PI, nodeId: node.id };
    group.add(beacon);
    beaconMeshRefs.current.push(beacon);

    // 4. Ground Telemetry Radar Ring
    const ringGeo = new THREE.RingGeometry(1.2, 1.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: beaconColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    return group;
  }

  function createSkimmerCatamaran(): THREE.Group {
    const vessel = new THREE.Group();
    const hullGeo = new THREE.BoxGeometry(1.0, 0.6, 5.0);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.6 });
    const leftHull = new THREE.Mesh(hullGeo, hullMat);
    leftHull.position.x = -1.2;
    const rightHull = new THREE.Mesh(hullGeo, hullMat);
    rightHull.position.x = 1.2;

    const deckGeo = new THREE.BoxGeometry(3.2, 0.2, 4.0);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 0.3, 0);

    const cabinGeo = new THREE.BoxGeometry(2.0, 1.0, 1.5);
    const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
    cabin.position.set(0, 0.8, -0.8);

    vessel.add(leftHull, rightHull, deck, cabin);
    vessel.scale.set(0.7, 0.7, 0.7);
    return vessel;
  }

  // Focus Station: Moves both 3D Camera and Map Pinpoint
  const handleSelectSensor = (node: SensorNode) => {
    setSelectedSensor(node);

    // Focus 3D Camera
    if (cameraRef.current && controlsRef.current) {
      const [x, y, z] = node.coords3D;
      cameraRef.current.position.set(x + 4, 8, z + 9);
      controlsRef.current.target.set(x, 1, z);
    }

    // Focus Map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([node.lat, node.lng], 14, { duration: 1.2 });
    }
  };

  const flyToZone = (zoneName: string) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (zoneName.includes('Mithi')) {
      cam.position.set(-5, 14, 16);
      ctrl.target.set(-4, 1, 2);
      mapInstanceRef.current?.flyTo([19.065, 72.860], 13);
    } else if (zoneName.includes('Malad')) {
      cam.position.set(-11, 14, -4);
      ctrl.target.set(-10, 1, -8);
      mapInstanceRef.current?.flyTo([19.170, 72.825], 13);
    } else if (zoneName.includes('Trombay')) {
      cam.position.set(10, 14, 14);
      ctrl.target.set(9, 1, 6);
      mapInstanceRef.current?.flyTo([19.030, 72.925], 13);
    } else {
      cam.position.set(0, 32, 38);
      ctrl.target.set(0, 1, 0);
      mapInstanceRef.current?.flyTo([19.100, 72.875], 11);
    }
  };

  return (
    <div className="space-y-4 text-slate-100">
      {/* High-Tech Dark Command Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400">
              MUMBAI WATERWAYS SENSOR DIGITAL TWIN · 10 ACTIVE STATIONS
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-heading mt-1 flex items-center gap-2.5">
            3D Sensor Network & Geospatial Pinpoint Map
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Dual synchronized perspective: 3D hydrodynamic particle flow simulator alongside live GIS satellite GPS coordinates
          </p>
        </div>

        {/* View Layout Controls & RBAC Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Switcher */}
          <div className="bg-[#050f20] border border-cyan-500/40 rounded-xl p-1 flex items-center gap-1 shadow-lg">
            <button
              onClick={() => setViewMode('dual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'dual'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Dual 3D + Pinpoint Map</span>
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === '3d'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full 3D Twin</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'map'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>GIS Pinpoint Map</span>
            </button>
          </div>

          <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-3 py-1 font-bold animate-pulse">
            2 CRITICAL CHOKES ACTIVE
          </Badge>
        </div>
      </div>

      {/* Main Dual / Full Viewport Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT PANEL: 3D Three.js Digital Twin */}
        <div className={`transition-all duration-300 relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#020612] shadow-2xl ${
          viewMode === 'dual' ? 'lg:col-span-7 h-[580px]' : viewMode === '3d' ? 'lg:col-span-12 h-[660px]' : 'hidden'
        }`}>
          {/* Three.js Canvas */}
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Top HUD: Zone Jumps */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto flex items-center bg-[#050f20]/90 backdrop-blur-md rounded-xl p-1 border border-cyan-500/30 text-xs shadow-xl">
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

            <div className="pointer-events-auto bg-[#050f20]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/30 text-xs flex items-center gap-3 shadow-xl">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-bold text-rose-300">2 Critical Chokes</span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-[10px] font-mono font-bold text-cyan-300">10 / 10 Towers Online</span>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 pointer-events-none bg-[#050f20]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/20 text-[10px] text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Click any 3D sensor tower to inspect live telemetry</span>
          </div>
        </div>

        {/* RIGHT PANEL: Live Geospatial Pinpoint Map */}
        <div className={`transition-all duration-300 relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#020612] shadow-2xl ${
          viewMode === 'dual' ? 'lg:col-span-5 h-[580px]' : viewMode === 'map' ? 'lg:col-span-12 h-[660px]' : 'hidden'
        }`}>
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
            <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-auto bg-[#040d1a]/95 backdrop-blur-xl p-3.5 rounded-2xl border border-cyan-500/40 text-white shadow-2xl space-y-2">
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
            Click any station to focus 3D camera & map pinpoint
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
