from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import crud, models, schemas

router = APIRouter(prefix="/analytics", tags=["Analytics & Reporting"])

@router.get("/overview", response_model=schemas.DashboardOverviewMetrics)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Provides high-level real-time operational metrics for municipal overview dashboard."""
    metrics = crud.get_dashboard_metrics(db)
    return metrics

@router.get("/basin-comparison")
def get_basin_comparison(db: Session = Depends(get_db)):
    """Compares Mithi River, Malad Creek, and Trombay/Thane Creek across recovery, risk, and sites."""
    zones = ["Mithi River Basin", "Malad Creek Basin", "Trombay / Thane Creek Basin"]
    comparison = []

    for z in zones:
        sites_in_zone = db.query(models.MonitoringSite).filter(models.MonitoringSite.zone == z).all()
        site_ids = [s.id for s in sites_in_zone]
        
        avg_risk = sum(s.current_risk_score for s in sites_in_zone) / max(1, len(sites_in_zone))
        high_risk_count = sum(1 for s in sites_in_zone if s.current_risk_score >= 60.0)

        # Recovered in this zone
        recovered_kg = db.query(func.sum(models.RecoveryRecord.total_weight_kg)).filter(
            models.RecoveryRecord.site_id.in_(site_ids)
        ).scalar() or 0.0

        # Detections
        det_count = db.query(models.PlasticDetection).filter(
            models.PlasticDetection.site_id.in_(site_ids)
        ).count()

        comparison.append({
            "zone": z,
            "monitored_sites": len(sites_in_zone),
            "average_risk_score": round(avg_risk, 1),
            "high_risk_sites": high_risk_count,
            "total_recovered_kg": round(recovered_kg, 1),
            "detection_events": det_count
        })

    return comparison

@router.get("/plastic-composition")
def get_plastic_composition(db: Session = Depends(get_db)):
    """Aggregates recovered plastic by polymer / item classification."""
    pet = db.query(func.sum(models.RecoveryRecord.pet_bottles_kg)).scalar() or 0.0
    polybags = db.query(func.sum(models.RecoveryRecord.polyethylene_bags_kg)).scalar() or 0.0
    multilayer = db.query(func.sum(models.RecoveryRecord.multilayer_packaging_kg)).scalar() or 0.0
    styrofoam = db.query(func.sum(models.RecoveryRecord.styrofoam_and_hard_plastics_kg)).scalar() or 0.0
    total = pet + polybags + multilayer + styrofoam or 1.0

    return [
        {"category": "PET Beverage Bottles", "weight_kg": round(pet, 1), "percentage": round((pet/total)*100, 1), "color": "#2563eb"},
        {"category": "Polyethylene Bags & Sachets", "weight_kg": round(polybags, 1), "percentage": round((polybags/total)*100, 1), "color": "#ea580c"},
        {"category": "Multilayer Food Packaging", "weight_kg": round(multilayer, 1), "percentage": round((multilayer/total)*100, 1), "color": "#0d9488"},
        {"category": "Expanded Styrofoam & Rigid Plastics", "weight_kg": round(styrofoam, 1), "percentage": round((styrofoam/total)*100, 1), "color": "#d97706"},
    ]

@router.get("/data-integrity")
def get_data_integrity_breakdown(db: Session = Depends(get_db)):
    """
    Shows provenance across all observations: Real vs Simulated vs Manually entered vs Imported.
    Guarantees transparent auditing without mixing simulated entries into real data validation.
    """
    metrics = crud.get_dashboard_metrics(db)
    breakdown = metrics["source_breakdown"]
    total = sum(breakdown.values()) or 1
    
    return [
        {"source": "Real (Sensor & Direct Field Camera)", "count": breakdown.get("Real", 0), "percentage": round((breakdown.get("Real", 0)/total)*100, 1), "badge_color": "emerald"},
        {"source": "Simulated (Storm Scenario Engine)", "count": breakdown.get("Simulated", 0), "percentage": round((breakdown.get("Simulated", 0)/total)*100, 1), "badge_color": "purple"},
        {"source": "Manually entered (Ward Inspector Patrol)", "count": breakdown.get("Manually entered", 0), "percentage": round((breakdown.get("Manually entered", 0)/total)*100, 1), "badge_color": "amber"},
        {"source": "Imported (Municipal & Satellite Ingest)", "count": breakdown.get("Imported", 0), "percentage": round((breakdown.get("Imported", 0)/total)*100, 1), "badge_color": "blue"},
    ]
