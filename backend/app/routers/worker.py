"""
JalRakshak Field Engineer & Worker Image Reporting Router (Module 3)
Allows field personnel to submit photographs of waterway chokes and trash booms.
Reuses the primary pretrained Model A (deep_plastic_YoloV8) via the shared inference service.
Enforces Mumbai boundary verification, EXIF detection, map pinning, and review/cleanup workflows.
"""

import os
import uuid
import shutil
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import crud, schemas, models
from app.services.inference_service import inference_service
from app.services.geospatial_service import validate_mumbai_coordinates
from app.services.hotspot_service import ingest_unified_hotspot

router = APIRouter(prefix="/worker", tags=["Field Worker Image Reporting (Module 3)"])

@router.post("/upload-report")
async def submit_worker_report(
    photo: UploadFile = File(...),
    reporter_id: str = Form("WORKER-BMC-01"),
    reporter_name: str = Form("Field Sanitation Engineer"),
    report_category: str = Form("Culvert Choke"), # Culvert Choke, Floating Boom Jam, Mangrove Plastic Slick, Illegal Nullah Dumping
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_description: Optional[str] = Form(None),
    water_level_m: Optional[float] = Form(None),
    notes: Optional[str] = Form(None),
    model_variant: str = Form("rewater"), # "rewater" (YOLOv8m river plastic) or "resize" (deep_plastic_YoloV8)
    confidence_threshold: float = Form(0.10),
    source_status: str = Form("Real"), # "Real" or "Simulated"
    db: Session = Depends(get_db)
):
    """
    Submits a field engineer photograph report.
    1. Saves photograph and extracts EXIF metadata.
    2. Runs shared pretrained model (ReWater or Model A).
    3. Accepts browser GPS, photo EXIF, or manual map pin.
    4. Enforces Mumbai operational boundary polygon validation.
    5. Ingests into unified hotspot dashboard for review and cleanup dispatch.
    """
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = (os.path.splitext(photo.filename or "")[1] or ".jpg").lower()
    unique_id = uuid.uuid4().hex[:8]
    filename = f"worker_{unique_id}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, filename)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)

    # 1. EXIF Metadata extraction
    exif_data = inference_service.extract_exif_metadata(saved_path)

    # 2. Location resolution
    lat = latitude
    lon = longitude
    location_method = "OPERATOR_PINNED"

    if lat is None or lon is None:
        if exif_data["has_gps"] and exif_data["latitude"] and exif_data["longitude"]:
            lat = exif_data["latitude"]
            lon = exif_data["longitude"]
            location_method = "GPS_EXIF"
        else:
            location_method = "UNLOCATED"

    # 3. Model inference (shared service)
    detection = inference_service.run_detection(
        image_path=saved_path,
        confidence_threshold=confidence_threshold,
        model_variant=model_variant,
        output_dir=settings.UPLOAD_DIR
    )

    if not detection["success"]:
        raise HTTPException(status_code=400, detail=f"Image unsuitable for analysis: {detection.get('error')}")

    annotated_url = None
    if detection["annotated_path"]:
        annotated_url = f"/api/static/uploads/{os.path.basename(detection['annotated_path'])}"
    original_url = f"/api/static/uploads/{filename}"

    # 4. Mumbai Boundary Check
    geo_check = validate_mumbai_coordinates(lat, lon)

    # 5. Hotspot Ingestion
    title = f"{report_category} - {location_description or 'Reported by ' + reporter_name}"
    ingest_res = ingest_unified_hotspot(
        db=db,
        title=title,
        source_type="field_worker",
        source_status=source_status,
        device_or_reporter_id=f"{reporter_name} ({reporter_id})",
        latitude=lat,
        longitude=lon,
        location_method=location_method,
        detection_result=detection,
        water_level_m=water_level_m,
        evidence_url=annotated_url or original_url,
        notes=f"Category: {report_category}. Reporter: {reporter_name} ({reporter_id}). Location desc: {location_description or 'N/A'}. Notes: {notes or 'None'}"
    )

    return {
        "status": "success",
        "report_id": ingest_res["hotspot_id"],
        "reporter": {"id": reporter_id, "name": reporter_name},
        "category": report_category,
        "location": {
            "latitude": lat,
            "longitude": lon,
            "location_method": location_method,
            "detected_from_exif": exif_data["has_gps"],
            "boundary_status": geo_check["boundary_status"],
            "is_valid_mumbai": geo_check["is_valid"],
            "boundary_reason": geo_check["reason"]
        },
        "ai_results": {
            "model_version": detection["model_version"],
            "plastic_detected": detection["plastic_detected"],
            "total_debris_items": detection["total_objects_detected"],
            "estimated_debris_kg": detection["estimated_surface_mass_kg"],
            "confidence_avg": detection["confidence_avg"],
            "uncertainty": detection.get("uncertainty"),
            "bounding_boxes": detection["bounding_boxes"],
            "recommended_action": "Schedule immediate cleanup dispatch" if detection["estimated_surface_mass_kg"] > 100 else "Monitor during next tidal surge"
        },
        "evidence": {
            "original_url": original_url,
            "annotated_url": annotated_url
        },
        "hotspot": {
            "hotspot_id": ingest_res["hotspot_id"],
            "risk_score": ingest_res["risk_score"],
            "risk_category": ingest_res["risk_category"],
            "cleanup_status": ingest_res["cleanup_status"],
            "cleanup_task_id": ingest_res["cleanup_task_id"]
        }
    }

@router.get("/reports")
def list_worker_reports(
    review_status: Optional[str] = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db)
):
    """Returns field worker reports submitted across Mumbai."""
    query = db.query(models.UnifiedHotspot).filter(
        models.UnifiedHotspot.source_type == "field_worker"
    )
    if review_status:
        query = query.filter(models.UnifiedHotspot.review_status == review_status)
    return query.order_by(models.UnifiedHotspot.event_timestamp.desc()).limit(limit).all()

@router.post("/reports/{report_id}/action")
def update_report_action(
    report_id: str,
    action: str = Form(...), # "verify", "reject", "dispatch_cleanup"
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Allows municipal operators to verify, reject, or assign cleanup tasks to worker reports."""
    spot = crud.get_hotspot(db, report_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Report not found")

    if action == "verify":
        spot.review_status = "Verified"
    elif action == "reject":
        spot.review_status = "Rejected"
    elif action == "dispatch_cleanup":
        task = crud.create_cleanup_task(db, schemas.CleanupTaskCreate(
            site_id=spot.site_id or "MTH-01",
            title=f"Worker Alert Cleanup: {spot.title}",
            priority=spot.risk_category,
            team_name="BMC Ward Rapid Response Crew",
            equipment_assigned="Trash Barrier Crew & Skimmer",
            target_date=datetime.datetime.utcnow().strftime("%Y-%m-%d"),
            estimated_load_kg=max(spot.estimated_debris_kg, 80.0),
            notes=f"Worker Report ID {spot.id}. Operator Notes: {notes or 'Dispatched'}"
        ))
        spot.cleanup_status = "Task Assigned"
        spot.cleanup_task_id = task.id
        spot.review_status = "Verified"

    if notes:
        spot.notes = f"{spot.notes or ''}\n[Operator Note]: {notes}"

    db.commit()
    db.refresh(spot)
    return {"status": "success", "action": action, "report": spot}
