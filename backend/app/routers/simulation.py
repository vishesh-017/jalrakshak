import datetime
import random
import json
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app import crud, models, schemas
from app.ai.forecaster import forecaster
from app.seed_data import seed_database

router = APIRouter(prefix="/simulation", tags=["Monsoon Simulation & Demo Engine"])

@router.post("/trigger-storm")
def trigger_monsoon_downpour_simulation(
    intensity: str = Body("Severe Cloudburst (110mm)", embed=True),
    tide_surge_m: float = Body(4.6, embed=True),
    db: Session = Depends(get_db)
):
    """
    Simulates a major monsoon downpour across Mumbai nullahs and creeks.
    Updates rainfall observations, tide surge, recalculates risk scores,
    and updates site statuses with 'Simulated' source status.
    """
    now = datetime.datetime.utcnow()
    sites = db.query(models.MonitoringSite).all()

    rain_map = {
        "Moderate Rain (35mm)": (35.0, 50.0),
        "Heavy Downpour (75mm)": (75.0, 95.0),
        "Severe Cloudburst (110mm)": (110.0, 140.0)
    }
    r24, fc24 = rain_map.get(intensity, (110.0, 140.0))

    # Add simulated high tide
    db.add(models.TideObservation(
        timestamp=now,
        station_name="Apollo Bunder / Gateway Gauge",
        tide_level_m=tide_surge_m,
        tide_phase="High Tide (Spring Peak)",
        lunar_cycle="Full Moon Surge",
        source_status="Simulated"
    ))

    impacted_sites = []

    for s in sites:
        # Mithi and Malad experience higher localized runoff
        multiplier = 1.15 if "MTH" in s.id else (1.05 if "MLD" in s.id else 0.9)
        site_r24 = round(r24 * multiplier, 1)
        site_fc24 = round(fc24 * multiplier, 1)

        # Log simulated rainfall observation
        db.add(models.RainfallObservation(
            site_id=s.id,
            timestamp=now,
            rainfall_1h_mm=round(site_r24 * 0.25, 1),
            rainfall_24h_mm=site_r24,
            forecast_24h_mm=site_fc24,
            sensor_id=f"SIM-ARG-{s.id[:3]}",
            source_status="Simulated"
        ))

        # Add simulated water level rise
        water_depth = round(1.2 + (site_r24 / 45.0) + (tide_surge_m * 0.2), 2)
        db.add(models.WaterLevelObservation(
            site_id=s.id,
            timestamp=now,
            water_depth_m=water_depth,
            discharge_cumecs=round(water_depth * 5.2, 1),
            flow_velocity_mps=round(1.2 + (water_depth * 0.3), 2),
            source_status="Simulated"
        ))

        # Predict new risk
        pred = forecaster.predict_outlet_risk(
            rainfall_24h_mm=site_r24,
            rainfall_forecast_24h_mm=site_fc24,
            tide_level_m=tide_surge_m,
            tide_phase="High Tide (Spring Peak)",
            upstream_urban_density=s.upstream_urban_density,
            barrier_status=s.barrier_status,
            catchment_area_sqkm=s.catchment_area_sqkm,
            current_water_depth_m=water_depth
        )

        s.current_risk_score = pred["risk_score"]
        s.current_risk_level = pred["risk_level"]
        if pred["risk_level"] in ["Critical", "High"]:
            s.response_status = "Watch Alert"

        # Save simulated forecast
        db.add(models.RiskForecast(
            site_id=s.id,
            timestamp=now,
            horizon_hours=24,
            risk_score=pred["risk_score"],
            risk_level=pred["risk_level"],
            predicted_plastic_volume_kg=pred["predicted_plastic_volume_kg"],
            choke_probability_pct=pred["choke_probability_pct"],
            factors_json=json.dumps(pred["factors"]),
            action_recommendation=pred["action_recommendation"],
            source_status="Simulated"
        ))

        impacted_sites.append({
            "site_id": s.id,
            "name": s.name,
            "new_risk_score": pred["risk_score"],
            "new_risk_level": pred["risk_level"],
            "predicted_plastic_kg": pred["predicted_plastic_volume_kg"]
        })

    db.commit()

    return {
        "message": f"Simulated {intensity} event with {tide_surge_m}m spring tide successfully executed.",
        "simulated_rainfall_mm": r24,
        "simulated_tide_m": tide_surge_m,
        "impacted_sites": impacted_sites
    }

@router.post("/clear-simulated")
def clear_simulated_records(db: Session = Depends(get_db)):
    """
    Cleans out only 'Simulated' observations from the database, preserving Real,
    Manually entered, and Imported observations to ensure data integrity.
    """
    del_rain = db.query(models.RainfallObservation).filter(models.RainfallObservation.source_status == "Simulated").delete()
    del_tide = db.query(models.TideObservation).filter(models.TideObservation.source_status == "Simulated").delete()
    del_water = db.query(models.WaterLevelObservation).filter(models.WaterLevelObservation.source_status == "Simulated").delete()
    del_det = db.query(models.PlasticDetection).filter(models.PlasticDetection.source_status == "Simulated").delete()
    del_fc = db.query(models.RiskForecast).filter(models.RiskForecast.source_status == "Simulated").delete()
    db.commit()

    return {
        "message": "Simulated records cleared successfully. Real and operational data preserved.",
        "deleted_counts": {
            "rainfall": del_rain,
            "tide": del_tide,
            "water_level": del_water,
            "detections": del_det,
            "forecasts": del_fc
        }
    }

@router.post("/reset-demo-database")
def reset_database_to_initial_seed(db: Session = Depends(get_db)):
    """Resets the entire database back to default initial seed scenario."""
    from app.database import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_database(db)
    return {"message": "JalRakshak database reset and re-seeded with pristine Mumbai pilot data."}
