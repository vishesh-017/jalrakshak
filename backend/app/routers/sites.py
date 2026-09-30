from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app import crud, schemas, models

router = APIRouter(prefix="/sites", tags=["Monitoring Sites"])

@router.get("", response_model=List[schemas.MonitoringSiteResponse])
def read_sites(
    zone: Optional[str] = Query(None, description="Filter by creek basin zone"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (Low, Medium, High, Critical)"),
    response_status: Optional[str] = Query(None, description="Filter by response status"),
    db: Session = Depends(get_db)
):
    sites = crud.get_sites(db, zone=zone, risk_level=risk_level, response_status=response_status)
    results = []
    for s in sites:
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
        resp.latest_rainfall = latest_rain.rainfall_24h_mm if latest_rain else 15.0
        resp.latest_water_depth = latest_water.water_depth_m if latest_water else 1.2
        resp.latest_detection_count = latest_det.total_objects_detected if latest_det else 5
        results.append(resp)
    return results

@router.get("/{site_id}", response_model=schemas.MonitoringSiteResponse)
def read_site(site_id: str, db: Session = Depends(get_db)):
    site = crud.get_site(db, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Monitoring site not found")
    
    latest_rain = db.query(models.RainfallObservation).filter(
        models.RainfallObservation.site_id == site.id
    ).order_by(desc(models.RainfallObservation.timestamp)).first()

    latest_water = db.query(models.WaterLevelObservation).filter(
        models.WaterLevelObservation.site_id == site.id
    ).order_by(desc(models.WaterLevelObservation.timestamp)).first()

    latest_det = db.query(models.PlasticDetection).filter(
        models.PlasticDetection.site_id == site.id
    ).order_by(desc(models.PlasticDetection.timestamp)).first()

    resp = schemas.MonitoringSiteResponse.model_validate(site)
    resp.latest_rainfall = latest_rain.rainfall_24h_mm if latest_rain else 15.0
    resp.latest_water_depth = latest_water.water_depth_m if latest_water else 1.2
    resp.latest_detection_count = latest_det.total_objects_detected if latest_det else 5
    return resp

@router.post("", response_model=schemas.MonitoringSiteResponse, status_code=201)
def create_new_site(site: schemas.MonitoringSiteCreate, db: Session = Depends(get_db)):
    existing = crud.get_site(db, site.id)
    if existing:
        raise HTTPException(status_code=400, detail="Site ID already registered")
    created = crud.create_site(db, site)
    return schemas.MonitoringSiteResponse.model_validate(created)

@router.patch("/{site_id}", response_model=schemas.MonitoringSiteResponse)
def update_site_details(site_id: str, updates: schemas.MonitoringSiteUpdate, db: Session = Depends(get_db)):
    updated = crud.update_site(db, site_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Monitoring site not found")
    return schemas.MonitoringSiteResponse.model_validate(updated)
