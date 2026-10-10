import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getSampleFeeds, analyzeSample, analyzeUpload, getDetections, getSites, getImageUrl } from '../lib/api';
import type { PlasticDetection, SampleFeed, MonitoringSite } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/ui/States';
import { sourceBadge, fmtDateTime, fmt } from '../lib/utils';
import {
  Scan,
  Camera,
  Cpu,
  Sliders,
  UploadCloud,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Activity,
  Maximize2,
  Waves
} from 'lucide-react';

const CLASS_COLORS: Record<string, string> = {
  PLASTIC_BOTTLE: '#38bdf8',
  PLASTIC_BAG: '#fb923c',
  OTHER_PLASTIC_WASTE: '#2dd4bf',
  STYROFOAM_FRAGMENT: '#facc15',
};

function SeverityBadge({ score }: { score: number }) {
  if (score >= 0.9) return <Badge className="bg-rose-950 text-rose-300 border border-rose-500/50 font-bold">Critical Choke</Badge>;
  if (score >= 0.5) return <Badge className="bg-orange-950 text-orange-300 border border-orange-500/50 font-bold">High Density</Badge>;
  if (score >= 0.2) return <Badge className="bg-amber-950 text-amber-300 border border-amber-500/50 font-bold">Moderate Debris</Badge>;
  return <Badge className="bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold">Clear / Low</Badge>;
}

export default function DetectionPage() {
  const [samples, setSamples] = useState<SampleFeed[]>([]);
  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [history, setHistory] = useState<PlasticDetection[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<SampleFeed | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [confidence, setConfidence] = useState(0.10);
  const [modelType, setModelType] = useState('yolov8m');
  const [tab, setTab] = useState<'sample' | 'upload'>('sample');
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    setFetchLoading(true);
    try {
      const [s, si, h] = await Promise.all([getSampleFeeds(), getSites(), getDetections(undefined, 20)]);
      setSamples(s);
      setSites(si);
      setHistory(h);
      if (s.length > 0) setSelectedSample(s[0]);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setFetchLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  async function runSampleAnalysis() {
    if (!selectedSample) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await analyzeSample(selectedSample.filename, selectedSiteId || selectedSample.site_id, confidence, modelType);
      setResult(r);
      setHistory(prev => [{ ...r, id: r.detection_id, timestamp: new Date().toISOString(), source_status: 'Simulated', image_path: r.original_image_url } as PlasticDetection, ...prev].slice(0, 20));
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function runUploadAnalysis(file: File) {
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await analyzeUpload(file, selectedSiteId, confidence, modelType);
      setResult(r);
      setHistory(prev => [{ ...r, id: r.detection_id, timestamp: new Date().toISOString(), source_status: 'Real', image_path: r.annotated_image_url } as PlasticDetection, ...prev].slice(0, 20));
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  const metrics = result?.metrics as Record<string, number> | undefined;
  const severity = metrics ? metrics.total_objects_detected / 25 : 0;

  if (fetchLoading) return <LoadingSpinner text="Loading detection studio..." />;

  return (
    <div className="space-y-5 text-slate-100">
      {/* Studio Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
              <Scan className="w-5 h-5 text-cyan-400" />
              AI Creek Debris Detection Studio
            </h1>
            <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">YOLOv8 MEDIUM + OPENCV</Badge>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Automated computer vision detection of visible plastic accumulation in creek outfalls and trash booms
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            STRONG MODEL (YOLOv8m) ACTIVE
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Feed Selection & Detection Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Model Specification Card */}
          <div className="bg-[#050f20]/95 rounded-2xl p-4 space-y-2 border-l-4 border-l-cyan-400 border border-cyan-500/20 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Active Model Pipeline
              </span>
              <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                yolov8m-marine
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Medium YOLOv8 model with marine spectral filter and aspect-ratio bounds to eliminate false positives on water ripples.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['PLASTIC_BOTTLE', 'PLASTIC_BAG', 'STYROFOAM', 'OTHER_WASTE'].map(tag => (
                <span key={tag} className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-[#030914] text-cyan-300 font-mono border border-cyan-950">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Input Source & Controls Card */}
          <div className="bg-[#050f20]/95 rounded-2xl p-4 space-y-4 border border-cyan-500/20 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-950/70">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Surveillance Source
              </span>
              <div className="flex bg-[#030914] p-0.5 rounded-xl text-xs border border-cyan-950">
                <button
                  onClick={() => setTab('sample')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    tab === 'sample' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  CCTV Feeds
                </button>
                <button
                  onClick={() => setTab('upload')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    tab === 'upload' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Upload File
                </button>
              </div>
            </div>

            {/* Site Association Dropdown */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Monitored Outfall Location
              </label>
              <select
                value={selectedSiteId}
                onChange={e => setSelectedSiteId(e.target.value)}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none focus:border-cyan-400"
              >
                <option value="">Default Site for Sample Feed</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.id}: {s.name} ({s.zone})
                  </option>
                ))}
              </select>
            </div>

            {/* AI Model Architecture Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300">AI Perception Engine</label>
                <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold">RECOMMENDED</Badge>
              </div>
              <select
                value={modelType}
                onChange={e => setModelType(e.target.value)}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none focus:border-cyan-400 font-medium"
              >
                <option value="yolov8m">YOLOv8m Strong Vision (Default - High Precision)</option>
                <option value="yolov8s">YOLOv8s Fast Creek Net</option>
                <option value="aerial">ReWater Aerial Drone Net</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Strong YOLOv8m suppresses water ripples, mud banks, and reflections.
              </p>
            </div>

            {/* Mode Content */}
            {tab === 'sample' ? (
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Select Creek Camera Feed:
                </label>
                <div className="space-y-2">
                  {samples.map(s => {
                    const isSelected = selectedSample?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSample(s)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 flex items-center justify-between ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-950/80 shadow-md shadow-cyan-950/50'
                            : 'border-cyan-950/70 bg-[#030914] hover:bg-[#071326]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                            <Camera className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white leading-tight">{s.name}</p>
                            <p className="text-[10px] text-cyan-300/80 mt-0.5 font-mono">{s.source_type} · {s.site_id}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-extrabold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={runSampleAnalysis}
                  loading={loading}
                  className="w-full justify-center bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-bold text-xs py-2.5 shadow-md shadow-cyan-950/50 mt-2"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  Run AI Plastic Detection
                </Button>
                <p className="text-[10px] text-slate-500 text-center">
                  *Results labelled SIMULATED — operational calibration imagery
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-cyan-500/40 rounded-xl p-8 text-center cursor-pointer hover:bg-cyan-950/30 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-950 group-hover:bg-cyan-900 flex items-center justify-center mx-auto mb-2 text-cyan-400 border border-cyan-500/30">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-white">Drop an image here or click to browse</p>
                  <p className="text-[11px] text-slate-400 mt-1">Accepts JPG or PNG creek debris photos</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) runUploadAnalysis(e.target.files[0]); }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: HUD Stream Player & Analytical Telemetry (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {loading && <LoadingSpinner text="Running YOLOv8 computer vision inference..." />}
          {error && <ErrorMessage message={error} />}

          {result && !loading && (
            <div className="space-y-4">
              {/* Surveillance HUD Viewport */}
              <div className="bg-[#050f20]/95 rounded-2xl overflow-hidden shadow-2xl border border-cyan-500/30">
                {/* HUD Top Bar */}
                <div className="bg-[#030914] px-4 py-2.5 text-white flex items-center justify-between text-xs border-b border-cyan-950/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-300">
                      CCTV FEED INSPECTION
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-[11px] text-slate-300 font-mono">
                      REF-DET#{String((result as any).detection_id || '')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <SeverityBadge score={severity} />
                    <Badge className="bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                      SIMULATED
                    </Badge>
                  </div>
                </div>

                {/* Imagery Frame with Lens Reticle Overlay */}
                <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[280px] max-h-[380px]">
                  <img
                    src={getImageUrl(result.annotated_image_url)}
                    alt="AI Annotated Creek Debris"
                    className="w-full h-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).src = getImageUrl(result.original_image_url); }}
                  />

                  {/* High-Tech HUD Reticle Elements */}
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-mono text-cyan-300 border border-cyan-500/40">
                    RES: 1920×1080 · FPS: 30 · INFERENCE: ~85ms
                  </div>

                  <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-200 border border-slate-700">
                    SITE: {(result as any).site_id ?? 'MITHI-01'} · FLOATING TRASH BOOM
                  </div>
                </div>
              </div>

              {/* 4 Metric Telemetry Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Total Objects', value: metrics?.total_objects_detected ?? 0, color: 'text-white', bg: 'bg-[#050f20]/95' },
                  { label: 'Plastic Bottles', value: metrics?.plastic_bottle_count ?? 0, color: 'text-cyan-300', bg: 'bg-[#050f20]/95' },
                  { label: 'Plastic Bags', value: metrics?.plastic_bag_count ?? 0, color: 'text-orange-400', bg: 'bg-[#050f20]/95' },
                  { label: 'Mean Confidence', value: `${((metrics?.confidence_avg ?? 0) * 100).toFixed(0)}%`, color: 'text-emerald-400', bg: 'bg-[#050f20]/95' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-2xl p-3 text-center border border-cyan-500/20 shadow-xl ${bg}`}>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-black font-heading mt-1 font-mono ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Detection Class Color Mapping */}
              <div className="bg-[#050f20]/95 border border-cyan-500/20 rounded-2xl p-3.5 space-y-2 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">Target Object Classes</span>
                  <span className="text-[10px] text-cyan-300/80 font-mono">YOLO Bounding Box Color Mapping</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {Object.entries(CLASS_COLORS).map(([cls, color]) => (
                    <div key={cls} className="flex items-center gap-2 p-1.5 rounded-xl bg-[#030914] border border-cyan-950 text-[11px]">
                      <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ background: color }} />
                      <span className="font-semibold text-slate-200 truncate">{cls.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 pt-1">
                  *Visual bounding boxes estimate visible density; they do not calculate physical mass without CPCB-compliant scale tare weights.
                </p>
              </div>

              {/* 3D Digital Twin Simulation Gateway */}
              <div className="p-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#03152b] via-[#051e3b] to-[#03152b] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500 text-slate-950 shadow-md">
                    <Waves className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Dynamic 3D Water Pollution Scene</p>
                    <p className="text-[11px] text-cyan-200/80">Visualize detected plastic items floating on animated water and deploy autonomous skimmer</p>
                  </div>
                </div>
                <Link
                  to="/simulator"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400 hover:from-teal-300 hover:to-sky-300 shadow-md shrink-0 self-start sm:self-auto"
                >
                  <Waves className="w-3.5 h-3.5" />
                  <span>Launch 3D Simulator</span>
                </Link>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="bg-[#050f20]/95 rounded-2xl p-12 text-center space-y-3 border-dashed border-2 border-cyan-500/30 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-[#030914] text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30 shadow-md">
                <Scan className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white font-heading">
                Ready for Optical Surveillance Inference
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Select one of the sample CCTV creek feeds on the left, or upload an image to trigger the YOLOv8 debris detection pipeline.
              </p>
            </div>
          )}

          {/* Historical Log */}
          <div className="bg-[#050f20]/95 border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-cyan-950/70 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Recent Stream Inferences ({history.length})
              </span>
              <span className="text-[10px] text-cyan-300/80 font-mono">Cached in local session</span>
            </div>
            <div className="divide-y divide-cyan-950/60 max-h-48 overflow-y-auto">
              {history.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">No detection logs in this session.</div>
              )}
              {history.map((d, i) => (
                <div key={d.id ?? i} className="px-4 py-2.5 flex items-center justify-between hover:bg-[#071326] transition-colors text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-cyan-300">{d.site_id ?? 'CCTV-01'}</span>
                      <span className="font-bold text-white">{d.total_objects_detected} items</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{d.image_source_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">{fmtDateTime(d.timestamp)}</span>
                    <Badge className={sourceBadge(d.source_status)}>{d.source_status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
