"""
JalRakshak Drone Monitoring Router (Module 2B)
Integrates Model A (deep_plastic_YoloV8) for drone aerial photography.
Extracts EXIF GPS metadata, handles unlocated imagery, enforces Mumbai boundary polygon,
and feeds into the centralized hotspot engine with duplicate clustering.
"""

import os
import uuid
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.services.inference_service import inference_service
from app.services.geospatial_service import validate_mumbai_coordinates
from app.services.hotspot_service import ingest_unified_hotspot
from app.services.drone_video_service import drone_video_service, video_jobs

router = APIRouter(prefix="/drone", tags=["Drone Video & Imagery Monitoring (ReWater YOLOv8m)"])

# =========================================================================
# DRONE VIDEO ANALYSIS ENDPOINTS (ReWater YOLOv8m)
# =========================================================================

@router.get("/video/sample-videos")
def get_sample_drone_videos():
    """Returns catalog of preloaded sample drone survey footage for quick testing."""
    sample_path = os.path.join(settings.UPLOAD_DIR, "sample_drone_mumbai_nullah.mp4")
    samples = []
    if os.path.exists(sample_path):
        meta = drone_video_service.extract_video_metadata(sample_path)
        samples.append({
            "id": "sample-mithi-01",
            "title": "Mithi River Culvert Drone Aerial Patrol (5s HD)",
            "filename": "sample_drone_mumbai_nullah.mp4",
            "url": "/api/static/uploads/sample_drone_mumbai_nullah.mp4",
            "fps": meta["fps"],
            "total_frames": meta["total_frames"],
            "duration_formatted": meta["duration_formatted"],
            "file_size_mb": meta["file_size_mb"],
            "default_start_coords": [19.0654, 72.8712],
            "default_end_coords": [19.0720, 72.8750],
            "location_name": "Mithi River Choke Point (BKC - Kurla Outfall)",
            "description": "Aerial drone footage captured over Mithi River displaying floating trash accumulation near low bridge."
        })
    return samples

@router.post("/video/upload-and-analyze")
async def upload_and_analyze_drone_video(
    file: UploadFile = File(...),
    sample_interval_sec: float = Form(1.0),
    confidence_threshold: float = Form(0.10),
    model_variant: str = Form("rewater"),
    srt_file: Optional[UploadFile] = File(None),
    start_latitude: Optional[float] = Form(None),
    start_longitude: Optional[float] = Form(None),
    end_latitude: Optional[float] = Form(None),
    end_longitude: Optional[float] = Form(None),
    flight_area_latitude: Optional[float] = Form(None),
    flight_area_longitude: Optional[float] = Form(None),
    flight_id: Optional[str] = Form("DJI-MAVIC3-MUM-01"),
    source_status: str = Form("Real")
):
    """
    Uploads a drone video (MP4, MOV) and executes ReWater YOLOv8m inference.
    - Samples frames at configurable intervals (sample_interval_sec).
    - Preserves frame timestamps and extracts bounding boxes & confidence.
    - Groups consecutive frame detections into candidate accumulation hotspots.
    - Synchronizes telemetry (SRT, waypoints, or flight area pin).
    - Strictly validates against Mumbai boundary polygon before adding to active map.
    """
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = (os.path.splitext(file.filename or "")[1] or ".mp4").lower()
    if ext not in [".mp4", ".mov", ".avi", ".mkv"]:
        raise HTTPException(status_code=400, detail=f"Unsupported video format: {ext}. Allowed formats: .mp4, .mov, .avi, .mkv")

    job_id = f"vjob_{uuid.uuid4().hex[:8]}"
    saved_filename = f"drone_video_{job_id}{ext}"
    saved_video_path = os.path.join(settings.UPLOAD_DIR, saved_filename)

    with open(saved_video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    srt_content = None
    if srt_file:
        srt_bytes = await srt_file.read()
        srt_content = srt_bytes.decode("utf-8", errors="ignore")

    # Initial metadata check
    try:
        meta = drone_video_service.extract_video_metadata(saved_video_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Corrupt or invalid video file: {str(e)}")

    # Initialize job in registry
    video_jobs[job_id] = {
        "job_id": job_id,
        "filename": file.filename,
        "video_url": f"/api/static/uploads/{saved_filename}",
        "status": "QUEUED",
        "progress_percent": 0,
        "video_metadata": meta,
        "model_variant": model_variant,
        "sample_interval_sec": sample_interval_sec,
        "confidence_threshold": confidence_threshold,
        "video_path": saved_video_path,
        "srt_content": srt_content,
        "params": {
            "start_latitude": start_latitude,
            "start_longitude": start_longitude,
            "end_latitude": end_latitude,
            "end_longitude": end_longitude,
            "flight_area_latitude": flight_area_latitude,
            "flight_area_longitude": flight_area_longitude,
            "flight_id": flight_id,
            "source_status": source_status
        }
    }

    # Execute processing synchronously for immediate response
    res = drone_video_service.process_drone_video(
        job_id=job_id,
        video_path=saved_video_path,
        sample_interval_sec=sample_interval_sec,
        confidence_threshold=confidence_threshold,
        model_variant=model_variant,
        srt_content=srt_content,
        start_latitude=start_latitude,
        start_longitude=start_longitude,
        end_latitude=end_latitude,
        end_longitude=end_longitude,
        flight_area_latitude=flight_area_latitude,
        flight_area_longitude=flight_area_longitude,
        flight_id=flight_id,
        source_status=source_status
    )

    return res

@router.get("/video/jobs/{job_id}")
def get_drone_video_job(job_id: str):
    """Retrieves processing status, progress, frame thumbnails, and candidate accumulations for a video job."""
    if job_id not in video_jobs:
        raise HTTPException(status_code=404, detail="Video processing job not found")
    return video_jobs[job_id]

@router.post("/video/jobs/{job_id}/cancel")
def cancel_drone_video_job(job_id: str):
    """Cancels an in-progress video analysis job."""
    if job_id not in video_jobs:
        raise HTTPException(status_code=404, detail="Video processing job not found")
    job = video_jobs[job_id]
    job["cancel_requested"] = True
    job["status"] = "CANCELLED"
    return {"status": "success", "message": f"Job {job_id} cancelled"}

@router.post("/video/jobs/{job_id}/retry")
def retry_drone_video_job(job_id: str):
    """Retries a failed or cancelled video job."""
    if job_id not in video_jobs:
        raise HTTPException(status_code=404, detail="Video processing job not found")
    job = video_jobs[job_id]
    job["cancel_requested"] = False
    p = job.get("params", {})
    res = drone_video_service.process_drone_video(
        job_id=job_id,
        video_path=job["video_path"],
        sample_interval_sec=job.get("sample_interval_sec", 1.0),
        confidence_threshold=job.get("confidence_threshold", 0.30),
        model_variant=job.get("model_variant", "rewater"),
        srt_content=job.get("srt_content"),
        start_latitude=p.get("start_latitude"),
        start_longitude=p.get("start_longitude"),
        end_latitude=p.get("end_latitude"),
        end_longitude=p.get("end_longitude"),
        flight_area_latitude=p.get("flight_area_latitude"),
        flight_area_longitude=p.get("flight_area_longitude"),
        flight_id=p.get("flight_id"),
        source_status=p.get("source_status", "Real")
    )
    return res

@router.post("/upload")
async def upload_drone_image(
    file: UploadFile = File(...),
    manual_latitude: Optional[float] = Form(None),
    manual_longitude: Optional[float] = Form(None),
    flight_id: Optional[str] = Form(None),
    confidence_threshold: float = Form(0.10),
    model_variant: str = Form("rewater"), # "rewater" (YOLOv8m river plastic) or "tiles" / "resize"
    source_status: str = Form("Real"), # "Real" or "Simulated"
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload and process a drone survey photograph.
    1. Extracts GPS metadata from EXIF (if available).
    2. Runs pretrained Model A (deep_plastic_YoloV8).
    3. Never fabricates coordinates: prompts for manual pin if EXIF GPS missing.
    4. Validates coordinates against Mumbai operational boundary polygon.
    5. Ingests into unified hotspot engine with proximity deduplication.
    """
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = (os.path.splitext(file.filename or "")[1] or ".jpg").lower()
    unique_id = uuid.uuid4().hex[:8]
    filename = f"drone_{unique_id}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, filename)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 1. EXIF Metadata extraction
    exif_data = inference_service.extract_exif_metadata(saved_path)

    # 2. Location determination
    lat = None
    lon = None
    location_method = "UNLOCATED"

    if exif_data["has_gps"] and exif_data["latitude"] and exif_data["longitude"]:
        lat = exif_data["latitude"]
        lon = exif_data["longitude"]
        location_method = "GPS_EXIF"
    elif manual_latitude is not None and manual_longitude is not None:
        lat = manual_latitude
        lon = manual_longitude
        location_method = "OPERATOR_PINNED"

    # 3. Model A inference
    detection = inference_service.run_detection(
        image_path=saved_path,
        confidence_threshold=confidence_threshold,
        model_variant=model_variant,
        output_dir=settings.UPLOAD_DIR
    )

    if not detection["success"]:
        return {
            "success": False,
            "error": detection["error"],
            "image_id": unique_id,
            "filename": file.filename
        }

    annotated_url = None
    if detection["annotated_path"]:
        annotated_url = f"/api/static/uploads/{os.path.basename(detection['annotated_path'])}"
    original_url = f"/api/static/uploads/{filename}"

    # 4. Mumbai Boundary Check
    geo_check = validate_mumbai_coordinates(lat, lon)

    # 5. Centralized Hotspot Ingestion
    flight_tag = f"Flight #{flight_id}" if flight_id else "Aerial Drone Survey"
    hotspot_title = f"Drone Debris Survey: {flight_tag}"

    ingest_res = ingest_unified_hotspot(
        db=db,
        title=hotspot_title,
        source_type="drone",
        source_status=source_status,
        device_or_reporter_id=flight_id or f"DRONE-{unique_id[:4]}",
        latitude=lat,
        longitude=lon,
        location_method=location_method,
        coordinate_accuracy_m=exif_data.get("altitude_m"),
        detection_result=detection,
        evidence_url=annotated_url or original_url,
        notes=notes or f"Analyzed with {detection['model_version']}. Location provenance: {location_method}."
    )

    return {
        "success": True,
        "image_id": unique_id,
        "filename": file.filename,
        "model_version": detection["model_version"],
        "location": {
            "latitude": lat,
            "longitude": lon,
            "location_method": location_method,
            "altitude_m": exif_data.get("altitude_m"),
            "has_exif_gps": exif_data["has_gps"],
            "requires_manual_pin": lat is None or lon is None,
            "boundary_status": geo_check["boundary_status"],
            "is_valid_mumbai": geo_check["is_valid"],
            "boundary_reason": geo_check["reason"]
        },
        "detection": {
            "plastic_detected": detection["plastic_detected"],
            "total_objects": detection["total_objects_detected"],
            "plastic_count": detection["plastic_objects_count"],
            "class_counts": detection["class_counts"],
            "confidence_avg": detection["confidence_avg"],
            "estimated_debris_kg": detection["estimated_surface_mass_kg"],
            "uncertainty": detection.get("uncertainty"),
            "bounding_boxes": detection["bounding_boxes"]
        },
        "images": {
            "original_url": original_url,
            "annotated_url": annotated_url
        },
        "hotspot_integration": {
            "hotspot_id": ingest_res["hotspot_id"],
            "action": ingest_res["action"],
            "risk_category": ingest_res["risk_category"],
            "risk_score": ingest_res["risk_score"],
            "cleanup_status": ingest_res["cleanup_status"]
        }
    }

@router.post("/batch-upload")
async def batch_upload_drone_images(
    files: List[UploadFile] = File(...),
    confidence_threshold: float = Form(0.10),
    model_variant: str = Form("rewater"),
    source_status: str = Form("Real"),
    db: Session = Depends(get_db)
):
    """Processes a batch of drone survey images individually, reporting per-item progress."""
    results = []
    for f in files:
        try:
            res = await upload_drone_image(
                file=f,
                manual_latitude=None,
                manual_longitude=None,
                flight_id=None,
                confidence_threshold=confidence_threshold,
                model_variant=model_variant,
                source_status=source_status,
                notes="Batch Drone Upload",
                db=db
            )
            results.append({"filename": f.filename, "status": "success", "result": res})
        except Exception as e:
            results.append({"filename": f.filename, "status": "failed", "error": str(e)})

    return {
        "total_files": len(files),
        "successful": len([r for r in results if r["status"] == "success"]),
        "failed": len([r for r in results if r["status"] == "failed"]),
        "items": results
    }
