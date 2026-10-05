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

export const analyzeSample = (filename: string, siteId?: string, confidence = 0.45, modelType = 'ground') => {
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

export const analyzeUpload = (file: File, siteId?: string, confidence = 0.45, modelType = 'ground') => {
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
export const resetDatabase = () => req<unknown>('/simulation/reset-demo-database', { method: 'POST' });
