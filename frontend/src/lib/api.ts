import type {
  MonitoringSite,
  RainfallObservation,
  TideObservation,
  WaterLevelObservation,
  PlasticDetection,
  RiskForecast,
  CleanupTask,
  RecoveryRecord,
  DashboardMetrics,
  SampleFeed,
} from '../types';

const BASE = 'http://localhost:8000/api';

export function getImageUrl(url?: any): string {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `http://localhost:8000${url}`;
  if (url.startsWith('/')) return `http://localhost:8000${url}`;
  return `http://localhost:8000/api/static/uploads/${url}`;
}

function formatError(err: any, status: number): string {
  if (!err) return `HTTP ${status}`;
  if (typeof err.detail === 'string') return err.detail;
  if (Array.isArray(err.detail)) {
    return err.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
  }
  if (err.detail && typeof err.detail === 'object') {
    return err.detail.msg || JSON.stringify(err.detail);
  }
  if (err.message) return err.message;
  return `HTTP ${status}`;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatError(err, res.status));
  }
  return res.json() as Promise<T>;
}

// ---------- Sites ----------
export const getSites = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return req<MonitoringSite[]>(`/sites${qs}`);
};
export const getSite = (id: string) => req<MonitoringSite>(`/sites/${id}`);
export const updateSite = (id: string, body: Partial<MonitoringSite>) =>
  req<MonitoringSite>(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ---------- Observations ----------
export const getRainfall = (siteId?: string, limit = 50) =>
  req<RainfallObservation[]>(`/observations/rainfall${siteId ? `?site_id=${siteId}&limit=${limit}` : `?limit=${limit}`}`);

export const getTide = () => req<TideObservation>(`/observations/tide/latest`);
export const getTideHistory = () => req<TideObservation[]>(`/observations/tide`);

export const getWaterLevels = (siteId?: string) =>
  req<WaterLevelObservation[]>(`/observations/water-level${siteId ? `?site_id=${siteId}` : ''}`);

export const addRainfall = (data: { site_id: string; rainfall_1h_mm: number; rainfall_24h_mm: number; forecast_24h_mm: number; source_status: string }) =>
  req<RainfallObservation>('/observations/rainfall', { method: 'POST', body: JSON.stringify(data) });

export const getDataCoverage = () =>
  req<Array<{
    site_id: string;
    site_name: string;
    zone: string;
    rainfall_records: number;
    water_depth_records: number;
    detection_records: number;
    latest_rainfall_mm: number | null;
    latest_update: string | null;
    coverage_status: string;
    warnings: string[];
  }>>('/observations/coverage');

export const importObservationsCsv = (file: File, importType = 'rainfall', mappingJson?: string) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('import_type', importType);
  if (mappingJson) fd.append('column_mapping_json', mappingJson);
  return fetch(`${BASE}/observations/import-csv`, { method: 'POST', body: fd }).then(async r => {
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Import failed'); }
    return r.json();
  });
};

// ---------- Detections ----------
export const getDetections = (siteId?: string, limit = 50) =>
  req<PlasticDetection[]>(`/detections${siteId ? `?site_id=${siteId}&limit=${limit}` : `?limit=${limit}`}`);

export const getSampleFeeds = () => req<SampleFeed[]>('/detections/samples');

export const analyzeSample = (filename: string, siteId?: string, confidence = 0.10, modelType = 'ground') => {
  const fd = new FormData();
  fd.append('sample_filename', filename);
  if (siteId) fd.append('site_id', siteId);
  fd.append('confidence_threshold', String(confidence));
  fd.append('model_type', modelType);
  fd.append('source_status', 'Simulated');
  return fetch(`${BASE}/detections/analyze-sample`, { method: 'POST', body: fd }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(formatError(err, r.status));
    }
    return r.json();
  });
};

export const analyzeUpload = (file: File, siteId?: string, confidence = 0.10, modelType = 'ground') => {
  const fd = new FormData();
  fd.append('file', file);
  if (siteId) fd.append('site_id', siteId);
  fd.append('confidence_threshold', String(confidence));
  fd.append('model_type', modelType);
  fd.append('source_status', 'Real');
  return fetch(`${BASE}/detections/analyze-upload`, { method: 'POST', body: fd }).then(async r => {
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Upload failed'); }
    return r.json();
  });
};

// ---------- Forecasts & Model Card ----------
export const getForecasts = (siteId?: string) =>
  req<RiskForecast[]>(`/forecasts${siteId ? `?site_id=${siteId}` : ''}`);

export const getSiteForecast = (siteId: string) =>
  req<{ site: MonitoringSite; latest_forecast: RiskForecast | null; live_prediction: Record<string, unknown>; input_conditions: Record<string, unknown> }>(`/forecasts/site/${siteId}`);

export const calculateForecast = (body: Record<string, unknown>) =>
  req<{ risk_score: number; risk_level: string; predicted_plastic_volume_kg: number; choke_probability_pct: number; action_recommendation: string; factors: Record<string, number> }>('/forecasts/calculate', { method: 'POST', body: JSON.stringify(body) });

export const getModelCardMetrics = () =>
  req<any>('/forecasts/model-card');

// ---------- Cleanup & Routing ----------
export interface RecommendationItem {
  site_id: string;
  site_name: string;
  zone: string;
  current_risk_score: number;
  current_risk_level: string;
  barrier_status: string;
  estimated_plastic_kg: number;
  urgency_rank: number;
  recommendation_reason: string;
  suggested_crew: string;
  suggested_equipment: string;
}

export interface RouteResult {
  crew_id: string;
  team_name: string;
  total_distance_km: number;
  total_duration_hours: number;
  transit_duration_hours: number;
  on_site_work_hours: number;
  stops: Array<{
    stop_index: number;
    site_id: string;
    name: string;
    latitude: number;
    longitude: number;
    arrival_time_offset_min: number;
    leg_distance_km: number;
    cumulative_distance_km: number;
    estimated_debris_kg: number;
    risk_level: string;
    urgency_reason: string;
  }>;
  polyline: Array<[number, number]>;
  unassigned_sites: Array<{ site_id: string; name: string; reason: string; risk_score: number }>;
  optimization_engine: string;
  source_status: string;
  disclaimer: string;
}

export const getCleanupTasks = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return req<CleanupTask[]>(`/cleanup${qs}`);
};

export const getCleanupRecommendations = (minRiskScore = 45.0) =>
  req<RecommendationItem[]>(`/cleanup/recommendations?min_risk_score=${minRiskScore}`);

export const optimizeCleanupRoute = (body: {
  site_ids?: string[];
  depot_lat?: number;
  depot_lon?: number;
  depot_name?: string;
  num_crews?: number;
  max_shift_hours?: number;
}) => req<RouteResult>('/cleanup/optimize-route', { method: 'POST', body: JSON.stringify(body) });

export const createCleanupTask = (data: Partial<CleanupTask>) =>
  req<CleanupTask>('/cleanup', { method: 'POST', body: JSON.stringify(data) });

export const updateCleanupTask = (id: number, data: Partial<CleanupTask>) =>
  req<CleanupTask>(`/cleanup/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

// ---------- Recovery & Auditing ----------
export interface AuditSummary {
  total_records: int;
  verified_records: int;
  pending_records: int;
  rejected_records: int;
  total_measured_kg: number;
  total_verified_kg: number;
  audit_chain_integrity: string;
  potential_epr_eligible_kg: number;
  disclaimer: string;
}
type int = number;

export const getRecoveryRecords = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return req<(RecoveryRecord & { audit_hash: string; epr_eligibility_status: string; epr_assessment_notes: string })[]>(`/recovery${qs}`);
};

export const getAuditSummary = () => req<AuditSummary>('/recovery/summary');

export const createRecoveryRecord = (data: Partial<RecoveryRecord>) =>
  req<RecoveryRecord>('/recovery', { method: 'POST', body: JSON.stringify(data) });

export const verifyRecovery = (id: number, status: string, verifier: string) =>
  req<RecoveryRecord>(`/recovery/${id}/verify`, { method: 'POST', body: JSON.stringify({ verification_status: status, verifier_name: verifier }) });

export const getExportCsvUrl = () => `${BASE}/recovery/export.csv`;

// ---------- Analytics ----------
export const getDashboardMetrics = () => req<DashboardMetrics>('/analytics/overview');
export const getBasinComparison = () => req<unknown[]>('/analytics/basin-comparison');
export const getPlasticComposition = () => req<unknown[]>('/analytics/plastic-composition');
export const getDataIntegrity = () => req<unknown[]>('/analytics/data-integrity');

// ---------- Simulation ----------
export const triggerStorm = (intensity: string, tide: number) =>
  req<unknown>('/simulation/trigger-storm', { method: 'POST', body: JSON.stringify({ intensity, tide_surge_m: tide }) });
export const clearSimulated = () => req<unknown>('/simulation/clear-simulated', { method: 'POST' });
export const resetDatabase = () => req<unknown>('/simulation/reset-database', { method: 'POST' });

// ---------- IoT Hardware Integration ----------
export interface IoTDevice {
  id: string;
  site_id: string;
  is_simulated: boolean;
  status: string;
  last_seen: string | null;
  battery_level: number | null;
  signal_strength: number | null;
  created_at: string;
}

export interface IoTSensorPayload {
  device_id: string;
  timestamp: string;
  water_level_cm: number;
  water_level_rate?: number;
  rainfall_mm?: number;
  camera_status?: string;
  plastic_detection?: string;
  battery_level?: number;
  signal_strength?: number;
}

export const getIoTDevices = (siteId?: string) =>
  req<IoTDevice[]>(`/iot/devices${siteId ? `?site_id=${siteId}` : ''}`);

export const registerIoTDevice = (data: Partial<IoTDevice>) =>
  req<IoTDevice>('/iot/devices', { method: 'POST', body: JSON.stringify(data) });

export const ingestIoTSensorData = (payload: IoTSensorPayload) =>
  req<{ status: string; device_id: string }>('/iot/ingest', { method: 'POST', body: JSON.stringify(payload) });

// ---------- Centralized Hotspots & Geofencing ----------
import type { UnifiedHotspot, HotspotSummary, SatelliteScene } from '../types';

export const getHotspots = (params?: Record<string, string | number | boolean>) => {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
  return req<UnifiedHotspot[]>(`/hotspots${qs}`);
};

export const getHotspotSummary = () => req<HotspotSummary>('/hotspots/summary');

export const getHotspotDetail = (id: string) => req<{
  hotspot: UnifiedHotspot;
  detection_details: Record<string, unknown>;
  associated_observations: UnifiedHotspot[];
  associated_count: number;
  cleanup_task?: unknown;
}>(`/hotspots/${id}`);

export const updateHotspot = (id: string, updates: Partial<UnifiedHotspot>) =>
  req<UnifiedHotspot>(`/hotspots/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });

export const dispatchCleanupForHotspot = (id: string, teamName?: string) =>
  req<{ status: string; task_id: number; hotspot_id: string }>(`/hotspots/${id}/dispatch-cleanup`, {
    method: 'POST',
    body: JSON.stringify({ team_name: teamName || 'BMC Quick Response Team' })
  });

export const getMumbaiBoundary = () => req<{
  type: string;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[][][] };
}>('/hotspots/boundary');

export const getUnlocatedQueue = () => req<UnifiedHotspot[]>('/hotspots/unlocated-queue');

// ---------- Drone Monitoring (Model A) ----------
export const uploadDroneImage = (formData: FormData) => {
  return fetch(`${BASE}/drone/upload`, {
    method: 'POST',
    body: formData,
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || 'Drone image processing failed');
    }
    return r.json();
  });
};

export const batchUploadDroneImages = (formData: FormData) => {
  return fetch(`${BASE}/drone/batch-upload`, {
    method: 'POST',
    body: formData,
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || 'Batch processing failed');
    }
    return r.json();
  });
};

// ---------- Drone Video Analysis (ReWater YOLOv8m) ----------
export const getSampleDroneVideos = () => {
  return req<any[]>('/drone/video/sample-videos');
};

export const uploadDroneVideo = (formData: FormData) => {
  return fetch(`${BASE}/drone/video/upload-and-analyze`, {
    method: 'POST',
    body: formData,
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || 'Drone video analysis failed');
    }
    return r.json();
  });
};

export const getDroneVideoJob = (jobId: string) => {
  return req<any>(`/drone/video/jobs/${jobId}`);
};

export const cancelDroneVideoJob = (jobId: string) => {
  return req<any>(`/drone/video/jobs/${jobId}/cancel`, { method: 'POST' });
};

export const retryDroneVideoJob = (jobId: string) => {
  return req<any>(`/drone/video/jobs/${jobId}/retry`, { method: 'POST' });
};

// ---------- Field Worker Image Reporting (Module 3) ----------
export const uploadWorkerReport = (formData: FormData) => {
  return fetch(`${BASE}/worker/upload-report`, {
    method: 'POST',
    body: formData,
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || 'Report submission failed');
    }
    return r.json();
  });
};

export const getWorkerReports = (status?: string) =>
  req<UnifiedHotspot[]>(`/worker/reports${status ? `?review_status=${status}` : ''}`);

export const updateWorkerReportAction = (reportId: string, action: string, notes?: string) => {
  const form = new FormData();
  form.append('action', action);
  if (notes) form.append('notes', notes);
  return fetch(`${BASE}/worker/reports/${reportId}/action`, {
    method: 'POST',
    body: form,
  }).then(async r => {
    if (!r.ok) throw new Error('Action failed');
    return r.json();
  });
};

// ---------- Satellite Marine Debris (Model B) ----------
export const getSatelliteScenes = () => req<SatelliteScene[]>('/satellite/scenes');

export const analyzeSatelliteUpload = (formData: FormData) => {
  return fetch(`${BASE}/satellite/analyze-upload`, {
    method: 'POST',
    body: formData,
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || 'Satellite analysis failed');
    }
    return r.json();
  });
};

export const analyzeSampleSatelliteScene = (sceneId: string, sourceStatus: string = 'Simulated') => {
  const form = new FormData();
  form.append('scene_id', sceneId);
  form.append('source_status', sourceStatus);
  return fetch(`${BASE}/satellite/analyze-sample-scene`, {
    method: 'POST',
    body: form,
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || 'Sample scene analysis failed');
    }
    return r.json();
  });
};
