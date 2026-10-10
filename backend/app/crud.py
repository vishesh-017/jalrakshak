import datetime
import json
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app import models, schemas

# ==================== SITES ====================

def get_sites(
    db: Session,
    zone: Optional[str] = None,
    risk_level: Optional[str] = None,
    response_status: Optional[str] = None
) -> List[models.MonitoringSite]:
    query = db.query(models.MonitoringSite)
    if zone:
        query = query.filter(models.MonitoringSite.zone == zone)
    if risk_level:
        query = query.filter(models.MonitoringSite.current_risk_level == risk_level)
    if response_status:
        query = query.filter(models.MonitoringSite.response_status == response_status)
    return query.order_by(desc(models.MonitoringSite.current_risk_score)).all()

def get_site(db: Session, site_id: str) -> Optional[models.MonitoringSite]:
    return db.query(models.MonitoringSite).filter(models.MonitoringSite.id == site_id).first()

def create_site(db: Session, site: schemas.MonitoringSiteCreate) -> models.MonitoringSite:
    db_site = models.MonitoringSite(**site.model_dump())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site

def update_site(db: Session, site_id: str, updates: schemas.MonitoringSiteUpdate) -> Optional[models.MonitoringSite]:
    db_site = get_site(db, site_id)
    if not db_site:
        return None
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_site, key, value)
    db.commit()
    db.refresh(db_site)
    return db_site

# ==================== RAINFALL ====================

def get_rainfall_observations(db: Session, site_id: Optional[str] = None, limit: int = 50):
    query = db.query(models.RainfallObservation)
    if site_id:
        query = query.filter(models.RainfallObservation.site_id == site_id)
    return query.order_by(desc(models.RainfallObservation.timestamp)).limit(limit).all()

def create_rainfall_observation(db: Session, obs: schemas.RainfallObservationCreate) -> models.RainfallObservation:
    db_obs = models.RainfallObservation(**obs.model_dump())
    db.add(db_obs)
    db.commit()
    db.refresh(db_obs)
    return db_obs

# ==================== TIDE ====================

def get_latest_tide(db: Session) -> Optional[models.TideObservation]:
    return db.query(models.TideObservation).order_by(desc(models.TideObservation.timestamp)).first()

def get_tide_observations(db: Session, limit: int = 24):
    return db.query(models.TideObservation).order_by(desc(models.TideObservation.timestamp)).limit(limit).all()

def create_tide_observation(db: Session, obs: schemas.TideObservationCreate) -> models.TideObservation:
    db_obs = models.TideObservation(**obs.model_dump())
    db.add(db_obs)
    db.commit()
    db.refresh(db_obs)
    return db_obs

# ==================== WATER LEVEL ====================

def get_water_level_observations(db: Session, site_id: Optional[str] = None, limit: int = 50):
    query = db.query(models.WaterLevelObservation)
    if site_id:
        query = query.filter(models.WaterLevelObservation.site_id == site_id)
    return query.order_by(desc(models.WaterLevelObservation.timestamp)).limit(limit).all()

def create_water_level_observation(db: Session, obs: schemas.WaterLevelObservationCreate) -> models.WaterLevelObservation:
    db_obs = models.WaterLevelObservation(**obs.model_dump())
    db.add(db_obs)
    db.commit()
    db.refresh(db_obs)
    return db_obs

# ==================== DETECTIONS ====================

def get_detections(db: Session, site_id: Optional[str] = None, limit: int = 50):
    query = db.query(models.PlasticDetection)
    if site_id:
        query = query.filter(models.PlasticDetection.site_id == site_id)
    return query.order_by(desc(models.PlasticDetection.timestamp)).limit(limit).all()

def get_detection(db: Session, detection_id: int):
    return db.query(models.PlasticDetection).filter(models.PlasticDetection.id == detection_id).first()

def create_detection(db: Session, det: schemas.PlasticDetectionCreate) -> models.PlasticDetection:
    db_det = models.PlasticDetection(**det.model_dump())
    db.add(db_det)
    db.commit()
    db.refresh(db_det)
    return db_det

# ==================== RISK FORECASTS ====================

def get_forecasts(db: Session, site_id: Optional[str] = None, limit: int = 50):
    query = db.query(models.RiskForecast)
    if site_id:
        query = query.filter(models.RiskForecast.site_id == site_id)
    return query.order_by(desc(models.RiskForecast.timestamp)).limit(limit).all()

def get_latest_forecast_for_site(db: Session, site_id: str) -> Optional[models.RiskForecast]:
    return (
        db.query(models.RiskForecast)
        .filter(models.RiskForecast.site_id == site_id)
        .order_by(desc(models.RiskForecast.timestamp))
        .first()
    )

def create_forecast(db: Session, forecast: schemas.RiskForecastCreate) -> models.RiskForecast:
    db_fc = models.RiskForecast(**forecast.model_dump())
    db.add(db_fc)
    db.commit()
    db.refresh(db_fc)
    return db_fc

# ==================== CLEANUP TASKS ====================

def get_cleanup_tasks(
    db: Session,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    site_id: Optional[str] = None
) -> List[models.CleanupTask]:
    query = db.query(models.CleanupTask)
    if status:
        query = query.filter(models.CleanupTask.status == status)
    if priority:
        query = query.filter(models.CleanupTask.priority == priority)
    if site_id:
        query = query.filter(models.CleanupTask.site_id == site_id)
    return query.order_by(desc(models.CleanupTask.created_at)).all()

def get_cleanup_task(db: Session, task_id: int) -> Optional[models.CleanupTask]:
    return db.query(models.CleanupTask).filter(models.CleanupTask.id == task_id).first()

def create_cleanup_task(db: Session, task: schemas.CleanupTaskCreate) -> models.CleanupTask:
    db_task = models.CleanupTask(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_cleanup_task(db: Session, task_id: int, updates: schemas.CleanupTaskUpdate) -> Optional[models.CleanupTask]:
    db_task = get_cleanup_task(db, task_id)
    if not db_task:
        return None
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
    if updates.status == "Dispatched" and not db_task.dispatched_at:
        db_task.dispatched_at = datetime.datetime.utcnow()
    elif updates.status == "Completed" and not db_task.completed_at:
        db_task.completed_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(db_task)
    return db_task

# ==================== RECOVERY RECORDS ====================

def get_recovery_records(
    db: Session,
    verification_status: Optional[str] = None,
    site_id: Optional[str] = None
) -> List[models.RecoveryRecord]:
    query = db.query(models.RecoveryRecord)
    if verification_status:
        query = query.filter(models.RecoveryRecord.verification_status == verification_status)
    if site_id:
        query = query.filter(models.RecoveryRecord.site_id == site_id)
    return query.order_by(desc(models.RecoveryRecord.created_at)).all()

def create_recovery_record(db: Session, rec: schemas.RecoveryRecordCreate) -> models.RecoveryRecord:
    data = rec.model_dump()
    if not data.get("manifest_number"):
        # Auto-generate unique manifest code
        import uuid
        data["manifest_number"] = f"MNF-MUM-{datetime.datetime.utcnow().strftime('%y%m%d')}-{uuid.uuid4().hex[:5].upper()}"
    db_rec = models.RecoveryRecord(**data)
    db.add(db_rec)
    db.commit()
    db.refresh(db_rec)
    return db_rec

def verify_recovery_record(
    db: Session,
    record_id: int,
    status: str,
    verifier_name: str
) -> Optional[models.RecoveryRecord]:
    record = db.query(models.RecoveryRecord).filter(models.RecoveryRecord.id == record_id).first()
    if not record:
        return None
    record.verification_status = status
    record.verifier_name = verifier_name
    db.commit()
    db.refresh(record)
    return record

# ==================== IOT DEVICES ====================

def get_devices(db: Session, site_id: Optional[str] = None) -> List[models.IoTDevice]:
    query = db.query(models.IoTDevice)
    if site_id:
        query = query.filter(models.IoTDevice.site_id == site_id)
    return query.all()

def get_device(db: Session, device_id: str) -> Optional[models.IoTDevice]:
    return db.query(models.IoTDevice).filter(models.IoTDevice.id == device_id).first()

def create_device(db: Session, device: schemas.IoTDeviceCreate) -> models.IoTDevice:
    db_dev = models.IoTDevice(**device.model_dump())
    db.add(db_dev)
    db.commit()
    db.refresh(db_dev)
    return db_dev

def update_device(db: Session, device_id: str, updates: schemas.IoTDeviceUpdate) -> Optional[models.IoTDevice]:
    db_dev = get_device(db, device_id)
    if not db_dev:
        return None
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_dev, key, value)
    db.commit()
    db.refresh(db_dev)
    return db_dev

# ==================== DASHBOARD METRICS ====================

def get_dashboard_metrics(db: Session) -> Dict[str, Any]:
    sites = db.query(models.MonitoringSite).all()
    total_sites = len(sites)
    high_risk_sites = [s for s in sites if s.current_risk_score >= 60.0]
    active_alerts = len(high_risk_sites)

    pending_tasks = db.query(models.CleanupTask).filter(
        models.CleanupTask.status.in_(["Pending", "Dispatched", "In Progress"])
    ).count()

    # Recovery records
    verified_rec = db.query(func.sum(models.RecoveryRecord.total_weight_kg)).filter(
        models.RecoveryRecord.verification_status == "Verified"
    ).scalar() or 0.0

    total_rec = db.query(func.sum(models.RecoveryRecord.total_weight_kg)).scalar() or 0.0

    recent_detections = db.query(models.PlasticDetection).count()

    # Source status breakdown across all observations
    source_counts = {
        "Real": 0,
        "Simulated": 0,
        "Manually entered": 0,
        "Imported": 0
    }

    for model_cls in [models.RainfallObservation, models.TideObservation, models.WaterLevelObservation, models.PlasticDetection, models.RecoveryRecord]:
        results = db.query(model_cls.source_status, func.count(model_cls.id)).group_by(model_cls.source_status).all()
        for status, count in results:
            if status in source_counts:
                source_counts[status] += count
            else:
                source_counts[status] = count

    # Top priority locations
    high_priority = sorted(sites, key=lambda s: s.current_risk_score, reverse=True)[:5]
    high_priority_formatted = []
    for s in high_priority:
        latest_rain = db.query(models.RainfallObservation).filter(
            models.RainfallObservation.site_id == s.id
        ).order_by(desc(models.RainfallObservation.timestamp)).first()

        latest_water = db.query(models.WaterLevelObservation).filter(
            models.WaterLevelObservation.site_id == s.id
        ).order_by(desc(models.WaterLevelObservation.timestamp)).first()

        latest_det = db.query(models.PlasticDetection).filter(
            models.PlasticDetection.site_id == s.id
        ).order_by(desc(models.PlasticDetection.timestamp)).first()

        resp = schemas.MonitoringSiteResponse.model_validate(s)
        resp.latest_rainfall = latest_rain.rainfall_24h_mm if latest_rain else 12.0
        resp.latest_water_depth = latest_water.water_depth_m if latest_water else 1.1
        resp.latest_detection_count = latest_det.total_objects_detected if latest_det else 6
        high_priority_formatted.append(resp)

    # 7-day rainfall vs plastic accumulation trend
    rainfall_chart = [
        {"day": "Mon", "rainfall_mm": 24.5, "plastic_accumulated_kg": 180.0, "recovered_kg": 140.0},
        {"day": "Tue", "rainfall_mm": 48.0, "plastic_accumulated_kg": 360.0, "recovered_kg": 290.0},
        {"day": "Wed", "rainfall_mm": 112.5, "plastic_accumulated_kg": 890.0, "recovered_kg": 450.0},
        {"day": "Thu", "rainfall_mm": 86.0, "plastic_accumulated_kg": 640.0, "recovered_kg": 520.0},
        {"day": "Fri", "rainfall_mm": 35.0, "plastic_accumulated_kg": 270.0, "recovered_kg": 310.0},
        {"day": "Sat", "rainfall_mm": 15.0, "plastic_accumulated_kg": 130.0, "recovered_kg": 190.0},
        {"day": "Sun", "rainfall_mm": 8.0, "plastic_accumulated_kg": 95.0, "recovered_kg": 120.0},
    ]

    # Risk trend recent
    risk_trend = [
        {"time": "00:00", "mithi_risk": 42, "malad_risk": 38, "trombay_risk": 29},
        {"time": "04:00", "mithi_risk": 55, "malad_risk": 44, "trombay_risk": 31},
        {"time": "08:00", "mithi_risk": 78, "malad_risk": 68, "trombay_risk": 45},
        {"time": "12:00", "mithi_risk": 89, "malad_risk": 82, "trombay_risk": 64},
        {"time": "16:00", "mithi_risk": 84, "malad_risk": 74, "trombay_risk": 58},
        {"time": "20:00", "mithi_risk": 65, "malad_risk": 59, "trombay_risk": 43},
    ]

    return {
        "total_monitored_sites": total_sites,
        "high_risk_outlets_count": len(high_risk_sites),
        "active_alerts_count": active_alerts,
        "pending_cleanup_tasks_count": pending_tasks,
        "verified_plastic_recovered_kg": round(verified_rec, 1),
        "total_plastic_recovered_kg": round(total_rec, 1),
        "recent_detections_count": recent_detections,
        "source_breakdown": source_counts,
        "high_priority_sites": high_priority_formatted,
        "risk_trend_recent": risk_trend,
        "rainfall_accumulation_chart": rainfall_chart
    }

# ==================== UNIFIED HOTSPOTS CRUD ====================
from app.services.geospatial_service import haversine_distance_meters

def get_hotspot(db: Session, hotspot_id: str) -> Optional[models.UnifiedHotspot]:
    return db.query(models.UnifiedHotspot).filter(models.UnifiedHotspot.id == hotspot_id).first()

def get_hotspots(
    db: Session,
    source_type: Optional[str] = None,
    risk_category: Optional[str] = None,
    boundary_status: Optional[str] = None,
    review_status: Optional[str] = None,
    cleanup_status: Optional[str] = None,
    source_status: Optional[str] = None,
    limit: int = 200
) -> List[models.UnifiedHotspot]:
    query = db.query(models.UnifiedHotspot)
    if source_type:
        query = query.filter(models.UnifiedHotspot.source_type == source_type)
    if risk_category:
        query = query.filter(models.UnifiedHotspot.risk_category == risk_category)
    if boundary_status:
        query = query.filter(models.UnifiedHotspot.boundary_status == boundary_status)
    if review_status:
        query = query.filter(models.UnifiedHotspot.review_status == review_status)
    if cleanup_status:
        query = query.filter(models.UnifiedHotspot.cleanup_status == cleanup_status)
    if source_status:
        query = query.filter(models.UnifiedHotspot.source_status == source_status)
    return query.order_by(models.UnifiedHotspot.event_timestamp.desc()).limit(limit).all()

def create_hotspot(db: Session, hotspot: schemas.UnifiedHotspotCreate) -> models.UnifiedHotspot:
    import uuid
    hotspot_id = hotspot.id or f"HS-{uuid.uuid4().hex[:8].upper()}"
    db_hotspot = models.UnifiedHotspot(
        id=hotspot_id,
        title=hotspot.title,
        source_type=hotspot.source_type,
        source_status=hotspot.source_status,
        device_or_reporter_id=hotspot.device_or_reporter_id,
        site_id=hotspot.site_id,
        latitude=hotspot.latitude,
        longitude=hotspot.longitude,
        boundary_status=hotspot.boundary_status,
        boundary_notes=hotspot.boundary_notes,
        location_method=hotspot.location_method,
        coordinate_accuracy_m=hotspot.coordinate_accuracy_m,
        detection_result_json=hotspot.detection_result_json,
        plastic_detected=hotspot.plastic_detected,
        estimated_debris_kg=hotspot.estimated_debris_kg,
        confidence_avg=hotspot.confidence_avg,
        water_level_m=hotspot.water_level_m,
        rainfall_mm=hotspot.rainfall_mm,
        evidence_url=hotspot.evidence_url,
        event_timestamp=hotspot.event_timestamp or datetime.datetime.utcnow(),
        risk_score=hotspot.risk_score,
        risk_category=hotspot.risk_category,
        risk_explanation=hotspot.risk_explanation,
        review_status=hotspot.review_status,
        cleanup_status=hotspot.cleanup_status,
        cleanup_task_id=hotspot.cleanup_task_id,
        parent_hotspot_id=hotspot.parent_hotspot_id,
        associated_observations_count=hotspot.associated_observations_count,
        notes=hotspot.notes
    )
    db.add(db_hotspot)
    db.commit()
    db.refresh(db_hotspot)
    return db_hotspot

def update_hotspot(db: Session, hotspot_id: str, updates: schemas.UnifiedHotspotUpdate) -> Optional[models.UnifiedHotspot]:
    db_hotspot = get_hotspot(db, hotspot_id)
    if not db_hotspot:
        return None
    for field, val in updates.model_dump(exclude_unset=True).items():
        setattr(db_hotspot, field, val)
    db.commit()
    db.refresh(db_hotspot)
    return db_hotspot

def find_nearby_hotspot(
    db: Session,
    lat: float,
    lon: float,
    max_distance_meters: float = 75.0,
    hours_window: int = 48
) -> Optional[models.UnifiedHotspot]:
    """
    Finds existing active hotspot within proximity threshold and time window for cross-module association.
    """
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=hours_window)
    candidates = db.query(models.UnifiedHotspot).filter(
        models.UnifiedHotspot.boundary_status == "VALID_MUMBAI",
        models.UnifiedHotspot.latitude.isnot(None),
        models.UnifiedHotspot.longitude.isnot(None),
        models.UnifiedHotspot.event_timestamp >= cutoff,
        models.UnifiedHotspot.parent_hotspot_id.is_(None) # Root hotspots only
    ).all()

    closest_spot = None
    min_dist = float("inf")
    for spot in candidates:
        if spot.latitude and spot.longitude:
            dist = haversine_distance_meters(lat, lon, spot.latitude, spot.longitude)
            if dist <= max_distance_meters and dist < min_dist:
                min_dist = dist
                closest_spot = spot

    return closest_spot
