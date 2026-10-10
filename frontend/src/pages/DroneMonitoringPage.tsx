import { useState, useRef, useEffect } from 'react';
import {
  uploadDroneImage,
  batchUploadDroneImages,
  uploadDroneVideo,
  getSampleDroneVideos,
  cancelDroneVideoJob,
  retryDroneVideoJob,
  getMumbaiBoundary,
  getImageUrl
} from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import L from 'leaflet';
import {
  Navigation as DroneIcon,
  Video as VideoIcon,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Cpu,
  Layers,
  Sparkles,
  Eye,
  Sliders,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Info,
  Clock,
  Film,
  XCircle,
  Play
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DroneMonitoringPage() {
  const [mode, setMode] = useState<'video' | 'single' | 'batch'>('video');

  // Video State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [sampleInterval, setSampleInterval] = useState<number>(1.0);
  const [videoConfidence, setVideoConfidence] = useState<number>(0.10);
  const [videoModelVariant, setVideoModelVariant] = useState<string>('rewater');
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [flightId, setFlightId] = useState('DJI-MAVIC3-MUM-01');
  const [sourceStatus, setSourceStatus] = useState<'Real' | 'Simulated'>('Real');
  
  // Geolocation for Video
  const [startLat, setStartLat] = useState<number | null>(19.0654);
  const [startLon, setStartLon] = useState<number | null>(72.8712);
  const [endLat, setEndLat] = useState<number | null>(19.0720);
  const [endLon, setEndLon] = useState<number | null>(72.8750);
  const [flightAreaLat, setFlightAreaLat] = useState<number | null>(null);
  const [flightAreaLon, setFlightAreaLon] = useState<number | null>(null);

  const [videoLoading, setVideoLoading] = useState(false);
  const [videoJob, setVideoJob] = useState<any | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [sampleCatalog, setSampleCatalog] = useState<any[]>([]);

  // Single Image State
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singlePreviewUrl, setSinglePreviewUrl] = useState<string | null>(null);
  const [singleModelVariant, setSingleModelVariant] = useState<'rewater' | 'tiles' | 'resize'>('rewater');
  const [singleConfidence, setSingleConfidence] = useState(0.10);
  const [manualLat, setManualLat] = useState<number | null>(null);
  const [manualLon, setManualLon] = useState<number | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<any | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Batch State
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResult, setBatchResult] = useState<any | null>(null);

  // Interactive Mini Map
  const miniMapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    // Fetch preloaded sample videos
    getSampleDroneVideos().then(v => setSampleCatalog(v || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (miniMapRef.current) return;

    // Fix leaflet marker icon options for bundlers
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapContainerRef.current, {
      center: [19.0760, 72.8777],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'drone-waypoint-pin',
      html: '<div style="background-color:#0284c7;width:14px;height:14px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 10px rgba(2,132,199,0.9);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = parseFloat(e.latlng.lat.toFixed(6));
      const lon = parseFloat(e.latlng.lng.toFixed(6));
      if (mode === 'video') {
        setFlightAreaLat(lat);
        setFlightAreaLon(lon);
      } else {
        setManualLat(lat);
        setManualLon(lon);
      }

      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        markerRef.current = L.marker(e.latlng, { icon: pinIcon }).addTo(map);
      }
    });

    miniMapRef.current = map;

    setTimeout(() => {
      if (miniMapRef.current) {
        miniMapRef.current.invalidateSize();
      }
    }, 100);

    return () => {
      map.remove();
      miniMapRef.current = null;
      markerRef.current = null;
    };
  }, [mode]);

  // Video File Handlers
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setVideoFile(selected);
      setVideoPreviewUrl(URL.createObjectURL(selected));
      setVideoJob(null);
      setVideoError(null);
    }
  };

  const handleLoadSampleVideo = async (sample: any) => {
    try {
      setVideoLoading(true);
      setVideoError(null);
      setStartLat(sample.default_start_coords[0]);
      setStartLon(sample.default_start_coords[1]);
      setEndLat(sample.default_end_coords[0]);
      setEndLon(sample.default_end_coords[1]);

      // Fetch sample as blob
      const res = await fetch(sample.url);
      const blob = await res.blob();
      const sampleFile = new File([blob], sample.filename, { type: 'video/mp4' });
      setVideoFile(sampleFile);
      setVideoPreviewUrl(sample.url);

      const fd = new FormData();
      fd.append('file', sampleFile);
      fd.append('sample_interval_sec', sampleInterval.toString());
      fd.append('confidence_threshold', videoConfidence.toString());
      fd.append('model_variant', videoModelVariant);
      fd.append('start_latitude', sample.default_start_coords[0].toString());
      fd.append('start_longitude', sample.default_start_coords[1].toString());
      fd.append('end_latitude', sample.default_end_coords[0].toString());
      fd.append('end_longitude', sample.default_end_coords[1].toString());
      fd.append('flight_id', 'SURVEY-MITHI-AERIAL');
      fd.append('source_status', 'Real');

      const jobRes = await uploadDroneVideo(fd);
      setVideoJob(jobRes);
      setSelectedFrameIndex(0);
    } catch (err: any) {
      setVideoError(err.message || 'Failed to analyze sample video');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleVideoSubmit = async () => {
    if (!videoFile) {
      setVideoError('Please select a drone video file (MP4, MOV).');
      return;
    }

    setVideoLoading(true);
    setVideoError(null);

    try {
      const fd = new FormData();
      fd.append('file', videoFile);
      fd.append('sample_interval_sec', sampleInterval.toString());
      fd.append('confidence_threshold', videoConfidence.toString());
      fd.append('model_variant', videoModelVariant);
      if (srtFile) fd.append('srt_file', srtFile);
      if (startLat !== null) fd.append('start_latitude', startLat.toString());
      if (startLon !== null) fd.append('start_longitude', startLon.toString());
      if (endLat !== null) fd.append('end_latitude', endLat.toString());
      if (endLon !== null) fd.append('end_longitude', endLon.toString());
      if (flightAreaLat !== null) fd.append('flight_area_latitude', flightAreaLat.toString());
      if (flightAreaLon !== null) fd.append('flight_area_longitude', flightAreaLon.toString());
      fd.append('flight_id', flightId);
      fd.append('source_status', sourceStatus);

      const jobRes = await uploadDroneVideo(fd);
      setVideoJob(jobRes);
      setSelectedFrameIndex(0);

      // Pan map if coordinates available
      if (startLat && startLon && miniMapRef.current) {
        miniMapRef.current.setView([startLat, startLon], 14);
        if (markerRef.current) {
          markerRef.current.setLatLng([startLat, startLon]);
        } else {
          markerRef.current = L.marker([startLat, startLon]).addTo(miniMapRef.current);
        }
      }
    } catch (err: any) {
      setVideoError(err.message || 'Drone video processing failed');
    } finally {
      setVideoLoading(false);
    }
  };

  // Single Image Submit
  const handleSingleSubmit = async () => {
    if (!singleFile) {
      setSingleError('Please select an aerial drone image to analyze.');
      return;
    }

    setSingleLoading(true);
    setSingleError(null);

    try {
      const fd = new FormData();
      fd.append('file', singleFile);
      if (manualLat !== null) fd.append('manual_latitude', manualLat.toString());
      if (manualLon !== null) fd.append('manual_longitude', manualLon.toString());
      fd.append('flight_id', flightId);
      fd.append('confidence_threshold', singleConfidence.toString());
      fd.append('model_variant', singleModelVariant);
      fd.append('source_status', sourceStatus);

      const res = await uploadDroneImage(fd);
      setSingleResult(res);

      if (res.location?.latitude && res.location?.longitude && miniMapRef.current) {
        const coords: [number, number] = [res.location.latitude, res.location.longitude];
        miniMapRef.current.setView(coords, 14);
        if (markerRef.current) {
          markerRef.current.setLatLng(coords);
        } else {
          markerRef.current = L.marker(coords).addTo(miniMapRef.current);
        }
      }
    } catch (err: any) {
      setSingleError(err.message || 'Image processing failed');
    } finally {
      setSingleLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-sky-800/40 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-sky-500/10 border border-sky-400/30 rounded-xl text-sky-400">
              <DroneIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Drone Video & Aerial Monitoring
                <Badge className="bg-sky-500/10 text-sky-300 border-sky-400/30 text-xs">
                  ReWater YOLOv8m Pretrained
                </Badge>
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Automated floating-plastic accumulation detection in Mumbai rivers, nullahs, and tidal outfalls
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/70 p-1.5 rounded-xl border border-slate-700/60">
          <button
            onClick={() => { setMode('video'); setVideoError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              mode === 'video'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <VideoIcon className="h-4 w-4" />
            Drone Video Analysis
          </button>
          <button
            onClick={() => { setMode('single'); setSingleError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              mode === 'single'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <DroneIcon className="h-4 w-4" />
            Single Drone Photo
          </button>
          <button
            onClick={() => { setMode('batch'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              mode === 'batch'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Layers className="h-4 w-4" />
            Batch Photos
          </button>
        </div>
      </div>

      {/* Model Spec & Architecture Notice */}
      <Card className="bg-slate-900/60 border-slate-800/80 shadow-md">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-start gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
              <Cpu className="h-5 w-5 text-sky-400 mt-0.5" />
              <div>
                <span className="text-slate-400 font-semibold block">PRIMARY MODEL</span>
                <span className="text-slate-200 font-medium">ReWater River Plastic (YOLOv8m)</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">SwastikGorai/ReWater · 52 MB · MIT License</span>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
              <Film className="h-5 w-5 text-emerald-400 mt-0.5" />
              <div>
                <span className="text-slate-400 font-semibold block">TEMPORAL GROUPING</span>
                <span className="text-slate-200 font-medium">Cross-Frame Deduplication</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">Aggregates continuous floating patches across frames into 1 hotspot</span>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
              <ShieldCheck className="h-5 w-5 text-indigo-400 mt-0.5" />
              <div>
                <span className="text-slate-400 font-semibold block">GEOFENCING</span>
                <span className="text-slate-200 font-medium">BMC Mumbai Boundary Polygon</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">Strict point-in-polygon; rejects out-of-boundary footage</span>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
              <Info className="h-5 w-5 text-amber-400 mt-0.5" />
              <div>
                <span className="text-slate-400 font-semibold block">GEOLOCATION PROVENANCE</span>
                <span className="text-slate-200 font-medium">SRT Sync / Waypoint Interp</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">Never fabricates GPS; unlocated clips kept in review queue</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* MODE 1: DRONE VIDEO ANALYSIS (PRIMARY) */}
      {/* ========================================================================= */}
      {mode === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-800 bg-slate-900/90 shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/60">
                <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
                  <span>Drone Video Input & Parameters</span>
                  <Badge className="text-xs text-sky-400 border-sky-500/30">
                    MP4 / MOV
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* Sample Video Quick-Start */}
                {sampleCatalog.length > 0 && (
                  <div className="bg-sky-950/30 border border-sky-800/40 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        Quick Test Sample Video
                      </span>
                      <span className="text-[11px] text-slate-400">Preloaded 5s HD Drone Footage</span>
                    </div>
                    {sampleCatalog.map(sample => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleLoadSampleVideo(sample)}
                        disabled={videoLoading}
                        className="w-full text-left bg-sky-900/30 hover:bg-sky-900/50 border border-sky-700/40 hover:border-sky-500/60 p-2.5 rounded-lg text-xs transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-sky-200 font-medium group-hover:text-white flex items-center gap-1.5">
                            <Play className="h-3.5 w-3.5 text-sky-400 fill-sky-400" />
                            {sample.title}
                          </div>
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            {sample.location_name} · {sample.duration_formatted} · {sample.fps} FPS
                          </div>
                        </div>
                        <span className="text-sky-400 font-semibold group-hover:translate-x-1 transition-transform">
                          Run &rarr;
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Video Upload Field */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Upload Drone Video File (MP4, MOV)
                  </label>
                  <div className="border-2 border-dashed border-slate-700 hover:border-sky-500/60 rounded-xl p-4 text-center bg-slate-800/30 transition-all cursor-pointer">
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-msvideo"
                      onChange={handleVideoFileChange}
                      className="hidden"
                      id="drone-video-upload"
                    />
                    <label htmlFor="drone-video-upload" className="cursor-pointer block">
                      <UploadCloud className="h-8 w-8 text-sky-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-300 font-medium">
                        {videoFile ? videoFile.name : 'Click to select drone video from device'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Supported: .mp4, .mov (Max 200MB)'}
                      </p>
                    </label>
                  </div>
                </div>

                {/* Sampling Interval Slider */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <label className="font-medium text-slate-300 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-sky-400" />
                      Frame Sampling Interval:
                    </label>
                    <span className="font-mono text-sky-400 font-semibold">1 frame / {sampleInterval} sec</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.5"
                    value={sampleInterval}
                    onChange={e => setSampleInterval(parseFloat(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>Dense (0.5s)</span>
                    <span>Standard (1.0s)</span>
                    <span>Sparse (3.0s)</span>
                  </div>
                </div>



                {/* Telemetry Georeferencing */}
                <div className="space-y-2 border-t border-slate-800/80 pt-3">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-sky-400" />
                    Drone Geolocation & Telemetry Sync
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Start Waypoint Lat</label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="19.0654"
                        value={startLat ?? ''}
                        onChange={e => setStartLat(e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded p-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Start Waypoint Lon</label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="72.8712"
                        value={startLon ?? ''}
                        onChange={e => setStartLon(e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded p-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">End Waypoint Lat</label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="19.0720"
                        value={endLat ?? ''}
                        onChange={e => setEndLat(e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded p-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">End Waypoint Lon</label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="72.8750"
                        value={endLon ?? ''}
                        onChange={e => setEndLon(e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded p-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1">
                    Or click anywhere on the interactive map below to define the flight area.
                  </p>
                </div>

                {/* Submit Action */}
                <Button
                  onClick={handleVideoSubmit}
                  disabled={videoLoading || !videoFile}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-lg shadow-sky-600/30 py-2.5"
                >
                  {videoLoading ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Extracting Frames & Running ReWater YOLOv8...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Play className="h-4 w-4 fill-white" />
                      Start Drone Video Inference
                    </span>
                  )}
                </Button>

                {videoError && <ErrorMessage message={videoError} />}
              </CardContent>
            </Card>

            {/* Interactive Leaflet Map for Flight Area Pinning */}
            <Card className="border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
              <CardHeader className="p-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-sky-400" />
                  Flight Path & Flight Area Mapping
                </CardTitle>
                <span className="text-[10px] text-slate-400">Click to pin flight area</span>
              </CardHeader>
              <div ref={mapContainerRef} className="w-full bg-slate-950 relative z-0" style={{ minHeight: '400px' }} />
            </Card>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-7 space-y-6">
            {videoJob && videoJob.status === 'COMPLETED' ? (
              <div className="space-y-6">
                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                    <span className="text-[11px] text-slate-400 font-medium block">DURATION</span>
                    <span className="text-xl font-bold text-white mt-0.5 block font-mono">
                      {videoJob.video_metadata?.duration_formatted}
                    </span>
                    <span className="text-[11px] text-slate-500">{videoJob.video_metadata?.total_frames} frames @ {videoJob.video_metadata?.fps} FPS</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                    <span className="text-[11px] text-slate-400 font-medium block">FRAMES ANALYZED</span>
                    <span className="text-xl font-bold text-sky-400 mt-0.5 block font-mono">
                      {videoJob.summary?.total_frames_sampled}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium">
                      {videoJob.summary?.frames_with_plastic} positive frames
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                    <span className="text-[11px] text-slate-400 font-medium block">TOTAL PLASTIC ITEMS</span>
                    <span className="text-xl font-bold text-amber-400 mt-0.5 block font-mono">
                      {videoJob.summary?.total_plastic_detections}
                    </span>
                    <span className="text-[11px] text-slate-500">ReWater River YOLOv8m</span>
                  </div>

                  <div className="bg-slate-900 border border-sky-800/60 bg-sky-950/20 p-3.5 rounded-xl">
                    <span className="text-[11px] text-sky-300 font-medium block">CANDIDATE HOTSPOTS</span>
                    <span className="text-xl font-bold text-white mt-0.5 block font-mono">
                      {videoJob.summary?.candidate_accumulations_count}
                    </span>
                    <span className="text-[11px] text-sky-400 font-medium">Grouped & Deduplicated</span>
                  </div>
                </div>

                {/* Candidate Pollution Accumulations (Grouped Cross-Frame Hotspots) */}
                <Card className="border-slate-800 bg-slate-900/90 shadow-xl">
                  <CardHeader className="pb-3 border-b border-slate-800/80">
                    <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-sky-400" />
                        Candidate Pollution Hotspots (Grouped Across Video Frames)
                      </span>
                      <Link
                        to="/map"
                        className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                      >
                        Open Centralized Map <ExternalLink className="h-3 w-3" />
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {videoJob.accumulations?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 text-center">
                        No significant plastic accumulations detected in the sampled video frames.
                      </p>
                    ) : (
                      videoJob.accumulations?.map((acc: any) => (
                        <div
                          key={acc.cluster_id}
                          className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-sky-500/50 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <span className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400 font-mono text-xs font-bold mt-0.5">
                              {acc.cluster_id}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">
                                  Floating Debris Cluster
                                </span>
                                <Badge className="text-[10px] bg-slate-800 text-slate-300 border-slate-700 font-mono">
                                  {acc.time_span}
                                </Badge>
                                <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                  VALID_MUMBAI
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">
                                Detected in <strong className="text-slate-200">{acc.frame_count} consecutive frames</strong> · Peak accumulation: <strong className="text-amber-300">{acc.peak_items} plastic items</strong> (~{acc.estimated_mass_kg} kg)
                              </p>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>Avg Confidence: {(acc.avg_confidence * 100).toFixed(1)}%</span>
                                <span>·</span>
                                <span>Location: {acc.keyframe?.latitude?.toFixed(4)}, {acc.keyframe?.longitude?.toFixed(4)} ({acc.keyframe?.location_method})</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Link
                              to={`/map?highlight=${acc.cluster_id}`}
                              className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                            >
                              Inspect on Map <ChevronRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Sampled Frames Scrubber & Preview */}
                <Card className="border-slate-800 bg-slate-900/90 shadow-xl">
                  <CardHeader className="pb-3 border-b border-slate-800/80">
                    <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Film className="h-4 w-4 text-sky-400" />
                        Sampled Video Frames & Annotated ReWater Detections
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Frame {selectedFrameIndex + 1} of {videoJob.sampled_frames?.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Active Frame Preview (Original vs Annotated) */}
                    {videoJob.sampled_frames?.[selectedFrameIndex] && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <span className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                              <span>Original Frame ({videoJob.sampled_frames[selectedFrameIndex].timestamp_formatted})</span>
                              <span className="text-[11px] text-slate-500 font-mono">Index #{videoJob.sampled_frames[selectedFrameIndex].frame_index}</span>
                            </span>
                            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                              <img
                                src={getImageUrl(videoJob.sampled_frames[selectedFrameIndex].original_frame_url)}
                                alt="Original Drone Frame"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-xs text-sky-400 font-semibold flex items-center justify-between">
                              <span>ReWater YOLOv8 Annotated Bounding Boxes</span>
                              <Badge className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30">
                                {videoJob.sampled_frames[selectedFrameIndex].plastic_count} Plastic Detections
                              </Badge>
                            </span>
                            <div className="relative rounded-xl overflow-hidden border border-sky-800/50 bg-black aspect-video flex items-center justify-center">
                              <img
                                src={getImageUrl(videoJob.sampled_frames[selectedFrameIndex].annotated_frame_url)}
                                alt="Annotated Drone Frame"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Frame Details Banner */}
                        <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">Timestamp: <strong className="text-white font-mono">{videoJob.sampled_frames[selectedFrameIndex].timestamp_formatted}</strong></span>
                            <span className="text-slate-400">Confidence Avg: <strong className="text-sky-300">{(videoJob.sampled_frames[selectedFrameIndex].confidence_avg * 100).toFixed(1)}%</strong></span>
                            <span className="text-slate-400">Coordinates: <strong className="text-slate-200 font-mono">{videoJob.sampled_frames[selectedFrameIndex].latitude?.toFixed(4)}, {videoJob.sampled_frames[selectedFrameIndex].longitude?.toFixed(4)}</strong></span>
                          </div>
                          <Badge className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">
                            Provenance: {videoJob.sampled_frames[selectedFrameIndex].location_method}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Frame Thumbnails Filmstrip */}
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-2">Video Filmstrip / Click Frame to Inspect</span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {videoJob.sampled_frames?.map((frame: any, idx: number) => (
                          <button
                            key={frame.frame_index}
                            onClick={() => setSelectedFrameIndex(idx)}
                            className={`flex-shrink-0 w-28 rounded-lg overflow-hidden border text-left transition-all ${
                              selectedFrameIndex === idx
                                ? 'border-sky-400 ring-2 ring-sky-400/40 scale-105'
                                : 'border-slate-800 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={getImageUrl(frame.annotated_frame_url)}
                              alt={`Frame ${frame.timestamp_formatted}`}
                              className="w-full h-16 object-cover bg-black"
                            />
                            <div className="p-1 bg-slate-900 text-[10px] flex items-center justify-between font-mono">
                              <span className="text-slate-300">{frame.timestamp_formatted}</span>
                              <span className={frame.plastic_count > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                                {frame.plastic_count} det
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Idle / Instructions Panel */
              <Card className="border-slate-800 bg-slate-900/50 shadow-xl">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="p-4 bg-sky-500/10 border border-sky-400/20 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center text-sky-400">
                    <VideoIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">No Drone Video Analyzed Yet</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      Upload an aerial drone video (MP4/MOV) of a Mumbai waterway or click the preloaded Mithi River sample survey footage to test the full ReWater YOLOv8 inference and accumulation grouping pipeline.
                    </p>
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    {sampleCatalog[0] && (
                      <Button
                        onClick={() => handleLoadSampleVideo(sampleCatalog[0])}
                        disabled={videoLoading}
                        className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold py-2 px-4 shadow-lg shadow-sky-600/30"
                      >
                        <Play className="h-3.5 w-3.5 fill-white mr-1.5" />
                        Run Mithi River Sample Video (5s HD)
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: SINGLE DRONE PHOTO */}
      {/* ========================================================================= */}
      {mode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-800 bg-slate-900/90 shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/60">
                <CardTitle className="text-base font-semibold text-white">
                  Single Drone Photograph Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="border-2 border-dashed border-slate-700 hover:border-sky-500/60 rounded-xl p-4 text-center bg-slate-800/30 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        setSingleFile(e.target.files[0]);
                        setSinglePreviewUrl(URL.createObjectURL(e.target.files[0]));
                        setSingleResult(null);
                      }
                    }}
                    className="hidden"
                    id="single-drone-upload"
                  />
                  <label htmlFor="single-drone-upload" className="cursor-pointer block">
                    <UploadCloud className="h-8 w-8 text-sky-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-300 font-medium">
                      {singleFile ? singleFile.name : 'Select drone aerial photograph'}
                    </p>
                  </label>
                </div>



                {/* Geolocation Section */}
                <div className="space-y-2 border-t border-slate-800/80 pt-3">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-sky-400" />
                    Report Location (Optional)
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="e.g., 19.0760"
                        value={manualLat ?? ''}
                        onChange={e => setManualLat(e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded p-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="e.g., 72.8777"
                        value={manualLon ?? ''}
                        onChange={e => setManualLon(e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded p-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Or click on the map below to pinpoint the issue location dynamically.
                  </p>
                </div>

                <Button
                  onClick={handleSingleSubmit}
                  disabled={singleLoading || !singleFile}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2.5"
                >
                  {singleLoading ? 'Running Model Inference...' : 'Analyze Drone Photo'}
                </Button>
                {singleError && <ErrorMessage message={singleError} />}
              </CardContent>
            </Card>

            {/* Interactive Leaflet Map for Issue Pinning */}
            <Card className="border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden mt-6">
              <CardHeader className="p-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-sky-400" />
                  Point Issue on Map
                </CardTitle>
                <span className="text-[10px] text-slate-400">Click to pin location</span>
              </CardHeader>
              <div ref={mapContainerRef} className="h-48 w-full bg-slate-950" />
            </Card>
          </div>

          <div className="lg:col-span-7">
            {singleResult && (
              <Card className="border-slate-800 bg-slate-900/90 shadow-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Detection Output</h3>
                  <Badge className="text-xs bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    {singleResult.boundary_status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <img src={getImageUrl(singleResult.images?.original_url)} alt="Original" className="rounded-lg border border-slate-800" />
                  <img src={getImageUrl(singleResult.images?.annotated_url)} alt="Annotated" className="rounded-lg border border-sky-800/50" />
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg text-xs space-y-1">
                  <p className="text-slate-300">Model: <strong className="text-white">{singleResult.model_version}</strong></p>
                  <p className="text-slate-300">Detected: <strong className="text-amber-300">{singleResult.detection?.plastic_count} plastic objects</strong></p>
                  <p className="text-slate-300">Estimated Mass: <strong className="text-white">{singleResult.detection?.estimated_debris_kg} kg</strong></p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: BATCH PHOTOS */}
      {/* ========================================================================= */}
      {mode === 'batch' && (
        <Card className="border-slate-800 bg-slate-900/90 shadow-xl p-6 text-center">
          <UploadCloud className="h-10 w-10 text-sky-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">Batch Orthomosaics & Aerial Images</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Upload multiple drone photos to process in parallel using the ReWater / Model A inference worker.
          </p>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={e => {
              if (e.target.files) setBatchFiles(Array.from(e.target.files));
            }}
            className="text-xs text-slate-400 file:bg-sky-600 file:text-white file:border-0 file:rounded-lg file:py-2 file:px-4 file:mr-4 file:cursor-pointer"
          />
        </Card>
      )}
    </div>
  );
}
