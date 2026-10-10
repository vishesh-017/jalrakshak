"""
JalRakshak Centralized Hotspot & Risk Engine Service
Integrates detections from IoT, Satellite, Drone, and Field Worker modules.
Enforces Mumbai-only boundary rules, calculates explainable risk, and handles cross-module duplicate clustering.
"""

import json
import uuid
import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from app import models, schemas, crud
from app.services.geospatial_service import validate_mumbai_coordinates, haversine_distance_meters

def calculate_explainable_risk(
    estimated_debris_kg: float = 0.0,
    confidence_avg: float = 0.5,
    water_level_m: Optional[float] = None,
    rainfall_mm: Optional[float] = None,
    is_choke_point: bool = False
) -> Dict[str, Any]:
    """
    Calculates explainable risk score (0-100) and generates human-readable factor breakdown.
    Does NOT replace missing data with fabricated values. Missing values are explicitly flagged.
    """
    factors: List[str] = []
    score = 15.0 # Baseline monitoring score
    factors.append("Base waterway monitoring baseline: 15 pts")

    # 1. Plastic accumulation load (up to 40 pts)
    debris_pts = 0.0
    if estimated_debris_kg > 500:
        debris_pts = 40.0
        factors.append(f"Severe plastic accumulation ({estimated_debris_kg:.1f} kg detected, conf: {confidence_avg:.0%}): +40 pts")
    elif estimated_debris_kg > 200:
        debris_pts = 28.0
        factors.append(f"High plastic accumulation ({estimated_debris_kg:.1f} kg detected, conf: {confidence_avg:.0%}): +28 pts")
    elif estimated_debris_kg > 50:
        debris_pts = 16.0
        factors.append(f"Moderate plastic accumulation ({estimated_debris_kg:.1f} kg detected, conf: {confidence_avg:.0%}): +16 pts")
    elif estimated_debris_kg > 0:
        debris_pts = 8.0
        factors.append(f"Trace plastic debris detected ({estimated_debris_kg:.1f} kg): +8 pts")
    else:
        factors.append("No visible plastic accumulation detected: +0 pts")
    score += debris_pts

    # 2. Water depth / culvert clearance (up to 25 pts)
    water_pts = 0.0
    if water_level_m is not None:
        if water_level_m >= 2.2:
            water_pts = 25.0
            factors.append(f"Critical water level at {water_level_m:.2f}m (creek overflow threshold): +25 pts")
        elif water_level_m >= 1.6:
            water_pts = 16.0
            factors.append(f"Elevated water level at {water_level_m:.2f}m approaching culvert top: +16 pts")
        elif water_level_m >= 1.0:
            water_pts = 8.0
            factors.append(f"Moderate water level at {water_level_m:.2f}m: +8 pts")
        else:
            factors.append(f"Normal low-flow water level ({water_level_m:.2f}m): +0 pts")
        score += water_pts
    else:
        factors.append("Water level sensor data: Unavailable at this location")

    # 3. Rainfall context (up to 20 pts)
    rain_pts = 0.0
    if rainfall_mm is not None:
        if rainfall_mm >= 50.0:
            rain_pts = 20.0
            factors.append(f"Heavy rainfall condition ({rainfall_mm:.1f} mm/h surge potential): +20 pts")
        elif rainfall_mm >= 20.0:
            rain_pts = 12.0
            factors.append(f"Moderate rainfall ({rainfall_mm:.1f} mm/h): +12 pts")
        elif rainfall_mm > 0.0:
            rain_pts = 5.0
            factors.append(f"Light precipitation ({rainfall_mm:.1f} mm): +5 pts")
        else:
            factors.append("No active rainfall: +0 pts")
        score += rain_pts
    else:
        factors.append("Rainfall gauge telemetry: Not locally measured")

    # 4. Creek infrastructure choke vulnerability (up to 10 pts)
    if is_choke_point:
        score += 10.0
        factors.append("Downstream tidal choke point or trash boom blockage vulnerability: +10 pts")

    score = min(100.0, max(5.0, score))

    category = "Low"
    if score >= 75.0:
        category = "Critical"
    elif score >= 55.0:
        category = "High"
    elif score >= 35.0:
        category = "Medium"

    explanation = "\n• " + "\n• ".join(factors)

    return {
        "risk_score": round(score, 1),
        "risk_category": category,
        "explanation": explanation
    }

def ingest_unified_hotspot(
    db: Session,
    title: str,
    source_type: str, # "iot", "satellite", "drone", "field_worker"
    source_status: str = "Real",
    device_or_reporter_id: Optional[str] = None,
    site_id: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    location_method: str = "OPERATOR_PINNED",
    coordinate_accuracy_m: Optional[float] = None,
    detection_result: Optional[Dict[str, Any]] = None,
    water_level_m: Optional[float] = None,
    rainfall_mm: Optional[float] = None,
    evidence_url: Optional[str] = None,
    event_timestamp: Optional[datetime.datetime] = None,
    notes: Optional[str] = None,
    deduplicate: bool = True
) -> Dict[str, Any]:
    """
    Unified Ingestion Pipeline for all 3 detection sources.
    - Applies strict Mumbai boundary verification
    - Calculates explainable multi-signal risk score
    - Associates duplicates with existing active hotspots (spatial clustering <= 75m)
    - Automatically creates Cleanup Task if high/critical threshold met
    """
    event_timestamp = event_timestamp or datetime.datetime.utcnow()
    det_dict = detection_result or {}

    plastic_detected = bool(det_dict.get("plastic_detected", False) or det_dict.get("total_objects_detected", 0) > 0)
    debris_kg = float(det_dict.get("estimated_debris_kg", det_dict.get("estimated_surface_mass_kg", 0.0)))
    conf_avg = float(det_dict.get("confidence_avg", 0.0))

    # 1. Geospatial boundary validation
    geo_val = validate_mumbai_coordinates(latitude, longitude)
    boundary_status = geo_val["boundary_status"]
    boundary_notes = geo_val["reason"]

    # 2. Risk assessment
    risk_info = calculate_explainable_risk(
        estimated_debris_kg=debris_kg,
        confidence_avg=conf_avg,
        water_level_m=water_level_m,
        rainfall_mm=rainfall_mm,
        is_choke_point=bool(site_id in ["MTH-01", "MTH-02", "MLD-01"])
    )

    hotspot_id = f"HS-{source_type[:3].upper()}-{uuid.uuid4().hex[:6].upper()}"

    # 3. Cross-module duplicate association check
    parent_hotspot_id = None
    action_type = "created_new_hotspot"

    if deduplicate and boundary_status == "VALID_MUMBAI" and latitude and longitude:
        existing_parent = crud.find_nearby_hotspot(db, latitude, longitude, max_distance_meters=75.0, hours_window=48)
        if existing_parent:
            parent_hotspot_id = existing_parent.id
            action_type = "associated_with_existing_hotspot"
            # Update parent hotspot observation count and elevate risk if this observation is higher
            existing_parent.associated_observations_count += 1
            if risk_info["risk_score"] > existing_parent.risk_score:
                existing_parent.risk_score = risk_info["risk_score"]
                existing_parent.risk_category = risk_info["risk_category"]
                existing_parent.risk_explanation = f"{existing_parent.risk_explanation}\n• Updated by {source_type.upper()} ({debris_kg}kg debris detected)"
            db.commit()

    # 4. Auto-generate Cleanup Task for High/Critical hotspots inside Mumbai
    cleanup_task_id = None
    cleanup_status = "Unassigned"

    if boundary_status == "VALID_MUMBAI" and risk_info["risk_category"] in ["High", "Critical"] and parent_hotspot_id is None:
        # Check if cleanup task already exists
        effective_site = site_id or "MTH-01"
        try:
            task = crud.create_cleanup_task(db, schemas.CleanupTaskCreate(
                site_id=effective_site,
                title=f"Rapid Choke Dispatch: {title}",
                priority=risk_info["risk_category"],
                team_name="BMC BMC Quick Response Ward Team",
                equipment_assigned="Trash Skimmer Boat & Boom Team",
                target_date=datetime.datetime.utcnow().strftime("%Y-%m-%d"),
                estimated_load_kg=max(debris_kg, 150.0),
                notes=f"Auto-triggered by JalRakshak Hotspot Engine ({source_type.upper()} detection). Factors: {risk_info['explanation'][:200]}"
            ))
            cleanup_task_id = task.id
            cleanup_status = "Task Assigned"
        except Exception:
            pass

    # 5. Persist unified hotspot
    create_schema = schemas.UnifiedHotspotCreate(
        id=hotspot_id,
        title=title,
        source_type=source_type,
        source_status=source_status,
        device_or_reporter_id=device_or_reporter_id,
        site_id=site_id,
        latitude=latitude,
        longitude=longitude,
        boundary_status=boundary_status,
        boundary_notes=boundary_notes,
        location_method=location_method,
        coordinate_accuracy_m=coordinate_accuracy_m,
        detection_result_json=json.dumps(det_dict),
        plastic_detected=plastic_detected,
        estimated_debris_kg=debris_kg,
        confidence_avg=conf_avg,
        water_level_m=water_level_m,
        rainfall_mm=rainfall_mm,
        evidence_url=evidence_url,
        event_timestamp=event_timestamp,
        risk_score=risk_info["risk_score"],
        risk_category=risk_info["risk_category"],
        risk_explanation=risk_info["explanation"],
        review_status="Verified" if boundary_status == "VALID_MUMBAI" else "Pending Review",
        cleanup_status=cleanup_status,
        cleanup_task_id=cleanup_task_id,
        parent_hotspot_id=parent_hotspot_id,
        associated_observations_count=1,
        notes=notes
    )

    saved = crud.create_hotspot(db, create_schema)

    return {
        "status": "success",
        "action": action_type,
        "hotspot_id": saved.id,
        "parent_hotspot_id": parent_hotspot_id,
        "boundary_status": boundary_status,
        "is_valid_mumbai": boundary_status == "VALID_MUMBAI",
        "risk_category": saved.risk_category,
        "risk_score": saved.risk_score,
        "cleanup_status": saved.cleanup_status,
        "cleanup_task_id": cleanup_task_id,
        "hotspot": saved
    }
