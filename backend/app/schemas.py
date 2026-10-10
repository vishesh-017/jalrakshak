import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, ConfigDict

# Base Source Status Enum validation
SourceStatusType = str # "Real" | "Simulated" | "Manually entered" | "Imported"

# ==================== SITES ====================
class MonitoringSiteBase(BaseModel):
    id: str
    name: str
    zone: str
    location_description: str
    latitude: float
    longitude: float
    catchment_area_sqkm: float = 5.0
    upstream_urban_density: str = "High"
    barrier_type: str = "Trash Boom"
    barrier_status: str = "Operational"
    last_cleanup_date: Optional[str] = None
    response_status: str = "Normal Monitoring"
    current_risk_score: float = 25.0
    current_risk_level: str = "Low"
    is_pilot_active: bool = True

class MonitoringSiteCreate(MonitoringSiteBase):
    pass

class MonitoringSiteUpdate(BaseModel):
    name: Optional[str] = None
    zone: Optional[str] = None
    location_description: Optional[str] = None
    barrier_status: Optional[str] = None
    response_status: Optional[str] = None
    last_cleanup_date: Optional[str] = None
    current_risk_score: Optional[float] = None
    current_risk_level: Optional[str] = None
    is_pilot_active: Optional[bool] = None

class MonitoringSiteResponse(MonitoringSiteBase):
    created_at: datetime.datetime
    updated_at: datetime.datetime
    latest_rainfall: Optional[float] = None
    latest_water_depth: Optional[float] = None
    latest_detection_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

# ==================== RAINFALL ====================
class RainfallObservationCreate(BaseModel):
    site_id: str
    rainfall_1h_mm: float = Field(ge=0.0)
    rainfall_24h_mm: float = Field(ge=0.0)
    forecast_24h_mm: float = Field(ge=0.0)
    sensor_id: str = "ARG-MUM-01"
    source_status: SourceStatusType = "Real"

class RainfallObservationResponse(BaseModel):
    id: int
    site_id: str
    timestamp: datetime.datetime
    rainfall_1h_mm: float
    rainfall_24h_mm: float
    forecast_24h_mm: float
    sensor_id: str
    source_status: str

    model_config = ConfigDict(from_attributes=True)

# ==================== TIDE ====================
class TideObservationCreate(BaseModel):
    station_name: str = "Apollo Bunder / Gateway Gauge"
    tide_level_m: float
    tide_phase: str
    lunar_cycle: str = "Full Moon"
    source_status: SourceStatusType = "Real"

class TideObservationResponse(BaseModel):
    id: int
    timestamp: datetime.datetime
    station_name: str
    tide_level_m: float
    tide_phase: str
    lunar_cycle: str
    source_status: str

    model_config = ConfigDict(from_attributes=True)

# ==================== WATER LEVEL ====================
class WaterLevelObservationCreate(BaseModel):
    site_id: str
    water_depth_m: float = Field(ge=0.0)
    discharge_cumecs: float = Field(ge=0.0, default=0.0)
    flow_velocity_mps: float = Field(ge=0.0, default=0.0)
    source_status: SourceStatusType = "Real"

class WaterLevelObservationResponse(BaseModel):
    id: int
    site_id: str
    timestamp: datetime.datetime
    water_depth_m: float
    discharge_cumecs: float
    flow_velocity_mps: float
    source_status: str

    model_config = ConfigDict(from_attributes=True)

# ==================== DETECTION ====================
class BoundingBox(BaseModel):
    box: List[float] # [x1, y1, x2, y2]
    class_name: str
    confidence: float

class PlasticDetectionCreate(BaseModel):
    site_id: Optional[str] = None
    image_path: str
    image_source_type: str = "CCTV Creek Camera"
    total_objects_detected: int = 0
    plastic_bottle_count: int = 0
    plastic_bag_count: int = 0
    other_plastic_count: int = 0
    styrofoam_count: int = 0
    plastic_density_index: float = 0.0
    estimated_surface_mass_kg: float = 0.0
    confidence_avg: float = 0.0
    bounding_boxes_json: str = "[]"
    source_status: SourceStatusType = "Real"
    notes: Optional[str] = None

class PlasticDetectionResponse(BaseModel):
    id: int
    site_id: Optional[str]
    timestamp: datetime.datetime
    image_path: str
    image_source_type: str
    total_objects_detected: int
    plastic_bottle_count: int
    plastic_bag_count: int
    other_plastic_count: int
    styrofoam_count: int
    plastic_density_index: float
    estimated_surface_mass_kg: float
    confidence_avg: float
    bounding_boxes_json: str
    source_status: str
    notes: Optional[str]

    model_config = ConfigDict(from_attributes=True)

# ==================== RISK FORECAST ====================
class RiskForecastCreate(BaseModel):
    site_id: str
    horizon_hours: int = 24
    risk_score: float = Field(ge=0.0, le=100.0)
    risk_level: str
    predicted_plastic_volume_kg: float = 0.0
    choke_probability_pct: float = 0.0
    factors_json: str = "{}"
    action_recommendation: str
    source_status: SourceStatusType = "Real"

class RiskForecastResponse(BaseModel):
    id: int
    site_id: str
    timestamp: datetime.datetime
    horizon_hours: int
    risk_score: float
    risk_level: str
    predicted_plastic_volume_kg: float
    choke_probability_pct: float
    factors_json: str
    action_recommendation: str
    source_status: str

    model_config = ConfigDict(from_attributes=True)

# ==================== CLEANUP TASK ====================
class CleanupTaskCreate(BaseModel):
    site_id: str
    title: str
    priority: str = "Medium" # Low, Medium, High, Critical
    status: str = "Pending" # Pending, Dispatched, In Progress, Completed, Cancelled
    team_name: str
    equipment_assigned: str = "Trash Skimmer Boat"
    target_date: str
    estimated_load_kg: float = 0.0
    notes: Optional[str] = None

class CleanupTaskUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    team_name: Optional[str] = None
    equipment_assigned: Optional[str] = None
    target_date: Optional[str] = None
    estimated_load_kg: Optional[float] = None
    notes: Optional[str] = None

class CleanupTaskResponse(BaseModel):
    id: int
    site_id: str
    title: str
    priority: str
    status: str
    team_name: str
    equipment_assigned: str
    target_date: str
    dispatched_at: Optional[datetime.datetime]
    completed_at: Optional[datetime.datetime]
    notes: Optional[str]
    estimated_load_kg: float
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

# ==================== RECOVERY RECORD ====================
class RecoveryRecordCreate(BaseModel):
    task_id: Optional[int] = None
    site_id: str
    recovery_date: str
    total_weight_kg: float = Field(gt=0.0)
    pet_bottles_kg: float = 0.0
    polyethylene_bags_kg: float = 0.0
    multilayer_packaging_kg: float = 0.0
    styrofoam_and_hard_plastics_kg: float = 0.0
    disposal_facility: str
    manifest_number: Optional[str] = None
    verification_status: str = "Pending Verification"
    verifier_name: Optional[str] = None
    proof_image_url: Optional[str] = None
    source_status: SourceStatusType = "Real"

class RecoveryRecordVerificationUpdate(BaseModel):
    verification_status: str
    verifier_name: str

class RecoveryRecordResponse(BaseModel):
    id: int
    task_id: Optional[int]
    site_id: str
    recovery_date: str
    total_weight_kg: float
    pet_bottles_kg: float
    polyethylene_bags_kg: float
    multilayer_packaging_kg: float
    styrofoam_and_hard_plastics_kg: float
    disposal_facility: str
    manifest_number: str
    verification_status: str
    verifier_name: Optional[str]
    proof_image_url: Optional[str]
    source_status: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

# ==================== IOT DEVICES ====================
class IoTDeviceBase(BaseModel):
    id: str
    site_id: str
    is_simulated: bool = True
    status: str = "Offline"
    battery_level: Optional[float] = None
    signal_strength: Optional[float] = None

class IoTDeviceCreate(IoTDeviceBase):
    pass

class IoTDeviceUpdate(BaseModel):
    is_simulated: Optional[bool] = None
    status: Optional[str] = None
    last_seen: Optional[datetime.datetime] = None
    battery_level: Optional[float] = None
    signal_strength: Optional[float] = None

class IoTDeviceResponse(IoTDeviceBase):
    last_seen: Optional[datetime.datetime]
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class IoTSensorPayload(BaseModel):
    device_id: str
    timestamp: datetime.datetime
    water_level_cm: float
    water_level_rate: float = 0.0
    rainfall_mm: Optional[float] = None
    camera_status: str = "Operational"
    plastic_detection: Optional[str] = None # "High", "Medium", "Low"
    battery_level: Optional[float] = None
    signal_strength: Optional[float] = None

# ==================== OVERVIEW DASHBOARD METRICS ====================
class DashboardOverviewMetrics(BaseModel):
    total_monitored_sites: int
    high_risk_outlets_count: int
    active_alerts_count: int
    pending_cleanup_tasks_count: int
    verified_plastic_recovered_kg: float
    total_plastic_recovered_kg: float
    recent_detections_count: int
    source_breakdown: Dict[str, int]
    high_priority_sites: List[MonitoringSiteResponse]
    risk_trend_recent: List[Dict[str, Any]]
    rainfall_accumulation_chart: List[Dict[str, Any]]

# ==================== UNIFIED HOTSPOTS (ALL 3 MODULES) ====================
class UnifiedHotspotBase(BaseModel):
    title: str
    source_type: str # "iot", "satellite", "drone", "field_worker"
    source_status: SourceStatusType = "Real"
    device_or_reporter_id: Optional[str] = None
    site_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    boundary_status: str = "VALID_MUMBAI" # "VALID_MUMBAI", "OUTSIDE_BOUNDARY", "UNLOCATED_REVIEW"
    boundary_notes: Optional[str] = None
    location_method: str = "OPERATOR_PINNED" # "GPS_EXIF", "GEOREFERENCED_RASTER", "IOT_REGISTERED_COORDINATE", "OPERATOR_PINNED", "UNLOCATED"
    coordinate_accuracy_m: Optional[float] = None
    detection_result_json: str = "{}"
    plastic_detected: bool = False
    estimated_debris_kg: float = 0.0
    confidence_avg: float = 0.0
    water_level_m: Optional[float] = None
    rainfall_mm: Optional[float] = None
    evidence_url: Optional[str] = None
    event_timestamp: Optional[datetime.datetime] = None
    risk_score: float = 25.0
    risk_category: str = "Low"
    risk_explanation: str = ""
    review_status: str = "Verified"
    cleanup_status: str = "Unassigned"
    cleanup_task_id: Optional[int] = None
    parent_hotspot_id: Optional[str] = None
    associated_observations_count: int = 1
    notes: Optional[str] = None

class UnifiedHotspotCreate(UnifiedHotspotBase):
    id: Optional[str] = None

class UnifiedHotspotUpdate(BaseModel):
    title: Optional[str] = None
    review_status: Optional[str] = None
    cleanup_status: Optional[str] = None
    cleanup_task_id: Optional[int] = None
    risk_score: Optional[float] = None
    risk_category: Optional[str] = None
    risk_explanation: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    boundary_status: Optional[str] = None
    location_method: Optional[str] = None

class UnifiedHotspotResponse(UnifiedHotspotBase):
    id: str
    ingestion_timestamp: datetime.datetime
    event_timestamp: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class DroneIngestRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    flight_id: Optional[str] = None
    altitude_m: Optional[float] = None
    notes: Optional[str] = None
    source_status: SourceStatusType = "Real"

class SatelliteIngestRequest(BaseModel):
    provider: str = "Sentinel-2" # Sentinel-2, PlanetScope, Landsat-9
    scene_id: str
    acquisition_date: str
    target_creek_area: str # Mithi, Malad, Thane, Gorai
    raster_bounds: Dict[str, float] # min_lat, max_lat, min_lon, max_lon
    detected_pixel_x: Optional[float] = None
    detected_pixel_y: Optional[float] = None
    slick_area_sqm: float = 120.0
    confidence: float = 0.82
    source_status: SourceStatusType = "Real"

class WorkerReportCreate(BaseModel):
    reporter_id: str
    reporter_name: str
    category: str # "Culvert Choke", "Floating Boom Jam", "Mangrove Plastic Slick", "Illegal Nullah Dumping"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_description: Optional[str] = None
    notes: Optional[str] = None
    source_status: SourceStatusType = "Real"
