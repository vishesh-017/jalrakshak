import { useState, useRef, useEffect } from 'react';
import { uploadWorkerReport, getWorkerReports, updateWorkerReportAction, getImageUrl } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import L from 'leaflet';
import {
  UserCheck,
  Camera,
  MapPin,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Navigation,
  FileCheck2,
  Sparkles,
  ExternalLink,
  ClipboardList,
  ShieldCheck,
  Send,
  XCircle,
  Truck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const CATEGORIES = [
  'Culvert Choke',
  'Floating Boom Jam',
  'Mangrove Plastic Slick',
  'Illegal Nullah Dumping',
  'Tidal Creek Backflow Accumulation'
];

export default function FieldReportingPage() {
  const [activeTab, setActiveTab] = useState<'submit' | 'review'>('submit');

  // Form State
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reporterId, setReporterId] = useState('EMP-BMC-402');
  const [reporterName, setReporterName] = useState('Lead Inspector V. Patil');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [locationDesc, setLocationDesc] = useState('');
  const [waterDepth, setWaterDepth] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [sourceStatus, setSourceStatus] = useState<'Real' | 'Simulated'>('Real');

  // Geolocation
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Submission & Results
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review List
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Map
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.0520, 72.8580], // Central Mumbai
      zoom: 12,
    });

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const pinIcon = L.divIcon({
      className: 'worker-report-pin',
      html: '<div style="background-color:#059669;width:14px;height:14px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 10px rgba(5,150,105,0.9);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const pLat = parseFloat(e.latlng.lat.toFixed(6));
      const pLon = parseFloat(e.latlng.lng.toFixed(6));
      setLat(pLat);
      setLon(pLon);

      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        markerRef.current = L.marker(e.latlng, { icon: pinIcon }).addTo(map);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleUseBrowserGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = parseFloat(pos.coords.latitude.toFixed(6));
        const uLon = parseFloat(pos.coords.longitude.toFixed(6));
        setLat(uLat);
        setLon(uLon);
        setGpsLoading(false);

        if (mapRef.current) {
          const coords: [number, number] = [uLat, uLon];
          mapRef.current.setView(coords, 15);
          if (markerRef.current) {
            markerRef.current.setLatLng(coords);
          } else {
            markerRef.current = L.marker(coords).addTo(mapRef.current);
          }
        }
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(err.message || 'Unable to retrieve location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setPhoto(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setSubmitResult(null);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) {
      setError('Please attach a photograph of the plastic accumulation.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('photo', photo);
      fd.append('reporter_id', reporterId);
      fd.append('reporter_name', reporterName);
      fd.append('report_category', category);
      if (lat !== null) fd.append('latitude', lat.toString());
      if (lon !== null) fd.append('longitude', lon.toString());
      if (locationDesc) fd.append('location_description', locationDesc);
      if (waterDepth !== '') fd.append('water_level_m', waterDepth.toString());
      if (notes) fd.append('notes', notes);
      fd.append('source_status', sourceStatus);
      fd.append('confidence_threshold', '0.10');

      const res = await uploadWorkerReport(fd);
      setSubmitResult(res);

      // Auto update map if EXIF coords were detected
      if (res.location?.latitude && res.location?.longitude && mapRef.current) {
        const coords: [number, number] = [res.location.latitude, res.location.longitude];
        mapRef.current.setView(coords, 15);
        if (markerRef.current) {
          markerRef.current.setLatLng(coords);
        } else {
          markerRef.current = L.marker(coords).addTo(mapRef.current);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit field report');
    } finally {
      setSubmitting(false);
    }
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const data = await getWorkerReports();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'review') {
      loadReports();
    }
  }, [activeTab]);

  const handleAction = async (reportId: string, action: string) => {
    setActionLoading(reportId);
    try {
      await updateWorkerReportAction(reportId, action);
      await loadReports();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Field Worker & Sanitation Reporting</h1>
            <Badge className="bg-emerald-950/60 text-emerald-300 border-emerald-500/40">Module 3</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Ground surveillance reporting interface for BMC engineers, ward contractors, and nullah barrier teams. Shared Model A inference & Mumbai geofence verification.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'submit'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Submit Incident Report
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'review'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Operator Review Queue</span>
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* SUBMISSION FORM TAB */}
      {activeTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Card (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <Card className="bg-[#040c18] border-cyan-500/20">
              <CardHeader className="pb-3 border-b border-cyan-500/10">
                <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                  <span>New Field Observation Form</span>
                  <Badge className="bg-cyan-950/60 text-cyan-300 border-cyan-500/30 text-[10px]">
                    Model A Optical Assist
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  {/* Photo Upload Area */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>Waterway Photograph Evidence *</span>
                    </label>
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-500/30 rounded-xl hover:border-emerald-400/60 bg-[#020612]/60 cursor-pointer transition-all">
                      <UploadCloud className="w-7 h-7 text-emerald-400 mb-2" />
                      <span className="font-semibold text-slate-200">Tap to snap camera or browse gallery</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Captures EXIF location automatically</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                    </label>

                    {photo && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-200">
                        <span className="truncate max-w-[220px] font-mono">{photo.name}</span>
                        <span>{(photo.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    )}
                  </div>

                  {/* Category & Water Depth */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Observation Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Water Depth (Meters)</label>
                      <input
                        type="number"
                        step="0.05"
                        placeholder="e.g. 1.45"
                        value={waterDepth}
                        onChange={(e) => setWaterDepth(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Reporter Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Reporter Name</label>
                      <input
                        type="text"
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Worker Badge / ID</label>
                      <input
                        type="text"
                        value={reporterId}
                        onChange={(e) => setReporterId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Location Description */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Location Landmark / Creek Section</label>
                    <input
                      type="text"
                      placeholder="e.g. Mahim Causeway Culvert Gate #3, Dharavi West"
                      value={locationDesc}
                      onChange={(e) => setLocationDesc(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Geolocation Section */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        <span>GPS Coordinates</span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleUseBrowserGps}
                        disabled={gpsLoading}
                        className="text-[11px] h-7 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                      >
                        {gpsLoading ? <LoadingSpinner size="sm" /> : <Navigation className="w-3 h-3 mr-1" />}
                        Use Device GPS
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px]">
                      <div>
                        <span>Latitude: </span>
                        <span className="font-mono text-white font-semibold">{lat ?? 'Not set'}</span>
                      </div>
                      <div>
                        <span>Longitude: </span>
                        <span className="font-mono text-white font-semibold">{lon ?? 'Not set'}</span>
                      </div>
                    </div>
                    {gpsError && <p className="text-[10px] text-rose-400">{gpsError}</p>}
                    <p className="text-[10px] text-slate-500 italic">
                      You can also click on the map on the right to manually set or refine your position.
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Field Observations & Severity Notes</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Debris accumulation blocking culvert screen. High tide incoming in 2 hours."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={submitting || !photo}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-600/20"
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        <span>Analyzing with Model A & Validating Geofence...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Send className="w-4 h-4" />
                        <span>Submit Validated Report to Dashboard</span>
                      </div>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Interactive Pinning Map & AI Response (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Map Pinning Card */}
            <Card className="bg-[#040c18] border-cyan-500/20">
              <CardHeader className="pb-2 border-b border-cyan-500/10">
                <CardTitle className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Interactive Mumbai Territory Pinning</span>
                  <Badge className="bg-emerald-950/60 text-emerald-300 border-emerald-500/30 text-[10px]">
                    BMC Polygon Geofenced
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div
                  ref={mapContainerRef}
                  className="w-full h-56 rounded-xl border border-cyan-500/20 overflow-hidden shadow-inner"
                />
                <p className="text-[10px] text-slate-400 mt-2">
                  Click anywhere on the map to set report coordinates. Detections outside the official Mumbai boundary will be flagged.
                </p>
              </CardContent>
            </Card>

            {/* AI Results & Hotspot Confirmation */}
            {submitResult ? (
              <Card className="bg-[#040c18] border-emerald-500/30 shadow-xl overflow-hidden animate-fadeIn">
                <CardHeader className="pb-3 border-b border-emerald-500/20 flex flex-row items-center justify-between bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <CardTitle className="text-sm font-bold text-white">Report Processed Successfully</CardTitle>
                      <p className="text-[10px] text-emerald-300 font-mono">
                        Hotspot ID: {submitResult.report_id}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      submitResult.location?.is_valid_mumbai
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-950 text-rose-300 border-rose-500/40'
                    }
                  >
                    {submitResult.location?.boundary_status}
                  </Badge>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 text-xs">
                  {/* Photo Previews */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden border border-slate-800 bg-black">
                    <div>
                      <div className="p-1 bg-slate-900 text-[9px] text-slate-400 text-center">Original Photo</div>
                      <img
                        src={getImageUrl(submitResult.evidence?.original_url)}
                        alt="Original"
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'http://localhost:8000/api/static/sample_feeds/kurla_bkc_culvert_cam.jpg';
                        }}
                      />
                    </div>
                    <div>
                      <div className="p-1 bg-emerald-950 text-[9px] text-emerald-300 text-center">Model A Detections</div>
                      <img
                        src={getImageUrl(submitResult.evidence?.annotated_url || submitResult.evidence?.original_url)}
                        alt="AI Annotated"
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'http://localhost:8000/api/static/sample_feeds/annotated_kurla_bkc_culvert_cam.jpg';
                        }}
                      />
                    </div>
                  </div>

                  {/* AI Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Debris Items</div>
                      <div className="text-base font-black text-amber-400 font-mono mt-0.5">
                        {submitResult.ai_results?.total_debris_items}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Estimated Mass</div>
                      <div className="text-base font-black text-rose-400 font-mono mt-0.5">
                        {submitResult.ai_results?.estimated_debris_kg} kg
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Confidence</div>
                      <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                        {((submitResult.ai_results?.confidence_avg || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Hotspot & Dispatch Link */}
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-[11px] text-slate-300 font-bold">
                        Calculated Priority: <span className="text-rose-400 font-mono">{submitResult.hotspot?.risk_category}</span> ({submitResult.hotspot?.risk_score}/100)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Dispatch Status: {submitResult.hotspot?.cleanup_status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/map?highlight=${submitResult.report_id}`}>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-8">
                          View on Map
                          <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                      <Link to={`/cleanup?hotspot=${submitResult.report_id}`}>
                        <Button size="sm" variant="outline" className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/60 text-xs h-8">
                          <Truck className="w-3.5 h-3.5 mr-1" />
                          Cleanup Task
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-[#040c18]/60 border border-slate-800 p-6 text-center text-xs text-slate-400">
                <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="font-bold text-slate-200">Awaiting Submission</h4>
                <p className="mt-1 max-w-sm mx-auto text-[11px]">
                  Submit your photograph above. Pretrained Model A will calculate debris density and synchronize the event to the centralized Mumbai monitoring system.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* OPERATOR REVIEW QUEUE TAB */}
      {activeTab === 'review' && (
        <Card className="bg-[#040c18] border-cyan-500/20">
          <CardHeader className="border-b border-cyan-500/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-400" />
                <span>Field Sanitation Worker Incident Ledger</span>
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Review submitted worker reports, inspect photographic evidence, verify locations, and dispatch cleanup crews.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={loadReports} disabled={loadingReports} className="text-xs border-cyan-500/30">
              Refresh
            </Button>
          </CardHeader>

          <CardContent className="pt-4">
            {loadingReports ? (
              <div className="py-12 flex justify-center"><LoadingSpinner /></div>
            ) : reports.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No worker reports in queue. Use the Submit tab to record field observations.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Report ID / Title</th>
                      <th className="p-3">Reporter</th>
                      <th className="p-3">Location / Geofence</th>
                      <th className="p-3">Debris Mass</th>
                      <th className="p-3">Review Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#030914]">
                    {reports.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-900/40">
                        <td className="p-3">
                          <div className="font-bold text-slate-200">{r.title}</div>
                          <div className="text-[10px] font-mono text-cyan-400 mt-0.5">{r.id}</div>
                        </td>
                        <td className="p-3 text-slate-300">
                          {r.device_or_reporter_id || 'Worker'}
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-slate-400">
                            {r.latitude ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}` : 'Unlocated'}
                          </div>
                          <Badge
                            className={`mt-1 text-[9px] ${
                              r.boundary_status === 'VALID_MUMBAI'
                                ? 'bg-emerald-950 text-emerald-300'
                                : 'bg-rose-950 text-rose-300'
                            }`}
                          >
                            {r.boundary_status}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-400">
                          {r.estimated_debris_kg} kg
                        </td>
                        <td className="p-3">
                          <Badge
                            className={
                              r.review_status === 'Verified'
                                ? 'bg-emerald-950 text-emerald-300'
                                : r.review_status === 'Rejected'
                                ? 'bg-rose-950 text-rose-300'
                                : 'bg-amber-950 text-amber-300'
                            }
                          >
                            {r.review_status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            {r.review_status !== 'Verified' && (
                              <Button
                                size="sm"
                                onClick={() => handleAction(r.id, 'verify')}
                                disabled={actionLoading === r.id}
                                className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold"
                              >
                                Approve
                              </Button>
                            )}
                            {r.cleanup_status !== 'Task Assigned' && (
                              <Button
                                size="sm"
                                onClick={() => handleAction(r.id, 'dispatch_cleanup')}
                                disabled={actionLoading === r.id}
                                className="h-7 text-[11px] bg-cyan-700 hover:bg-cyan-600 text-white font-semibold"
                              >
                                <Truck className="w-3 h-3 mr-1" />
                                Dispatch Crew
                              </Button>
                            )}
                            {r.review_status !== 'Rejected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(r.id, 'reject')}
                                disabled={actionLoading === r.id}
                                className="h-7 text-[11px] border-rose-500/40 text-rose-300 hover:bg-rose-950/40"
                              >
                                Reject
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
