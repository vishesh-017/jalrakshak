"""
JalRakshak Satellite Marine Debris Router (Module 2A)
Executes Model B (mdebris / MARIDA Sentinel-2 Pipeline - Daniel Tyukov).
Analyzes Sentinel-2 multi-spectral imagery, calculates spectral indices (FDI, NDVI, NDWI, PI),
transforms candidate debris pixels to geographic coordinates, enforces Mumbai boundary polygon,
and ingests candidates into the centralized hotspot engine.
"""

import os
import uuid
import shutil
import json
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.services.satellite_service import satellite_service
from app.services.geospatial_service import validate_mumbai_coordinates
from app.services.hotspot_service import ingest_unified_hotspot

router = APIRouter(prefix="/satellite", tags=["Satellite Marine Debris (Model B)"])

SAMPLE_SATELLITE_SCENES = [
    {
        "id": "S2A-MSIL2A-MUMBAI-MITHI",
        "name": "Sentinel-2 MSI: Mithi River Estuary & Mahim Bay",
        "provider": "Copernicus Sentinel-2 (ESA) via Microsoft Planetary Computer",
        "acquisition_date": "2026-09-28T05:35:10Z",
        "resolution_m": 10.0,
        "creek_target": "Mithi River & Mahim Bay",
        "raster_bounds": {
            "min_lat": 19.015,
            "max_lat": 19.060,
            "min_lon": 72.820,
            "max_lon": 72.865
        },
        "preview_url": "/api/static/sample_feeds/mithi_mahim_boom_cctv.jpg"
    },
    {
        "id": "S2B-MSIL2A-MUMBAI-MALAD",
        "name": "Sentinel-2 MSI: Malad Creek Mangrove Mudflats",
        "provider": "Copernicus Sentinel-2 (ESA)",
        "acquisition_date": "2026-09-29T05:40:22Z",
        "resolution_m": 10.0,
        "creek_target": "Malad Creek & Marve Outfall",
        "raster_bounds": {
            "min_lat": 19.160,
            "max_lat": 19.205,
            "min_lon": 72.795,
            "max_lon": 72.840
        },
        "preview_url": "/api/static/sample_feeds/malad_marve_drone_survey.jpg"
    },
    {
        "id": "S2A-MSIL2A-MUMBAI-THANE",
        "name": "Sentinel-2 MSI: Trombay / Thane Creek Outfall",
        "provider": "Copernicus Sentinel-2 (ESA)",
        "acquisition_date": "2026-09-30T05:38:15Z",
        "resolution_m": 10.0,
        "creek_target": "Thane Creek Flamingo Sanctuary & Mahul Outfall",
        "raster_bounds": {
            "min_lat": 19.020,
            "max_lat": 19.070,
            "min_lon": 72.910,
            "max_lon": 72.955
        },
        "preview_url": "/api/static/sample_feeds/trombay_canal_patrol.jpg"
    }
]

@router.get("/scenes")
def list_satellite_scenes():
    """Lists registered Sentinel-2 scenes and operational monitoring areas in Mumbai."""
    return SAMPLE_SATELLITE_SCENES

@router.post("/analyze-upload")
async def analyze_uploaded_satellite_chip(
    file: UploadFile = File(...),
    scene_id: str = Form("S2-CUSTOM-CHIP"),
    acquisition_date: str = Form("2026-10-01"),
    min_lat: float = Form(19.02),
    max_lat: float = Form(19.07),
    min_lon: float = Form(72.82),
    max_lon: float = Form(72.87),
    source_status: str = Form("Real"),
    db: Session = Depends(get_db)
):
    """
    Analyzes an uploaded Sentinel-2 raster chip using Model B.
    Extracts multi-spectral indices (FDI/NDVI), detects candidate debris slicks,
    converts pixel coordinates to geographic coordinates, and validates against Mumbai boundary.
    """
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = (os.path.splitext(file.filename or "")[1] or ".jpg").lower()
    unique_id = uuid.uuid4().hex[:8]
    filename = f"sat_{unique_id}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, filename)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    raster_bounds = {
        "min_lat": min_lat,
        "max_lat": max_lat,
        "min_lon": min_lon,
        "max_lon": max_lon
    }

    result = satellite_service.analyze_scene_chip(
        image_path=saved_path,
        raster_bounds=raster_bounds,
        acquisition_time=acquisition_date,
        provider="Sentinel-2 MSI (Level-2A)",
        creek_target="Uploaded Sentinel-2 Mumbai Raster"
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Analysis failed"))

    # Ingest candidate regions as hotspots
    ingested_hotspots = []
    for reg in result["candidate_regions"]:
        if reg["is_inside_mumbai"]:
            ingest_res = ingest_unified_hotspot(
                db=db,
                title=f"Satellite Debris Slick: {reg['cluster_id']} ({reg['estimated_slick_area_sqm']} m²)",
                source_type="satellite",
                source_status=source_status,
                device_or_reporter_id="Sentinel-2 MSI (ESA)",
                latitude=reg["latitude"],
                longitude=reg["longitude"],
                location_method="GEOREFERENCED_RASTER",
                coordinate_accuracy_m=10.0,
                detection_result={
                    "plastic_detected": True,
                    "estimated_surface_mass_kg": float(reg["estimated_slick_area_sqm"] * 0.5), # Approx 0.5 kg/m2 macroscopic slick
                    "confidence_avg": reg["confidence"],
                    "total_objects_detected": 1,
                    "slick_area_sqm": reg["estimated_slick_area_sqm"]
                },
                evidence_url=result["annotated_image_url"],
                notes=f"Model B Candidate Debris. {reg['interpretation']} Notice: {reg['uncertainty_notice']}"
            )
            ingested_hotspots.append(ingest_res["hotspot_id"])

    result["ingested_hotspot_ids"] = ingested_hotspots
    return result

@router.post("/analyze-sample-scene")
def analyze_sample_scene(
    scene_id: str = Form(...),
    source_status: str = Form("Simulated"),
    db: Session = Depends(get_db)
):
    """
    Runs Model B analysis on one of the registered Sentinel-2 scenes for Mumbai waterways.
    """
    scene = next((s for s in SAMPLE_SATELLITE_SCENES if s["id"] == scene_id), None)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene ID not found")

    # Map sample image
    sample_file = "mithi_mahim_boom_cctv.jpg"
    if "MALAD" in scene_id:
        sample_file = "malad_marve_drone_survey.jpg"
    elif "THANE" in scene_id:
        sample_file = "trombay_canal_patrol.jpg"

    sample_path = os.path.join(settings.SAMPLES_DIR, sample_file)
    if not os.path.exists(sample_path):
        sample_path = os.path.join(settings.UPLOAD_DIR, sample_file)

    result = satellite_service.analyze_scene_chip(
        image_path=sample_path,
        raster_bounds=scene["raster_bounds"],
        acquisition_time=scene["acquisition_date"],
        provider=scene["provider"],
        creek_target=scene["creek_target"]
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Analysis failed"))

    # Ingest in-bounds candidate regions as hotspots
    ingested_hotspots = []
    for reg in result["candidate_regions"]:
        if reg["is_inside_mumbai"]:
            ingest_res = ingest_unified_hotspot(
                db=db,
                title=f"Satellite Debris Slick: {scene['creek_target']} ({reg['estimated_slick_area_sqm']} m²)",
                source_type="satellite",
                source_status=source_status,
                device_or_reporter_id=scene["id"],
                latitude=reg["latitude"],
                longitude=reg["longitude"],
                location_method="GEOREFERENCED_RASTER",
                coordinate_accuracy_m=10.0,
                detection_result={
                    "plastic_detected": True,
                    "estimated_surface_mass_kg": float(reg["estimated_slick_area_sqm"] * 0.4),
                    "confidence_avg": reg["confidence"],
                    "total_objects_detected": 1,
                    "slick_area_sqm": reg["estimated_slick_area_sqm"]
                },
                evidence_url=result["annotated_image_url"],
                notes=f"Model B Marine Debris Pipeline. Sentinel-2 pass: {scene['acquisition_date']}. Notice: {result['resolution_notice']}"
            )
            ingested_hotspots.append(ingest_res["hotspot_id"])

    result["ingested_hotspot_ids"] = ingested_hotspots
    return result
