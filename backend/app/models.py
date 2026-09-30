import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class MonitoringSite(Base):
    __tablename__ = "monitoring_sites"

    id = Column(String, primary_key=True, index=True) # e.g. MTH-01
    name = Column(String, nullable=False, index=True)
    zone = Column(String, nullable=False, index=True) # "Mithi River Basin", "Malad Creek Basin", "Trombay / Thane Creek Basin"
    location_description = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    catchment_area_sqkm = Column(Float, default=5.0)
    upstream_urban_density = Column(String, default="High") # Low, Moderate, High, Very High
    barrier_type = Column(String, default="Trash Boom") # Floating Trash Boom, Trash Screen, Sluice Gate, Open Outfall
    barrier_status = Column(String, default="Operational") # Operational, Partially Blocked, Breached, Maintenance
    last_cleanup_date = Column(String, nullable=True) # YYYY-MM-DD
    response_status = Column(String, default="Normal Monitoring") # Normal Monitoring, Watch Alert, Cleanup Dispatched, Emergency Action
    current_risk_score = Column(Float, default=25.0) # 0-100
    current_risk_level = Column(String, default="Low") # Low, Medium, High, Critical
    is_pilot_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    rainfall_observations = relationship("RainfallObservation", back_populates="site", cascade="all, delete-orphan")
    water_level_observations = relationship("WaterLevelObservation", back_populates="site", cascade="all, delete-orphan")
    detections = relationship("PlasticDetection", back_populates="site", cascade="all, delete-orphan")
    forecasts = relationship("RiskForecast", back_populates="site", cascade="all, delete-orphan")
    cleanup_tasks = relationship("CleanupTask", back_populates="site", cascade="all, delete-orphan")
    recovery_records = relationship("RecoveryRecord", back_populates="site", cascade="all, delete-orphan")


class RainfallObservation(Base):
    __tablename__ = "rainfall_observations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    site_id = Column(String, ForeignKey("monitoring_sites.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    rainfall_1h_mm = Column(Float, default=0.0)
    rainfall_24h_mm = Column(Float, default=0.0)
    forecast_24h_mm = Column(Float, default=0.0)
    sensor_id = Column(String, default="ARG-MUM-01")
    # Source Status: Real, Simulated, Manually entered, Imported
    source_status = Column(String, nullable=False, default="Real")

    site = relationship("MonitoringSite", back_populates="rainfall_observations")


class TideObservation(Base):
    __tablename__ = "tide_observations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    station_name = Column(String, default="Apollo Bunder / Gateway Gauge")
    tide_level_m = Column(Float, nullable=False) # e.g. 3.85 meters
    tide_phase = Column(String, nullable=False) # High Tide (Spring), Ebb Tide, Low Tide (Neap), Flood Tide
    lunar_cycle = Column(String, default="Full Moon") # Full Moon, New Moon, First Quarter, Third Quarter
    # Source Status: Real, Simulated, Manually entered, Imported
    source_status = Column(String, nullable=False, default="Real")


class WaterLevelObservation(Base):
    __tablename__ = "water_level_observations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    site_id = Column(String, ForeignKey("monitoring_sites.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    water_depth_m = Column(Float, nullable=False) # Culvert/water depth in meters
    discharge_cumecs = Column(Float, default=0.0) # Flow discharge m3/s
    flow_velocity_mps = Column(Float, default=0.0) # Velocity m/s
    # Source Status: Real, Simulated, Manually entered, Imported
    source_status = Column(String, nullable=False, default="Real")

    site = relationship("MonitoringSite", back_populates="water_level_observations")


class PlasticDetection(Base):
    __tablename__ = "plastic_detections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    site_id = Column(String, ForeignKey("monitoring_sites.id"), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    image_path = Column(String, nullable=False)
    image_source_type = Column(String, default="CCTV Creek Camera") # CCTV Creek Camera, Drone Aerial Survey, Mobile Patrol, Citizen Upload
    total_objects_detected = Column(Integer, default=0)
    plastic_bottle_count = Column(Integer, default=0)
    plastic_bag_count = Column(Integer, default=0)
    other_plastic_count = Column(Integer, default=0)
    styrofoam_count = Column(Integer, default=0)
    plastic_density_index = Column(Float, default=0.0) # items / sq. meter
    estimated_surface_mass_kg = Column(Float, default=0.0)
    confidence_avg = Column(Float, default=0.0)
    bounding_boxes_json = Column(Text, default="[]") # serialized JSON list of boxes
    # Source Status: Real, Simulated, Manually entered, Imported
    source_status = Column(String, nullable=False, default="Real")
    notes = Column(String, nullable=True)

    site = relationship("MonitoringSite", back_populates="detections")


class RiskForecast(Base):
    __tablename__ = "risk_forecasts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    site_id = Column(String, ForeignKey("monitoring_sites.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    horizon_hours = Column(Integer, default=24) # 24, 48, 72
    risk_score = Column(Float, nullable=False) # 0 to 100
    risk_level = Column(String, nullable=False) # Low, Medium, High, Critical
    predicted_plastic_volume_kg = Column(Float, default=0.0)
    choke_probability_pct = Column(Float, default=0.0)
    factors_json = Column(Text, default="{}") # Contributing weights: rainfall, tide, urban_density, barrier_vulnerability
    action_recommendation = Column(String, nullable=False)
    # Source Status: Real, Simulated, Manually entered, Imported
    source_status = Column(String, nullable=False, default="Real")

    site = relationship("MonitoringSite", back_populates="forecasts")


class CleanupTask(Base):
    __tablename__ = "cleanup_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    site_id = Column(String, ForeignKey("monitoring_sites.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    priority = Column(String, default="Medium") # Low, Medium, High, Critical
    status = Column(String, default="Pending") # Pending, Dispatched, In Progress, Completed, Cancelled
    team_name = Column(String, nullable=False)
    equipment_assigned = Column(String, default="Trash Skimmer Boat")
    target_date = Column(String, nullable=False) # YYYY-MM-DD
    dispatched_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    estimated_load_kg = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    site = relationship("MonitoringSite", back_populates="cleanup_tasks")
    recovery_record = relationship("RecoveryRecord", back_populates="task", uselist=False)


class RecoveryRecord(Base):
    __tablename__ = "recovery_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("cleanup_tasks.id"), nullable=True, index=True)
    site_id = Column(String, ForeignKey("monitoring_sites.id"), nullable=False, index=True)
    recovery_date = Column(String, nullable=False) # YYYY-MM-DD
    total_weight_kg = Column(Float, nullable=False)
    pet_bottles_kg = Column(Float, default=0.0)
    polyethylene_bags_kg = Column(Float, default=0.0)
    multilayer_packaging_kg = Column(Float, default=0.0)
    styrofoam_and_hard_plastics_kg = Column(Float, default=0.0)
    disposal_facility = Column(String, nullable=False)
    manifest_number = Column(String, nullable=False, unique=True, index=True)
    # Verification Status: Verified, Pending Verification, Rejected
    verification_status = Column(String, default="Pending Verification", index=True)
    verifier_name = Column(String, nullable=True)
    proof_image_url = Column(String, nullable=True)
    # Source Status: Real, Simulated, Manually entered, Imported
    source_status = Column(String, nullable=False, default="Real")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    site = relationship("MonitoringSite", back_populates="recovery_records")
    task = relationship("CleanupTask", back_populates="recovery_record")
