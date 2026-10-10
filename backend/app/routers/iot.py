from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import schemas, crud
from app.services import iot_service

router = APIRouter(
    prefix="/iot",
    tags=["iot"]
)

@router.get("/devices", response_model=List[schemas.IoTDeviceResponse])
def get_devices(site_id: str = None, db: Session = Depends(get_db)):
    return crud.get_devices(db, site_id=site_id)

@router.post("/ingest")
def ingest_sensor_data(payload: schemas.IoTSensorPayload, db: Session = Depends(get_db)):
    try:
        return iot_service.process_iot_payload(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/devices", response_model=schemas.IoTDeviceResponse)
def register_device(device: schemas.IoTDeviceCreate, db: Session = Depends(get_db)):
    site = crud.get_site(db, device.site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    existing = crud.get_device(db, device.id)
    if existing:
        raise HTTPException(status_code=400, detail="Device already exists")
    return crud.create_device(db, device)
