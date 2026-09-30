import os
import uuid
import json
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models
from app.ai.detector import detector
from app.config import settings

router = APIRouter(prefix="/detections", tags=["AI Plastic Detection"])

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

@router.get("/samples")
def list_sample_feeds():
    """Returns available sample CCTV & drone camera feeds for pilot testing."""
    os.makedirs(settings.SAMPLES_DIR, exist_ok=True)
    samples = [
        {
            "id": "sample-1",
            "filename": "mithi_mahim_boom_cctv.jpg",
            "name": "Mithi River Mahim Causeway Trash Boom (Tidal Inflow)",
            "site_id": "MTH-01",
            "source_type": "CCTV Creek Camera",
            "url": "/api/static/sample_feeds/mithi_mahim_boom_cctv.jpg"
        },
        {
            "id": "sample-2",
            "filename": "kurla_bkc_culvert_cam.jpg",
            "name": "Kurla BKC High-Density Nullah Culvert",
            "site_id": "MTH-02",
            "source_type": "CCTV Creek Camera",
            "url": "/api/static/sample_feeds/kurla_bkc_culvert_cam.jpg"
        },
        {
            "id": "sample-3",
            "filename": "malad_marve_drone_survey.jpg",
            "name": "Malad Creek Mangrove Aerial Survey (Drone)",
            "site_id": "MLD-01",
            "source_type": "Drone Aerial Survey",
            "url": "/api/static/sample_feeds/malad_marve_drone_survey.jpg"
        },
        {
            "id": "sample-4",
            "filename": "trombay_canal_patrol.jpg",
            "name": "Trombay Mahul Outfall Water Patrol Camera",
            "site_id": "TRM-01",
            "source_type": "Mobile Patrol Upload",
            "url": "/api/static/sample_feeds/trombay_canal_patrol.jpg"
        }
    ]
    return samples

@router.get("", response_model=List[schemas.PlasticDetectionResponse])
def get_all_detections(
    site_id: Optional[str] = Query(None, description="Filter by site ID"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return crud.get_detections(db, site_id=site_id, limit=limit)

@router.get("/{detection_id}", response_model=schemas.PlasticDetectionResponse)
def get_single_detection(detection_id: int, db: Session = Depends(get_db)):
    det = crud.get_detection(db, detection_id)
    if not det:
        raise HTTPException(status_code=404, detail="Detection record not found")
    return det

@router.post("/analyze-upload")
async def analyze_uploaded_media(
    file: UploadFile = File(...),
    site_id: Optional[str] = Form(None),
    model_type: str = Form("ground"), # "ground" or "aerial"
    confidence_threshold: float = Form(0.35),
    source_status: str = Form("Real"),
    db: Session = Depends(get_db)
):
    """
    Accepts an uploaded image (JPG/PNG) OR supported video (MP4/AVI/MOV).
    If a video is uploaded, extracts a high-quality keyframe for inference.
    Returns detected bounding boxes, debris density, class counts, and visual accumulation category.
    """
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    extension = (os.path.splitext(file.filename or "")[1] or ".jpg").lower()
    unique_id = uuid.uuid4().hex[:8]
    unique_filename = f"upload_{unique_id}{extension}"
    saved_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    is_video = extension in VIDEO_EXTENSIONS
    video_meta = {}

    image_to_analyze = saved_path
    if is_video:
        frame_filename = f"frame_{unique_id}.jpg"
        frame_path = os.path.join(settings.UPLOAD_DIR, frame_filename)
        try:
            video_meta = detector.extract_video_frame(saved_path, frame_path, target_sec=1.0)
            image_to_analyze = frame_path
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process video file: {str(e)}")

    try:
        detection_result = detector.detect_plastic(
            image_path=image_to_analyze,
            confidence_threshold=confidence_threshold,
            site_id=site_id,
            model_type=model_type
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plastic detection failed: {str(e)}")

    annotated_filename = os.path.basename(detection_result["annotated_image_path"])

    db_det = crud.create_detection(db, schemas.PlasticDetectionCreate(
        site_id=site_id,
        image_path=f"/api/static/uploads/{annotated_filename}",
        image_source_type="Drone Video Feed" if (is_video and model_type == "aerial") else "CCTV Creek Camera",
        total_objects_detected=detection_result["total_objects_detected"],
        plastic_bottle_count=detection_result["plastic_bottle_count"],
        plastic_bag_count=detection_result["plastic_bag_count"],
        other_plastic_count=detection_result["other_plastic_count"],
        styrofoam_count=detection_result["styrofoam_count"],
        plastic_density_index=detection_result["plastic_density_index"],
        estimated_surface_mass_kg=detection_result["estimated_surface_mass_kg"],
        confidence_avg=detection_result["confidence_avg"],
        bounding_boxes_json=json.dumps(detection_result["bounding_boxes"]),
        source_status=source_status,
        notes=f"Processed with {detection_result['model_version']}" + (f" (Extracted from video: {video_meta.get('duration_seconds')}s)" if is_video else "")
    ))

    return {
        "detection_id": db_det.id,
        "site_id": site_id,
        "is_video": is_video,
        "video_metadata": video_meta if is_video else None,
        "visual_accumulation_category": detection_result.get("visual_accumulation_category", "Moderate Accumulation"),
        "model_version": detection_result.get("model_version", "YOLOv8m-Kili-v1.0"),
        "metrics": {
            "total_objects_detected": detection_result["total_objects_detected"],
            "plastic_bottle_count": detection_result["plastic_bottle_count"],
            "plastic_bag_count": detection_result["plastic_bag_count"],
            "other_plastic_count": detection_result["other_plastic_count"],
            "styrofoam_count": detection_result["styrofoam_count"],
            "plastic_density_index": detection_result["plastic_density_index"],
            "estimated_surface_mass_kg": detection_result["estimated_surface_mass_kg"],
            "confidence_avg": detection_result["confidence_avg"]
        },
        "bounding_boxes": detection_result["bounding_boxes"],
        "original_image_url": f"/api/static/uploads/{os.path.basename(image_to_analyze)}",
        "annotated_image_url": f"/api/static/uploads/{annotated_filename}",
        "source_status": source_status
    }

@router.post("/analyze-sample")
def analyze_sample_feed(
    sample_filename: str = Form(...),
    site_id: Optional[str] = Form(None),
    model_type: str = Form("ground"),
    confidence_threshold: float = Form(0.35),
    source_status: str = Form("Simulated"),
    db: Session = Depends(get_db)
):
    """
    Runs detection on one of the registered creek camera or drone sample feeds.
    """
    sample_path = os.path.join(settings.SAMPLES_DIR, sample_filename)
    if not os.path.exists(sample_path):
        available = [f for f in os.listdir(settings.SAMPLES_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png')) and not f.startswith('annotated_')]
        if available:
            # Prefer mithi_mahim_boom_cctv.jpg if present
            sample_filename = "mithi_mahim_boom_cctv.jpg" if "mithi_mahim_boom_cctv.jpg" in available else available[0]
            sample_path = os.path.join(settings.SAMPLES_DIR, sample_filename)
        else:
            raise HTTPException(status_code=404, detail="Sample feed image not found")

    detection_result = detector.detect_plastic(
        image_path=sample_path,
        confidence_threshold=confidence_threshold,
        site_id=site_id,
        model_type=model_type
    )

    annotated_filename = os.path.basename(detection_result["annotated_image_path"])

    db_det = crud.create_detection(db, schemas.PlasticDetectionCreate(
        site_id=site_id,
        image_path=f"/api/static/sample_feeds/{annotated_filename}",
        image_source_type="Drone Aerial Survey" if model_type == "aerial" else "CCTV Creek Camera",
        total_objects_detected=detection_result["total_objects_detected"],
        plastic_bottle_count=detection_result["plastic_bottle_count"],
        plastic_bag_count=detection_result["plastic_bag_count"],
        other_plastic_count=detection_result["other_plastic_count"],
        styrofoam_count=detection_result["styrofoam_count"],
        plastic_density_index=detection_result["plastic_density_index"],
        estimated_surface_mass_kg=detection_result["estimated_surface_mass_kg"],
        confidence_avg=detection_result["confidence_avg"],
        bounding_boxes_json=json.dumps(detection_result["bounding_boxes"]),
        source_status=source_status,
        notes=f"Sample feed analyzed via {detection_result['model_version']}"
    ))

    return {
        "detection_id": db_det.id,
        "site_id": site_id,
        "visual_accumulation_category": detection_result.get("visual_accumulation_category", "Moderate Accumulation"),
        "model_version": detection_result.get("model_version", "YOLOv8m-Kili-v1.0"),
        "metrics": {
            "total_objects_detected": detection_result["total_objects_detected"],
            "plastic_bottle_count": detection_result["plastic_bottle_count"],
            "plastic_bag_count": detection_result["plastic_bag_count"],
            "other_plastic_count": detection_result["other_plastic_count"],
            "styrofoam_count": detection_result["styrofoam_count"],
            "plastic_density_index": detection_result["plastic_density_index"],
            "estimated_surface_mass_kg": detection_result["estimated_surface_mass_kg"],
            "confidence_avg": detection_result["confidence_avg"]
        },
        "bounding_boxes": detection_result["bounding_boxes"],
        "original_image_url": f"/api/static/sample_feeds/{sample_filename}",
        "annotated_image_url": f"/api/static/sample_feeds/{annotated_filename}",
        "source_status": source_status
    }
