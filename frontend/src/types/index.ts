export type SourceStatus = 'Real' | 'Simulated' | 'Manually entered' | 'Imported';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Pending' | 'Dispatched' | 'In Progress' | 'Completed' | 'Cancelled';
export type VerificationStatus = 'Verified' | 'Pending Verification' | 'Rejected';

export interface MonitoringSite {
  id: string;
  name: string;
  zone: string;
  location_description: string;
  latitude: float;
  longitude: float;
  catchment_area_sqkm: number;
  upstream_urban_density: string;
  barrier_type: string;
  barrier_status: string;
  last_cleanup_date?: string;
  response_status: string;
  current_risk_score: number;
  current_risk_level: RiskLevel;
  is_pilot_active: boolean;
  created_at: string;
  updated_at: string;
  latest_rainfall?: number;
  latest_water_depth?: number;
  latest_detection_count?: number;
}

type float = number;

export interface RainfallObservation {
  id: number;
  site_id: string;
  timestamp: string;
  rainfall_1h_mm: number;
  rainfall_24h_mm: number;
  forecast_24h_mm: number;
  sensor_id: string;
  source_status: SourceStatus;
}

export interface TideObservation {
  id: number;
  timestamp: string;
  station_name: string;
  tide_level_m: number;
  tide_phase: string;
  lunar_cycle: string;
  source_status: SourceStatus;
}

export interface WaterLevelObservation {
  id: number;
  site_id: string;
  timestamp: string;
  water_depth_m: number;
  discharge_cumecs: number;
  flow_velocity_mps: number;
  source_status: SourceStatus;
}

export interface BoundingBoxItem {
  box: [number, number, number, number];
  box_normalized?: [number, number, number, number];
  class_name: 'PLASTIC_BOTTLE' | 'PLASTIC_BAG' | 'OTHER_PLASTIC_WASTE' | 'STYROFOAM_FRAGMENT' | string;
  confidence: number;
  color?: string;
}

export interface PlasticDetection {
  id: number;
  site_id?: string;
  timestamp: string;
  image_path: string;
  image_source_type: string;
  total_objects_detected: number;
  plastic_bottle_count: number;
  plastic_bag_count: number;
  other_plastic_count: number;
  styrofoam_count: number;
  plastic_density_index: number;
  estimated_surface_mass_kg: number;
  confidence_avg: number;
  bounding_boxes_json: string;
  source_status: SourceStatus;
  notes?: string;
}

export interface RiskForecast {
  id: number;
  site_id: string;
  timestamp: string;
  horizon_hours: number;
  risk_score: number;
  risk_level: RiskLevel;
  predicted_plastic_volume_kg: number;
  choke_probability_pct: number;
  factors_json: string;
  action_recommendation: string;
  source_status: SourceStatus;
}

export interface CleanupTask {
  id: number;
  site_id: string;
  title: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: TaskStatus;
  team_name: string;
  equipment_assigned: string;
  target_date: string;
  dispatched_at?: string;
  completed_at?: string;
  notes?: string;
  estimated_load_kg: number;
  created_at: string;
}

export interface RecoveryRecord {
  id: number;
  task_id?: number;
  site_id: string;
  recovery_date: string;
  total_weight_kg: number;
  pet_bottles_kg: number;
  polyethylene_bags_kg: number;
  multilayer_packaging_kg: number;
  styrofoam_and_hard_plastics_kg: number;
  disposal_facility: string;
  manifest_number: string;
  verification_status: VerificationStatus;
  verifier_name?: string;
  proof_image_url?: string;
  source_status: SourceStatus;
  created_at: string;
}

export interface DashboardMetrics {
  total_monitored_sites: number;
  high_risk_outlets_count: number;
  active_alerts_count: number;
  pending_cleanup_tasks_count: number;
  verified_plastic_recovered_kg: number;
  total_plastic_recovered_kg: number;
  recent_detections_count: number;
  source_breakdown: Record<SourceStatus, number>;
  high_priority_sites: MonitoringSite[];
  risk_trend_recent: Array<{ time: string; mithi_risk: number; malad_risk: number; trombay_risk: number }>;
  rainfall_accumulation_chart: Array<{ day: string; rainfall_mm: number; plastic_accumulated_kg: number; recovered_kg: number }>;
}

export interface SampleFeed {
  id: string;
  filename: string;
  name: string;
  site_id: string;
  source_type: string;
  url: string;
}
