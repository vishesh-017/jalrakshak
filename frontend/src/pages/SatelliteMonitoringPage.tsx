import { useState, useEffect } from 'react';
import { getSatelliteScenes, analyzeSampleSatelliteScene, analyzeSatelliteUpload } from '../lib/api';
import type { SatelliteScene } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import {
  Orbit,
  Layers,
  Sparkles,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  Maximize2,
  Calendar,
  Compass,
  FileCheck2,
  Waves
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SatelliteMonitoringPage() {
  const [scenes, setScenes] = useState<SatelliteScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<SatelliteScene | null>(null);
  const [loadingScenes, setLoadingScenes] = useState(true);

  // Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Custom Upload Tab
  const [tab, setTab] = useState<'scenes' | 'upload'>('scenes');
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customBounds, setCustomBounds] = useState({
    min_lat: 19.02,
    max_lat: 19.07,
    min_lon: 72.82,
    max_lon: 72.87,
  });

  useEffect(() => {
    async function load() {
      try {
        const sc = await getSatelliteScenes();
        setScenes(sc);
        if (sc.length > 0) setSelectedScene(sc[0]);
      } catch (err: any) {
        setError(err.message || 'Failed to load satellite scenes');
      } finally {
        setLoadingScenes(false);
      }
    }
    load();
  }, []);

  const handleAnalyzeScene = async () => {
    if (!selectedScene) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const res = await analyzeSampleSatelliteScene(selectedScene.id, 'Real');
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Satellite spectral inference failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCustomUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFile) {
      setError('Please select a Sentinel-2 raster chip to upload.');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('file', customFile);
      fd.append('scene_id', 'S2-UPLOAD-' + Date.now().toString().slice(-4));
      fd.append('min_lat', customBounds.min_lat.toString());
      fd.append('max_lat', customBounds.max_lat.toString());
      fd.append('min_lon', customBounds.min_lon.toString());
      fd.append('max_lon', customBounds.max_lon.toString());
      fd.append('source_status', 'Real');

      const res = await analyzeSatelliteUpload(fd);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Raster analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Title & Context Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Orbit className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Satellite Marine Debris Analysis</h1>
            <Badge className="bg-purple-950/60 text-purple-300 border-purple-500/40">Model B — Sentinel-2 MSI</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Multi-spectral floating debris analysis calibrated on MARIDA benchmark (Daniel Tyukov / mdebris pipeline). Extracts FDI & NDVI spectral anomalies across Mumbai coastal waters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-slate-900 border-slate-700 text-slate-300 text-xs">
            ESA Sentinel-2 MSI • 10m Ground Resolution
          </Badge>
          <Link to="/map">
            <Button size="sm" variant="outline" className="text-xs border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/50">
              Hotspots Map
              <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Resolution & Ground Truth Limitation Notice */}
      <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3 text-xs text-purple-200">
        <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm text-purple-300">Satellite Optical Detection Resolution Limitation</div>
          <p className="text-purple-200/80 text-[11px] mt-1 leading-relaxed">
            Sentinel-2 MSI has a 10m spatial resolution. It can reliably detect <strong>macroscopic floating debris slicks and accumulation mats &gt;50 m²</strong> using the Floating Debris Index (FDI). It does <em>not</em> resolve individual plastic bottles or single plastic bags. Detections are classified as <strong>Candidate Marine Debris Regions</strong> and georeferenced to the Mumbai municipal boundary.
          </p>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Tab Switcher */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setTab('scenes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'scenes'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Registered Mumbai Sentinel-2 Passes
        </button>
        <button
          onClick={() => setTab('upload')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'upload'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Upload Custom Georeferenced Scene Chip
        </button>
      </div>

      {/* SCENE SELECTION MODE */}
      {tab === 'scenes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Scenes Catalog (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="bg-[#040c18] border-cyan-500/20">
              <CardHeader className="pb-3 border-b border-cyan-500/10">
                <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Available Satellite Scenes</span>
                  <Badge className="bg-purple-950/60 text-purple-300 border-purple-500/30 text-[10px]">
                    Copernicus S2
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {loadingScenes ? (
                  <div className="py-8 flex justify-center"><LoadingSpinner /></div>
                ) : (
                  scenes.map((sc) => (
                    <div
                      key={sc.id}
                      onClick={() => { setSelectedScene(sc); setResult(null); }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedScene?.id === sc.id
                          ? 'border-purple-500 bg-purple-950/40 shadow-lg shadow-purple-950/40'
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{sc.name}</span>
                        <Badge className="bg-slate-800 text-slate-300 text-[9px]">{sc.resolution_m}m/px</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">{sc.id}</p>
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          {sc.creek_target}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-purple-400" />
                          {sc.acquisition_date.split('T')[0]}
                        </span>
                      </div>
                    </div>
                  ))
                )}

                {selectedScene && (
                  <div className="pt-2">
                    <Button
                      onClick={handleAnalyzeScene}
                      disabled={analyzing}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-purple-600/20"
                    >
                      {analyzing ? (
                        <div className="flex items-center gap-2">
                          <LoadingSpinner size="sm" />
                          <span>Computing Spectral FDI & MARIDA Model B...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          <span>Execute Model B Marine Debris Pipeline</span>
                        </div>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Analysis Results & Spectral Anomaly Map (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {result ? (
              <Card className="bg-[#040c18] border-purple-500/30 shadow-xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-purple-500/20 flex flex-row items-center justify-between bg-purple-950/20">
                  <div>
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <Orbit className="w-4 h-4 text-purple-400" />
                      <span>Model B Sentinel-2 Spectral Output</span>
                    </CardTitle>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      Target: {result.creek_target} • Provider: {result.provider}
                    </p>
                  </div>
                  <Badge className="bg-purple-950 text-purple-300 border-purple-500/40">
                    {result.metrics?.in_boundary_mumbai_regions} Mumbai Detections
                  </Badge>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 text-xs">
                  {/* Imagery Preview */}
                  <div className="rounded-xl overflow-hidden border border-purple-500/30 bg-black">
                    <div className="px-3 py-1.5 bg-purple-950/80 text-[10px] font-semibold text-purple-300 flex justify-between">
                      <span>Spectral FDI Classification Mask Preview</span>
                      <span>{result.metrics?.total_debris_area_sqm} m² Total Slick Area</span>
                    </div>
                    <img src={result.annotated_image_url} alt="Spectral Mask" className="w-full h-64 object-cover" />
                  </div>

                  {/* Spectral Metric Counters */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Candidate Regions</div>
                      <div className="text-xl font-black text-purple-400 mt-1 font-mono">
                        {result.metrics?.total_candidate_regions}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Debris Slick Area</div>
                      <div className="text-xl font-black text-cyan-400 mt-1 font-mono">
                        {result.metrics?.total_debris_area_sqm} m²
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Hyacinth / Algae</div>
                      <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
                        {result.metrics?.vegetation_pixels} px
                      </div>
                    </div>
                  </div>

                  {/* Candidate Regions List */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-2">Georeferenced Candidate Debris Clusters</h4>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {result.candidate_regions?.map((reg: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200">{reg.cluster_id}</span>
                              <Badge className="bg-purple-950 text-purple-300 text-[10px]">
                                {reg.classification}
                              </Badge>
                              <Badge className="bg-emerald-950 text-emerald-300 text-[10px]">
                                {reg.boundary_status}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-1">
                              Coordinates: {reg.latitude.toFixed(4)}°N, {reg.longitude.toFixed(4)}°E • Area: {reg.estimated_slick_area_sqm} m²
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Confidence</span>
                            <span className="font-mono font-bold text-purple-300">{(reg.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hotspot Ingestion Notice */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-[#170a2c] to-[#200d3d] border border-purple-500/30 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">
                        {result.ingested_hotspot_ids?.length || 0} Hotspots Synchronized to Live Dashboard
                      </div>
                      <div className="text-[11px] text-purple-200/80 mt-0.5">
                        Detections mapped to BMC boundary and merged into unified GIS map.
                      </div>
                    </div>
                    <Link to="/map">
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs">
                        View On Map
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-[#040c18]/60 border border-slate-800 p-8 text-center text-xs text-slate-400 h-[480px] flex items-center justify-center">
                <div className="max-w-md space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center">
                    <Orbit className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-white">Model B Satellite Marine Debris Analysis</h3>
                  <p className="text-xs text-slate-400">
                    Select a Sentinel-2 pass on the left and click "Execute Model B Marine Debris Pipeline" to calculate multi-spectral indices (FDI, NDVI, NDWI, PI) and isolate floating debris slicks.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* UPLOAD CUSTOM CHIP MODE */}
      {tab === 'upload' && (
        <Card className="bg-[#040c18] border-cyan-500/20">
          <CardHeader className="border-b border-cyan-500/10">
            <CardTitle className="text-sm font-bold text-white">
              Upload Georeferenced Sentinel-2 / Planet Raster Chip
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 max-w-xl">
            <form onSubmit={handleCustomUpload} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Satellite Raster Chip (GeoTIFF / PNG / JPG)</label>
                <input
                  type="file"
                  accept="image/*,.tif,.tiff"
                  onChange={(e) => setCustomFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:font-semibold cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min Latitude (South)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={customBounds.min_lat}
                    onChange={(e) => setCustomBounds({ ...customBounds, min_lat: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max Latitude (North)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={customBounds.max_lat}
                    onChange={(e) => setCustomBounds({ ...customBounds, max_lat: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min Longitude (West)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={customBounds.min_lon}
                    onChange={(e) => setCustomBounds({ ...customBounds, min_lon: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max Longitude (East)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={customBounds.max_lon}
                    onChange={(e) => setCustomBounds({ ...customBounds, max_lon: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={analyzing || !customFile}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl"
              >
                {analyzing ? 'Analyzing Multi-Spectral Chip...' : 'Run Model B Multi-Spectral Analysis'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
