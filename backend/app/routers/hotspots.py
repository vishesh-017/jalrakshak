"""
JalRakshak Centralized Hotspots API Router
Unified endpoint for all 3 detection modules (IoT, Satellite, Drone, Field Worker).
Enforces Mumbai-only boundary rules, duplicate clustering, and explainable risk scores.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app import crud, schemas, models
from app.services.geospatial_service import get_mumbai_boundary_geojson, validate_mumbai_coordinates
from app.services.hotspot_service import ingest_unified_hotspot, calculate_explainable_risk

router = APIRouter(prefix="/hotspots", tags=["Unified Hotspots & Common Risk Engine"])

@router.get("/boundary", summary="Get Mumbai Operational Boundary Polygon")
def get_boundary_geojson():
    """Returns official Mumbai Municipal Operational Boundary Polygon GeoJSON."""
    return get_mumbai_boundary_geojson()

@router.get("", response_model=List[schemas.UnifiedHotspotResponse])
def get_all_hotspots(
    source_type: Optional[str] = Query(None, description="Filter by: iot, satellite, drone, field_worker"),
    risk_category: Optional[str] = Query(None, description="Filter by: Low, Medium, High, Critical"),
    boundary_status: Optional[str] = Query(None, description="Filter by: VALID_MUMBAI, OUTSIDE_BOUNDARY, UNLOCATED_REVIEW"),
    review_status: Optional[str] = Query(None, description="Filter by: Verified, Pending Review, Rejected"),
    cleanup_status: Optional[str] = Query(None, description="Filter by: Unassigned, Task Assigned, Cleaned Up"),
    source_status: Optional[str] = Query(None, description="Filter by: Real, Simulated"),
    include_children: bool = Query(False, description="Include duplicate observation child events"),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Returns unified hotspots across all detection sources.
    Defaults to returning root hotspots (boundary_status='VALID_MUMBAI').
    """
    items = crud.get_hotspots(
        db,
        source_type=source_type,
        risk_category=risk_category,
        boundary_status=boundary_status,
        review_status=review_status,
        cleanup_status=cleanup_status,
        source_status=source_status,
        limit=limit
    )

    if not include_children:
        items = [i for i in items if i.parent_hotspot_id is None]

    return items

@router.get("/summary")
def get_hotspot_summary_metrics(db: Session = Depends(get_db)):
    """Returns centralized overview metrics of all validated Mumbai hotspots."""
    all_spots = db.query(models.UnifiedHotspot).all()
    valid_mumbai = [s for s in all_spots if s.boundary_status == "VALID_MUMBAI" and s.parent_hotspot_id is None]
    unlocated = [s for s in all_spots if s.boundary_status == "UNLOCATED_REVIEW"]
    outside = [s for s in all_spots if s.boundary_status == "OUTSIDE_BOUNDARY"]

    source_counts = {
        "iot": len([s for s in valid_mumbai if s.source_type == "iot"]),
        "satellite": len([s for s in valid_mumbai if s.source_type == "satellite"]),
        "drone": len([s for s in valid_mumbai if s.source_type == "drone"]),
        "field_worker": len([s for s in valid_mumbai if s.source_type == "field_worker"]),
    }

    risk_counts = {
        "Critical": len([s for s in valid_mumbai if s.risk_category == "Critical"]),
        "High": len([s for s in valid_mumbai if s.risk_category == "High"]),
        "Medium": len([s for s in valid_mumbai if s.risk_category == "Medium"]),
        "Low": len([s for s in valid_mumbai if s.risk_category == "Low"]),
    }

    total_est_debris_kg = sum(s.estimated_debris_kg for s in valid_mumbai)

    # Connected IoT devices
    iot_devices = db.query(models.IoTDevice).all()
    devices_online = len([d for d in iot_devices if d.status == "Online"])
    devices_total = len(iot_devices)

    return {
        "total_valid_hotspots": len(valid_mumbai),
        "total_estimated_debris_kg": round(total_est_debris_kg, 1),
        "unlocated_review_count": len(unlocated),
        "outside_boundary_rejected_count": len(outside),
        "source_breakdown": source_counts,
        "risk_breakdown": risk_counts,
        "iot_devices": {
            "online": devices_online,
            "offline": devices_total - devices_online,
            "total": devices_total
        }
    }

@router.get("/unlocated-queue", response_model=List[schemas.UnifiedHotspotResponse])
def get_unlocated_review_queue(db: Session = Depends(get_db)):
    """Returns detections awaiting manual operator georeferencing."""
    return db.query(models.UnifiedHotspot).filter(
        models.UnifiedHotspot.boundary_status == "UNLOCATED_REVIEW"
    ).order_by(models.UnifiedHotspot.event_timestamp.desc()).all()

@router.get("/{hotspot_id}")
def get_hotspot_detail(hotspot_id: str, db: Session = Depends(get_db)):
    """
    Returns full details of a hotspot, including explainable risk breakdown
    and associated observations (cross-module duplicate clustering).
    """
    spot = crud.get_hotspot(db, hotspot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Hotspot record not found")

    # Fetch associated duplicate observations
    associated = db.query(models.UnifiedHotspot).filter(
        models.UnifiedHotspot.parent_hotspot_id == hotspot_id
    ).all()

    detection_data = {}
    try:
        detection_data = json.loads(spot.detection_result_json or "{}")
    except Exception:
        pass

    return {
        "hotspot": spot,
        "detection_details": detection_data,
        "associated_observations": associated,
        "associated_count": len(associated) + 1,
        "cleanup_task": spot.cleanup_task
    }

@router.patch("/{hotspot_id}", response_model=schemas.UnifiedHotspotResponse)
def update_hotspot(
    hotspot_id: str,
    updates: schemas.UnifiedHotspotUpdate,
    db: Session = Depends(get_db)
):
    """Allows operators to verify, reject, or assign cleanup tasks to a hotspot."""
    spot = crud.get_hotspot(db, hotspot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Hotspot record not found")

    # If coordinates are being updated, validate against Mumbai boundary
    if updates.latitude is not None and updates.longitude is not None:
        val = validate_mumbai_coordinates(updates.latitude, updates.longitude)
        updates.boundary_status = val["boundary_status"]

    updated = crud.update_hotspot(db, hotspot_id, updates)
    return updated

@router.post("/{hotspot_id}/dispatch-cleanup")
def dispatch_cleanup_for_hotspot(
    hotspot_id: str,
    team_name: str = "BMC Quick Response Team",
    db: Session = Depends(get_db)
):
    """Dispatches a cleanup task directly from an alert or hotspot."""
    spot = crud.get_hotspot(db, hotspot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Hotspot not found")

    task = crud.create_cleanup_task(db, schemas.CleanupTaskCreate(
        site_id=spot.site_id or "MTH-01",
        title=f"Cleanup Operation: {spot.title}",
        priority=spot.risk_category,
        team_name=team_name,
        equipment_assigned="Trash Skimmer Boat & Containment Boom",
        target_date=datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        estimated_load_kg=max(spot.estimated_debris_kg, 100.0),
        notes=f"Dispatched from Hotspot {spot.id}. Location: ({spot.latitude}, {spot.longitude}). Source: {spot.source_type.upper()}"
    ))

    crud.update_hotspot(db, hotspot_id, schemas.UnifiedHotspotUpdate(
        cleanup_status="Task Assigned",
        cleanup_task_id=task.id
    ))

    return {"status": "success", "task_id": task.id, "hotspot_id": spot.id}
