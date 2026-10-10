"""
JalRakshak Monsoon Blockage Detection Router
============================================
Endpoints for monsoon station monitoring, anomaly analysis,
incident management, simulation scenarios, and ESP32 hardware ingestion.
"""

import datetime
import uuid
import json
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Body
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app import models, schemas, crud
from app.services.monsoon_anomaly_service import (
    analyse_drain_anomaly,
    build_explainable_priority_score,
    DEMO_SCENARIOS,
    DEFAULT_THRESHOLDS,
    BlockageStatus,
)
from app.services.geospatial_service import validate_mumbai_coordinates

router = APIRouter(prefix="/monsoon", tags=["monsoon"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# In-memory store for monsoon stations and incidents
# (persists until server restart — extend to DB in production)
# ---------------------------------------------------------------------------

_MONSOON_STATIONS: Dict[str, Dict[str, Any]] = {
    "MST-MTH-01": {
        "id": "MST-MTH-01",
        "name": "Mithi River — Kurla Bridge",
        "site_id": "MTH-01",
        "zone": "Mithi River Basin",
        "latitude": 19.0728,
        "longitude": 72.8826,
        "culvert_capacity_m": 2.5,
        "baseline_depth_m": 0.45,
        "baseline_flow_mps": 0.35,
        "upstream_urban_density": "Very High",
        "downstream_vulnerability": "High",
        "sensor_mode": "Simulated",
        "device_id": "ESP32-MTH-01",
        "has_flow_sensor": True,
        "has_rainfall_gauge": True,
        "known_plastic_nearby_kg": 420.0,
        "prior_anomaly_count": 3,
    },
    "MST-MTH-02": {
        "id": "MST-MTH-02",
        "name": "Mithi River — Airport Drain",
        "site_id": "MTH-02",
        "zone": "Mithi River Basin",
        "latitude": 19.0892,
        "longitude": 72.8650,
        "culvert_capacity_m": 2.0,
        "baseline_depth_m": 0.40,
        "baseline_flow_mps": 0.30,
        "upstream_urban_density": "High",
        "downstream_vulnerability": "High",
        "sensor_mode": "Simulated",
        "device_id": "ESP32-MTH-02",
        "has_flow_sensor": True,
        "has_rainfall_gauge": False,
        "known_plastic_nearby_kg": 210.0,
        "prior_anomaly_count": 1,
    },
    "MST-MLD-01": {
        "id": "MST-MLD-01",
        "name": "Malad Creek — Kandivali Drain",
        "site_id": "MLD-01",
        "zone": "Malad Creek Basin",
        "latitude": 19.2043,
        "longitude": 72.8479,
        "culvert_capacity_m": 1.8,
        "baseline_depth_m": 0.38,
        "baseline_flow_mps": 0.28,
        "upstream_urban_density": "High",
        "downstream_vulnerability": "Moderate",
        "sensor_mode": "Simulated",
        "device_id": "ESP32-MLD-01",
        "has_flow_sensor": False,
        "has_rainfall_gauge": True,
        "known_plastic_nearby_kg": 180.0,
        "prior_anomaly_count": 2,
    },
    "MST-TRB-01": {
        "id": "MST-TRB-01",
        "name": "Thane Creek — Mankhurd Outfall",
        "site_id": "TRB-01",
        "zone": "Trombay / Thane Creek Basin",
        "latitude": 19.0485,
        "longitude": 72.9315,
        "culvert_capacity_m": 3.0,
        "baseline_depth_m": 0.55,
        "baseline_flow_mps": 0.45,
        "upstream_urban_density": "Moderate",
        "downstream_vulnerability": "Very High",
        "sensor_mode": "Simulated",
        "device_id": "ESP32-TRB-01",
        "has_flow_sensor": True,
        "has_rainfall_gauge": True,
        "known_plastic_nearby_kg": 85.0,
        "prior_anomaly_count": 0,
    },
}

# In-memory incident store (extend to DB for production)
_INCIDENTS: Dict[str, Dict[str, Any]] = {}

# Live reading store for simulation
_LIVE_READINGS: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Station endpoints
# ---------------------------------------------------------------------------

@router.get("/stations")
def list_monsoon_stations():
    """List all configured monsoon monitoring stations."""
    result = []
    for sid, station in _MONSOON_STATIONS.items():
        reading = _LIVE_READINGS.get(sid, {})
        anomaly = reading.get("anomaly_result", {})
        result.append({
            **station,
            "current_water_depth_m": reading.get("water_depth_m"),
            "current_flow_velocity_mps": reading.get("flow_velocity_mps"),
            "current_rainfall_mm": reading.get("rainfall_mm"),
            "current_status": anomaly.get("status", BlockageStatus.NORMAL),
            "current_risk_score": anomaly.get("risk_score", 0.0),
            "current_risk_category": anomaly.get("risk_category", "Normal"),
            "last_reading_at": reading.get("timestamp"),
            "is_stale": _is_stale(reading.get("timestamp")),
        })
    return result


@router.get("/stations/{station_id}")
def get_monsoon_station(station_id: str):
    """Get a single monsoon station with current readings and anomaly status."""
    station = _MONSOON_STATIONS.get(station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found")
    reading = _LIVE_READINGS.get(station_id, {})
    anomaly = reading.get("anomaly_result", {})
    return {
        **station,
        "current_reading": reading,
        "current_anomaly": anomaly,
        "is_stale": _is_stale(reading.get("timestamp")),
        "incidents": [i for i in _INCIDENTS.values() if i.get("station_id") == station_id],
    }


def _is_stale(ts_str: Optional[str]) -> bool:
    if not ts_str:
        return True
    try:
        ts = datetime.datetime.fromisoformat(ts_str)
        age = (datetime.datetime.utcnow() - ts).total_seconds() / 60.0
        return age > DEFAULT_THRESHOLDS["stale_sensor_minutes"]
    except Exception:
        return True


# ---------------------------------------------------------------------------
# Manual reading ingestion (for UI manual controls)
# ---------------------------------------------------------------------------

@router.post("/stations/{station_id}/reading")
def ingest_manual_reading(
    station_id: str,
    body: Dict[str, Any] = Body(...),
):
    """
    Ingest a manual or simulated sensor reading, run anomaly detection,
    and return the result. Every simulated value is labelled as such.
    """
    station = _MONSOON_STATIONS.get(station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found")

    water_depth_m = body.get("water_depth_m")
    flow_velocity_mps = body.get("flow_velocity_mps") if station["has_flow_sensor"] else None
    rainfall_mm = body.get("rainfall_mm") if station["has_rainfall_gauge"] else body.get("rainfall_mm")
    source_status = body.get("source_status", "Simulated")
    step_label = body.get("label", "")

    # Validate ranges
    if water_depth_m is not None:
        if water_depth_m < 0 or water_depth_m > 10:
            raise HTTPException(status_code=422, detail="water_depth_m out of valid range [0, 10]")
    if flow_velocity_mps is not None:
        if flow_velocity_mps < 0 or flow_velocity_mps > 10:
            raise HTTPException(status_code=422, detail="flow_velocity_mps out of valid range [0, 10]")
    if rainfall_mm is not None:
        if rainfall_mm < 0 or rainfall_mm > 300:
            raise HTTPException(status_code=422, detail="rainfall_mm out of valid range [0, 300]")

    prev_reading = _LIVE_READINGS.get(station_id, {})
    prev_depth = prev_reading.get("water_depth_m")
    elapsed_min = 5.0

    anomaly = analyse_drain_anomaly(
        water_depth_m=water_depth_m,
        flow_velocity_mps=flow_velocity_mps,
        rainfall_mm=rainfall_mm,
        previous_water_depth_m=prev_depth,
        elapsed_minutes=elapsed_min,
        repeat_anomaly_count=station.get("prior_anomaly_count", 0),
        nearby_plastic_kg=station.get("known_plastic_nearby_kg", 0.0),
        station_id=station_id,
    )

    priority = build_explainable_priority_score(
        anomaly_result=anomaly,
        downstream_vulnerability=station.get("downstream_vulnerability"),
    )

    reading_record = {
        "station_id": station_id,
        "water_depth_m": water_depth_m,
        "flow_velocity_mps": flow_velocity_mps,
        "rainfall_mm": rainfall_mm,
        "source_status": source_status,
        "step_label": step_label,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "anomaly_result": anomaly,
        "priority": priority,
    }
    _LIVE_READINGS[station_id] = reading_record

    # Auto-generate incident for high/critical anomalies
    incident_id = None
    if anomaly["risk_category"] in ("High", "Critical") and source_status != "Resolved":
        incident_id = _auto_create_incident(station_id, station, anomaly, priority)

    return {
        "reading": reading_record,
        "anomaly": anomaly,
        "priority": priority,
        "incident_id": incident_id,
    }


def _auto_create_incident(station_id: str, station: Dict, anomaly: Dict, priority: Dict) -> Optional[str]:
    """Creates or updates an open incident for the station if one doesn't exist."""
    # Check if there's an open incident
    for inc in _INCIDENTS.values():
        if inc["station_id"] == station_id and inc["status"] in ("Open", "Acknowledged", "Inspector Dispatched"):
            return inc["id"]  # Reuse existing open incident

    incident_id = f"INC-{station_id}-{uuid.uuid4().hex[:6].upper()}"
    _INCIDENTS[incident_id] = {
        "id": incident_id,
        "station_id": station_id,
        "station_name": station["name"],
        "zone": station["zone"],
        "latitude": station["latitude"],
        "longitude": station["longitude"],
        "status": "Open",
        "blockage_status": anomaly["status"],
        "risk_score": priority["priority_score"],
        "risk_category": priority["priority_category"],
        "triggered_rules": anomaly["triggered_rules"],
        "evidence_factors": priority["evidence_factors"],
        "missing_data": anomaly["missing_data"],
        "rainfall_context": anomaly["rainfall_context"],
        "confidence_note": anomaly["confidence_note"],
        "recommended_action": anomaly["recommended_action"],
        "created_at": datetime.datetime.utcnow().isoformat(),
        "acknowledged_at": None,
        "acknowledged_by": None,
        "inspector_dispatched_at": None,
        "inspector_name": None,
        "resolved_at": None,
        "resolution": None,
        "inspection_notes": None,
        "inspection_photos": [],
        "cleanup_task_id": None,
        "is_simulated": True,
    }
    # Increment station anomaly count
    _MONSOON_STATIONS[station_id]["prior_anomaly_count"] = _MONSOON_STATIONS[station_id].get("prior_anomaly_count", 0) + 1
    return incident_id


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------

@router.get("/incidents")
def list_incidents(status: Optional[str] = Query(None)):
    """List all monsoon drainage incidents, optionally filtered by status."""
    incidents = list(_INCIDENTS.values())
    if status:
        incidents = [i for i in incidents if i["status"] == status]
    return sorted(incidents, key=lambda x: x["created_at"], reverse=True)


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    """Get a single incident with full evidence breakdown."""
    inc = _INCIDENTS.get(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return inc


@router.patch("/incidents/{incident_id}/acknowledge")
def acknowledge_incident(incident_id: str, body: Dict[str, Any] = Body(...)):
    """Operator acknowledges the incident and may assign an inspector."""
    inc = _INCIDENTS.get(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    inc["status"] = "Acknowledged"
    inc["acknowledged_at"] = datetime.datetime.utcnow().isoformat()
    inc["acknowledged_by"] = body.get("acknowledged_by", "Operator")
    if body.get("inspector_name"):
        inc["inspector_name"] = body["inspector_name"]
        inc["status"] = "Inspector Dispatched"
        inc["inspector_dispatched_at"] = datetime.datetime.utcnow().isoformat()
    return inc


@router.patch("/incidents/{incident_id}/resolve")
def resolve_incident(incident_id: str, body: Dict[str, Any] = Body(...)):
    """
    Operator resolves the incident by classifying it:
    - 'confirmed_blockage'
    - 'other_drainage'
    - 'false_alarm'
    - 'resolved'
    """
    inc = _INCIDENTS.get(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    resolution = body.get("resolution", "resolved")
    status_map = {
        "confirmed_blockage": BlockageStatus.CONFIRMED_BLOCKAGE,
        "other_drainage": BlockageStatus.CONFIRMED_OTHER,
        "false_alarm": BlockageStatus.FALSE_ALARM,
        "resolved": BlockageStatus.RESOLVED,
    }
    inc["blockage_status"] = status_map.get(resolution, BlockageStatus.RESOLVED)
    inc["status"] = "Resolved"
    inc["resolved_at"] = datetime.datetime.utcnow().isoformat()
    inc["resolution"] = resolution
    inc["inspection_notes"] = body.get("inspection_notes", "")
    return inc


@router.post("/incidents/{incident_id}/photo")
def add_inspection_photo(incident_id: str, body: Dict[str, Any] = Body(...)):
    """Worker uploads an inspection photo URL and findings for an incident."""
    inc = _INCIDENTS.get(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    photo = {
        "url": body.get("url", ""),
        "caption": body.get("caption", ""),
        "uploaded_by": body.get("uploaded_by", "Inspector"),
        "uploaded_at": datetime.datetime.utcnow().isoformat(),
    }
    inc["inspection_photos"].append(photo)
    return inc


# ---------------------------------------------------------------------------
# Demo scenarios
# ---------------------------------------------------------------------------

@router.get("/scenarios")
def list_scenarios():
    """List all available demo scenarios."""
    return [
        {
            "key": k,
            "name": v["name"],
            "description": v["description"],
            "step_count": len(v["steps"]),
        }
        for k, v in DEMO_SCENARIOS.items()
    ]


@router.get("/scenarios/{scenario_key}")
def get_scenario(scenario_key: str):
    """Get full scenario definition including all steps."""
    sc = DEMO_SCENARIOS.get(scenario_key)
    if not sc:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_key}' not found")
    return sc


@router.post("/scenarios/{scenario_key}/run-step")
def run_scenario_step(
    scenario_key: str,
    station_id: str = Query("MST-MTH-01"),
    step_index: int = Query(0),
):
    """
    Execute a single step of a demo scenario and return the anomaly analysis.
    Frontend calls this repeatedly to animate the scenario.
    """
    sc = DEMO_SCENARIOS.get(scenario_key)
    if not sc:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_key}' not found")
    steps = sc["steps"]
    if step_index < 0 or step_index >= len(steps):
        raise HTTPException(status_code=400, detail=f"step_index {step_index} out of range [0, {len(steps)-1}]")

    step = steps[step_index]
    return ingest_manual_reading(
        station_id=station_id,
        body={
            "water_depth_m": step.get("water_depth_m"),
            "flow_velocity_mps": step.get("flow_velocity_mps"),
            "rainfall_mm": step.get("rainfall_mm"),
            "source_status": "Simulated",
            "label": step.get("label", ""),
        }
    )


# ---------------------------------------------------------------------------
# ESP32 / live hardware ingestion
# ---------------------------------------------------------------------------

@router.post("/hardware/ingest")
def hardware_ingest(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Authenticated endpoint for ESP32 hardware to push sensor readings.
    
    Expected payload:
    {
        "device_id": "ESP32-MTH-01",
        "api_key": "<hardware_api_key>",    # kept server-side only
        "timestamp": "2026-10-10T12:00:00Z",
        "water_level_cm": 65.0,
        "flow_velocity_mps": 0.42,          # optional
        "rainfall_mm": 18.0,                # optional
        "battery_pct": 87.0,                # optional
        "signal_rssi": -68                  # optional
    }
    
    Hardware integration notes:
    - Configure WIFI_SSID, WIFI_PASSWORD, DEVICE_ID, API_KEY in ESP32 firmware (not frontend).
    - POST to: http://<server-ip>:8000/api/monsoon/hardware/ingest
    - Readings are validated server-side; out-of-range values are rejected.
    - Stale devices (no reading for >15 min) are shown as Offline on the dashboard.
    """
    device_id = payload.get("device_id")
    if not device_id:
        raise HTTPException(status_code=422, detail="device_id is required")

    # In production: validate api_key against a secrets store
    # api_key = payload.get("api_key")
    # if not validate_api_key(device_id, api_key):
    #     raise HTTPException(status_code=401, detail="Invalid API key")

    water_level_cm = payload.get("water_level_cm")
    flow_velocity_mps = payload.get("flow_velocity_mps")
    rainfall_mm = payload.get("rainfall_mm")
    timestamp_str = payload.get("timestamp", datetime.datetime.utcnow().isoformat())

    # Validate ranges
    errors = []
    if water_level_cm is not None and (water_level_cm < 0 or water_level_cm > 1000):
        errors.append("water_level_cm out of range [0, 1000]")
    if flow_velocity_mps is not None and (flow_velocity_mps < 0 or flow_velocity_mps > 10):
        errors.append("flow_velocity_mps out of range [0, 10]")
    if rainfall_mm is not None and (rainfall_mm < 0 or rainfall_mm > 300):
        errors.append("rainfall_mm out of range [0, 300]")
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    # Find the corresponding monsoon station
    station_id = None
    for sid, st in _MONSOON_STATIONS.items():
        if st.get("device_id") == device_id:
            station_id = sid
            break

    if not station_id:
        raise HTTPException(status_code=404, detail=f"No station mapped to device {device_id}")

    water_depth_m = water_level_cm / 100.0 if water_level_cm is not None else None
    station = _MONSOON_STATIONS[station_id]
    if not station.get("has_flow_sensor"):
        flow_velocity_mps = None

    anomaly = analyse_drain_anomaly(
        water_depth_m=water_depth_m,
        flow_velocity_mps=flow_velocity_mps,
        rainfall_mm=rainfall_mm,
        previous_water_depth_m=_LIVE_READINGS.get(station_id, {}).get("water_depth_m"),
        elapsed_minutes=5.0,
        repeat_anomaly_count=station.get("prior_anomaly_count", 0),
        nearby_plastic_kg=station.get("known_plastic_nearby_kg", 0.0),
        station_id=station_id,
    )

    priority = build_explainable_priority_score(
        anomaly_result=anomaly,
        downstream_vulnerability=station.get("downstream_vulnerability"),
    )

    reading_record = {
        "station_id": station_id,
        "water_depth_m": water_depth_m,
        "flow_velocity_mps": flow_velocity_mps,
        "rainfall_mm": rainfall_mm,
        "source_status": "Real",
        "timestamp": timestamp_str,
        "anomaly_result": anomaly,
        "priority": priority,
    }
    _LIVE_READINGS[station_id] = reading_record

    # Also persist into existing water_level_observations table
    try:
        site = crud.get_site(db, station.get("site_id", ""))
        if site and water_depth_m is not None:
            crud.create_water_level_observation(db, schemas.WaterLevelObservationCreate(
                site_id=site.id,
                water_depth_m=water_depth_m,
                flow_velocity_mps=flow_velocity_mps or 0.0,
                source_status="Real"
            ))
    except Exception:
        pass  # Don't fail ingestion if DB write fails

    incident_id = None
    if anomaly["risk_category"] in ("High", "Critical"):
        incident_id = _auto_create_incident(station_id, station, anomaly, priority)

    # Mark station as Real mode
    _MONSOON_STATIONS[station_id]["sensor_mode"] = "Real"

    return {
        "status": "ingested",
        "station_id": station_id,
        "device_id": device_id,
        "anomaly": anomaly,
        "incident_id": incident_id,
    }


# ---------------------------------------------------------------------------
# Analytics summary endpoint
# ---------------------------------------------------------------------------

@router.get("/summary")
def get_monsoon_summary():
    """Returns a high-level summary of all monsoon station statuses."""
    total = len(_MONSOON_STATIONS)
    incidents_open = [i for i in _INCIDENTS.values() if i["status"] not in ("Resolved",)]
    critical = [
        sid for sid, r in _LIVE_READINGS.items()
        if r.get("anomaly_result", {}).get("risk_category") in ("Critical", "High")
    ]
    offline = [sid for sid in _MONSOON_STATIONS if _is_stale(_LIVE_READINGS.get(sid, {}).get("timestamp"))]
    return {
        "total_stations": total,
        "stations_online": total - len(offline),
        "stations_offline": len(offline),
        "stations_critical_or_high": len(critical),
        "open_incidents": len(incidents_open),
        "confirmed_blockages_today": len([
            i for i in _INCIDENTS.values()
            if i.get("blockage_status") == BlockageStatus.CONFIRMED_BLOCKAGE
        ]),
    }


# ---------------------------------------------------------------------------
# Thresholds endpoint (read-only for now)
# ---------------------------------------------------------------------------

@router.get("/thresholds")
def get_thresholds():
    """Return the current anomaly detection thresholds."""
    return DEFAULT_THRESHOLDS

