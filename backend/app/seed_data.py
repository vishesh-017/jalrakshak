import os
import datetime
import random
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app import models
from app.config import settings

def create_sample_feed_images():
    """Generates realistic illustrative CCTV/drone creek surveillance frames for testing."""
    os.makedirs(settings.SAMPLES_DIR, exist_ok=True)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    samples = [
        {
            "filename": "mithi_mahim_boom_cctv.jpg",
            "title": "Mithi River Mahim Causeway Trash Boom",
            "debris_count": 16,
            "water_color": (38, 48, 56) # Murky tidal estuary
        },
        {
            "filename": "kurla_bkc_culvert_cam.jpg",
            "title": "Kurla BKC High-Density Nullah",
            "debris_count": 24,
            "water_color": (30, 40, 42)
        },
        {
            "filename": "malad_marve_drone_survey.jpg",
            "title": "Malad Creek Mangrove Margin Drone",
            "debris_count": 12,
            "water_color": (45, 60, 50)
        },
        {
            "filename": "trombay_canal_patrol.jpg",
            "title": "Trombay Mahul Outfall Water Camera",
            "debris_count": 18,
            "water_color": (34, 45, 52)
        }
    ]

    for sample in samples:
        filepath = os.path.join(settings.SAMPLES_DIR, sample["filename"])
        if not os.path.exists(filepath):
            # Create synthetic creek CCTV view
            w, h = 800, 600
            img = np.zeros((h, w, 3), dtype=np.uint8)
            base_col = sample["water_color"]
            
            # Water ripples and gradient
            for y in range(h):
                noise = int(math.sin(y / 15.0) * 10)
                img[y, :] = [
                    np.clip(base_col[0] + noise + int(random.gauss(0, 3)), 0, 255),
                    np.clip(base_col[1] + noise + int(random.gauss(0, 3)), 0, 255),
                    np.clip(base_col[2] + noise + int(random.gauss(0, 3)), 0, 255),
                ]

            # Draw concrete canal embankments or trash boom line
            cv2.line(img, (0, 220), (w, 280), (70, 75, 80), 12) # Yellow/black trash boom barrier
            for x in range(0, w, 40):
                cv2.circle(img, (x, int(220 + (x/w)*60)), 10, (0, 180, 230), -1) # Yellow boom buoys

            # Add floating debris (bottles, bags, styrofoam)
            rng = random.Random(sample["debris_count"] * 101)
            for _ in range(sample["debris_count"]):
                bx = rng.randint(40, w - 80)
                by = rng.randint(260, h - 60)
                dtype = rng.choice(["bottle", "bag", "styrofoam", "pouch"])

                if dtype == "bottle":
                    # Blue/clear PET bottle
                    cv2.ellipse(img, (bx, by), (18, 7), rng.randint(-30, 30), 0, 360, (210, 160, 40), -1)
                    cv2.ellipse(img, (bx, by), (18, 7), rng.randint(-30, 30), 0, 360, (255, 255, 255), 1)
                elif dtype == "bag":
                    # Red/White polythene bag
                    pts = np.array([
                        [bx, by],
                        [bx + rng.randint(15, 30), by - rng.randint(5, 15)],
                        [bx + rng.randint(25, 45), by + rng.randint(10, 25)],
                        [bx + rng.randint(5, 20), by + rng.randint(20, 35)]
                    ], np.int32)
                    cv2.fillPoly(img, [pts], (40, 60, 220))
                elif dtype == "styrofoam":
                    # White chunk
                    cv2.rectangle(img, (bx, by), (bx + rng.randint(15, 30), by + rng.randint(12, 22)), (240, 245, 245), -1)
                else:
                    # Silver/foil multilayer wrapper
                    cv2.rectangle(img, (bx, by), (bx + 14, by + 18), (160, 180, 190), -1)

            # Add CCTV HUD watermark
            hud_text = f"JALRAKSHAK LIVE FEED - {sample['title'].upper()} | 25 FPS | MONSOON SURVEILLANCE"
            cv2.putText(img, hud_text, (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 200), 1, cv2.LINE_AA)
            cv2.putText(img, f"TS: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1, cv2.LINE_AA)

            cv2.imwrite(filepath, img)

import math

def seed_database(db: Session):
    # Check if already seeded
    if db.query(models.MonitoringSite).count() > 0:
        return

    print("Seeding JalRakshak database with Mumbai pilot locations and operational records...")

    create_sample_feed_images()

    # 1. Monitoring Sites
    pilot_sites = [
        # Mithi River Basin
        {
            "id": "MTH-01",
            "name": "Mahim Causeway Tidal Outlet",
            "zone": "Mithi River Basin",
            "location_description": "Illustrative Pilot Point: Outfall where Mithi discharges into Mahim Bay. High tidal backflow & trash boom capture site.",
            "latitude": 19.0435,
            "longitude": 72.8423,
            "catchment_area_sqkm": 14.2,
            "upstream_urban_density": "Very High",
            "barrier_type": "Heavy Floating Trash Boom",
            "barrier_status": "Partially Blocked",
            "last_cleanup_date": "2026-09-28",
            "response_status": "Watch Alert",
            "current_risk_score": 84.5,
            "current_risk_level": "Critical",
            "is_pilot_active": True
        },
        {
            "id": "MTH-02",
            "name": "Kurla BKC Nullah Confluence",
            "zone": "Mithi River Basin",
            "location_description": "Illustrative Pilot Point: Convergence of Kurla residential storm canal and BKC commercial corridor.",
            "latitude": 19.0662,
            "longitude": 72.8715,
            "catchment_area_sqkm": 8.7,
            "upstream_urban_density": "Very High",
            "barrier_type": "Hydraulic Trash Rack Screen",
            "barrier_status": "Operational",
            "last_cleanup_date": "2026-10-01",
            "response_status": "Cleanup Dispatched",
            "current_risk_score": 72.0,
            "current_risk_level": "High",
            "is_pilot_active": True
        },
        {
            "id": "MTH-03",
            "name": "Kalina Culvert & CST Road Sluice",
            "zone": "Mithi River Basin",
            "location_description": "Illustrative Pilot Point: Drainage constriction culvert near CST Road bridge & domestic plastic corridor.",
            "latitude": 19.0740,
            "longitude": 72.8611,
            "catchment_area_sqkm": 6.3,
            "upstream_urban_density": "High",
            "barrier_type": "Gravity Sluice Gate & Net",
            "barrier_status": "Operational",
            "last_cleanup_date": "2026-09-29",
            "response_status": "Normal Monitoring",
            "current_risk_score": 54.0,
            "current_risk_level": "Medium",
            "is_pilot_active": True
        },
        {
            "id": "MTH-04",
            "name": "Powai Lake Spillway Outfall",
            "zone": "Mithi River Basin",
            "location_description": "Illustrative Pilot Point: Headwaters spillway of Mithi River originating from Powai catchment.",
            "latitude": 19.1215,
            "longitude": 72.9056,
            "catchment_area_sqkm": 5.1,
            "upstream_urban_density": "Moderate",
            "barrier_type": "Floating Netting Barrier",
            "barrier_status": "Operational",
            "last_cleanup_date": "2026-10-02",
            "response_status": "Normal Monitoring",
            "current_risk_score": 28.5,
            "current_risk_level": "Low",
            "is_pilot_active": True
        },

        # Malad Creek Basin
        {
            "id": "MLD-01",
            "name": "Malad Marve Creek Mangrove Mouth",
            "zone": "Malad Creek Basin",
            "location_description": "Illustrative Pilot Point: Mangrove estuary confluence susceptible to plastic entrapment in aerial roots.",
            "latitude": 19.1912,
            "longitude": 72.8124,
            "catchment_area_sqkm": 11.4,
            "upstream_urban_density": "High",
            "barrier_type": "Eco-Boom & Silt Trap",
            "barrier_status": "Partially Blocked",
            "last_cleanup_date": "2026-09-27",
            "response_status": "Watch Alert",
            "current_risk_score": 78.0,
            "current_risk_level": "High",
            "is_pilot_active": True
        },
        {
            "id": "MLD-02",
            "name": "Goregaon SV Road Storm Nullah",
            "zone": "Malad Creek Basin",
            "location_description": "Illustrative Pilot Point: High-velocity storm drain carrying commercial single-use packaging runoff.",
            "latitude": 19.1620,
            "longitude": 72.8410,
            "catchment_area_sqkm": 7.8,
            "upstream_urban_density": "Very High",
            "barrier_type": "Trash Screen Grate",
            "barrier_status": "Operational",
            "last_cleanup_date": "2026-09-30",
            "response_status": "Normal Monitoring",
            "current_risk_score": 48.0,
            "current_risk_level": "Medium",
            "is_pilot_active": True
        },
        {
            "id": "MLD-03",
            "name": "Oshiwara River Confluence",
            "zone": "Malad Creek Basin",
            "location_description": "Illustrative Pilot Point: Oshiwara nullah junction with Lokhandwala mangrove corridor.",
            "latitude": 19.1485,
            "longitude": 72.8258,
            "catchment_area_sqkm": 9.2,
            "upstream_urban_density": "High",
            "barrier_type": "Twin Trash Boom",
            "barrier_status": "Operational",
            "last_cleanup_date": "2026-10-01",
            "response_status": "Normal Monitoring",
            "current_risk_score": 52.0,
            "current_risk_level": "Medium",
            "is_pilot_active": True
        },

        # Trombay / Thane Creek Basin
        {
            "id": "TRM-01",
            "name": "Trombay Jetty Canal Outfall",
            "zone": "Trombay / Thane Creek Basin",
            "location_description": "Illustrative Pilot Point: Coastal canal outlet into Thane Creek adjacent to coastal mangrove mudflats.",
            "latitude": 19.0128,
            "longitude": 72.9150,
            "catchment_area_sqkm": 6.8,
            "upstream_urban_density": "High",
            "barrier_type": "Floating Net Boom",
            "barrier_status": "Operational",
            "last_cleanup_date": "2026-09-29",
            "response_status": "Normal Monitoring",
            "current_risk_score": 38.0,
            "current_risk_level": "Medium",
            "is_pilot_active": True
        },
        {
            "id": "TRM-02",
            "name": "Chembur Mahul Industrial Drain",
            "zone": "Trombay / Thane Creek Basin",
            "location_description": "Illustrative Pilot Point: Heavy municipal & industrial drainage culvert draining Chembur basin.",
            "latitude": 19.0085,
            "longitude": 72.8942,
            "catchment_area_sqkm": 8.5,
            "upstream_urban_density": "High",
            "barrier_type": "Hydraulic Screen",
            "barrier_status": "Operational",
            "last_cleanup_date": "2026-09-26",
            "response_status": "Watch Alert",
            "current_risk_score": 64.0,
            "current_risk_level": "High",
            "is_pilot_active": True
        },
        {
            "id": "TRM-03",
            "name": "Vashi Creek Thane Basin Edge",
            "zone": "Trombay / Thane Creek Basin",
            "location_description": "Illustrative Pilot Point: Broad tidal estuarine boundary monitoring macro-debris dispersion into harbor.",
            "latitude": 19.0650,
            "longitude": 72.9780,
            "catchment_area_sqkm": 15.0,
            "upstream_urban_density": "Moderate",
            "barrier_type": "Estuarine Silt & Debris Curtain",
            "barrier_status": "Operational",
            "last_cleanup_date": "2026-10-02",
            "response_status": "Normal Monitoring",
            "current_risk_score": 24.0,
            "current_risk_level": "Low",
            "is_pilot_active": True
        }
    ]

    for site_dict in pilot_sites:
        db.add(models.MonitoringSite(**site_dict))
    db.commit()

    # 2. Rainfall Observations (with explicit source status: Real, Simulated, Manually entered, Imported)
    source_choices = ["Real", "Simulated", "Manually entered", "Imported"]
    now = datetime.datetime.utcnow()

    for site in pilot_sites:
        # Add 3 historical observations per site
        for hours_ago, r1h, r24h, fc24h, src in [
            (24, 5.0, 32.0, 45.0, "Imported"),
            (12, 18.5, 68.0, 92.0, "Real"),
            (1, 14.0, 85.5, 110.0 if "MTH" in site["id"] else 60.0, "Real" if site["id"] == "MTH-01" else "Simulated")
        ]:
            db.add(models.RainfallObservation(
                site_id=site["id"],
                timestamp=now - datetime.timedelta(hours=hours_ago),
                rainfall_1h_mm=r1h,
                rainfall_24h_mm=r24h,
                forecast_24h_mm=fc24h,
                sensor_id=f"ARG-{site['id'][:3]}-01",
                source_status=src
            ))

    # 3. Tide Observations (Apollo Bunder coastal gauge)
    tide_data = [
        (18, 1.45, "Low Tide (Neap)", "First Quarter", "Real"),
        (12, 3.20, "Flood Tide", "First Quarter", "Imported"),
        (6, 4.45, "High Tide (Spring)", "Full Moon", "Real"), # High surge
        (1, 3.90, "Ebb Tide", "Full Moon", "Real")
    ]
    for h_ago, level, phase, lunar, src in tide_data:
        db.add(models.TideObservation(
            timestamp=now - datetime.timedelta(hours=h_ago),
            station_name="Apollo Bunder / Gateway Coastal Station",
            tide_level_m=level,
            tide_phase=phase,
            lunar_cycle=lunar,
            source_status=src
        ))

    # 4. Water Level Observations
    for site in pilot_sites:
        depth = 2.4 if site["id"] in ["MTH-01", "MTH-02"] else 1.3
        db.add(models.WaterLevelObservation(
            site_id=site["id"],
            timestamp=now - datetime.timedelta(hours=1),
            water_depth_m=depth,
            discharge_cumecs=round(depth * 4.8, 1),
            flow_velocity_mps=1.8 if depth > 2.0 else 0.9,
            source_status="Real" if site["id"].startswith("MTH") else "Simulated"
        ))

    # 5. Seed Plastic Detections using our sample images
    cctv_samples = [
        ("MTH-01", "mithi_mahim_boom_cctv.jpg", "CCTV Creek Camera", 18, 7, 6, 3, 2, 0.72, 1.25, 0.88, "Real"),
        ("MTH-02", "kurla_bkc_culvert_cam.jpg", "CCTV Creek Camera", 24, 11, 8, 3, 2, 0.96, 1.68, 0.85, "Real"),
        ("MLD-01", "malad_marve_drone_survey.jpg", "Drone Aerial Survey", 12, 4, 5, 2, 1, 0.48, 0.75, 0.91, "Imported"),
        ("TRM-01", "trombay_canal_patrol.jpg", "Mobile Patrol Upload", 15, 6, 4, 3, 2, 0.60, 0.94, 0.84, "Manually entered")
    ]

    for site_id, filename, src_type, total, bot, bag, oth, sty, dens, mass, conf, src_status in cctv_samples:
        img_path = os.path.join(settings.SAMPLES_DIR, filename)
        # Bounding box mockups
        boxes = []
        for i in range(min(total, 6)):
            boxes.append({
                "box": [100 + i*40, 150 + i*30, 160 + i*40, 210 + i*30],
                "box_normalized": [round((100+i*40)/800, 3), round((150+i*30)/600, 3), round((160+i*40)/800, 3), round((210+i*30)/600, 3)],
                "class_name": "PLASTIC_BOTTLE" if i % 2 == 0 else "PLASTIC_BAG",
                "confidence": round(conf - i*0.02, 2)
            })

        db.add(models.PlasticDetection(
            site_id=site_id,
            timestamp=now - datetime.timedelta(hours=random.randint(1, 8)),
            image_path=img_path,
            image_source_type=src_type,
            total_objects_detected=total,
            plastic_bottle_count=bot,
            plastic_bag_count=bag,
            other_plastic_count=oth,
            styrofoam_count=sty,
            plastic_density_index=dens,
            estimated_surface_mass_kg=mass,
            confidence_avg=conf,
            bounding_boxes_json=json.dumps(boxes),
            source_status=src_status,
            notes=f"Automated scan from pilot station {site_id}"
        ))

    # 6. Seed Cleanup Tasks
    tasks = [
        {
            "site_id": "MTH-01",
            "title": "Clear Mahim Causeway Floating Trash Boom",
            "priority": "Critical",
            "status": "In Progress",
            "team_name": "BMC Coastal Trash Skimmer Unit 1",
            "equipment_assigned": "River Trash Skimmer Boat & Crane",
            "target_date": "2026-10-04",
            "dispatched_at": now - datetime.timedelta(hours=3),
            "estimated_load_kg": 850.0,
            "notes": "High plastic accumulation backed up against tidal boom after 85mm rainfall."
        },
        {
            "site_id": "MTH-02",
            "title": "Kurla BKC Culvert Desilting & Screen Unclogging",
            "priority": "High",
            "status": "Dispatched",
            "team_name": "Ward L & H-East Rapid Cleanup Crew",
            "equipment_assigned": "JCB Excavator & Silt Screen Winch",
            "target_date": "2026-10-04",
            "dispatched_at": now - datetime.timedelta(hours=1),
            "estimated_load_kg": 620.0,
            "notes": "Drainage velocity slowed due to single-use bag blockages."
        },
        {
            "site_id": "MLD-01",
            "title": "Malad Marve Mangrove Netting Patrol",
            "priority": "High",
            "status": "Pending",
            "team_name": "Mangrove Cell Coastal Taskforce",
            "equipment_assigned": "Manual Netting Waders & Eco-Boat",
            "target_date": "2026-10-05",
            "estimated_load_kg": 340.0,
            "notes": "Targeted recovery of PET bottles trapped in Avicennia mangrove roots."
        },
        {
            "site_id": "TRM-02",
            "title": "Chembur Mahul Sluice Gate Maintenance & Waste Lift",
            "priority": "Medium",
            "status": "Completed",
            "team_name": "Zone V Stormwater Operations",
            "equipment_assigned": "Hydraulic Grab Crane",
            "target_date": "2026-10-03",
            "dispatched_at": now - datetime.timedelta(hours=28),
            "completed_at": now - datetime.timedelta(hours=14),
            "estimated_load_kg": 490.0,
            "notes": "Completed safely during low-tide window."
        }
    ]

    for t in tasks:
        db.add(models.CleanupTask(**t))
    db.commit()

    # 7. Seed Recovery Records (Verified audit ledger)
    recoveries = [
        {
            "task_id": 4, # Chembur task
            "site_id": "TRM-02",
            "recovery_date": "2026-10-03",
            "total_weight_kg": 512.5,
            "pet_bottles_kg": 184.0,
            "polyethylene_bags_kg": 210.5,
            "multilayer_packaging_kg": 85.0,
            "styrofoam_and_hard_plastics_kg": 33.0,
            "disposal_facility": "Bhandup Material Recovery Facility",
            "manifest_number": "MNF-MUM-261003-TRM02",
            "verification_status": "Verified",
            "verifier_name": "Dr. R. K. Shinde (MPCB Senior Inspector)",
            "source_status": "Real",
            "proof_image_url": "/api/static/sample_feeds/trombay_canal_patrol.jpg"
        },
        {
            "task_id": None,
            "site_id": "MTH-01",
            "recovery_date": "2026-09-28",
            "total_weight_kg": 1420.0,
            "pet_bottles_kg": 620.0,
            "polyethylene_bags_kg": 480.0,
            "multilayer_packaging_kg": 210.0,
            "styrofoam_and_hard_plastics_kg": 110.0,
            "disposal_facility": "Deonar Waste-to-Energy Co-processing",
            "manifest_number": "MNF-MUM-260928-MTH01",
            "verification_status": "Verified",
            "verifier_name": "BMC SWM Enforcement Officer A. Mehta",
            "source_status": "Real",
            "proof_image_url": "/api/static/sample_feeds/mithi_mahim_boom_cctv.jpg"
        },
        {
            "task_id": None,
            "site_id": "MLD-02",
            "recovery_date": "2026-09-30",
            "total_weight_kg": 380.0,
            "pet_bottles_kg": 145.0,
            "polyethylene_bags_kg": 160.0,
            "multilayer_packaging_kg": 55.0,
            "styrofoam_and_hard_plastics_kg": 20.0,
            "disposal_facility": "Dharavi Co-operative Recyclers Guild",
            "manifest_number": "MNF-MUM-260930-MLD02",
            "verification_status": "Pending Verification",
            "verifier_name": None,
            "source_status": "Manually entered",
            "proof_image_url": "/api/static/sample_feeds/malad_marve_drone_survey.jpg"
        },
        {
            "task_id": None,
            "site_id": "MTH-03",
            "recovery_date": "2026-09-29",
            "total_weight_kg": 290.0,
            "pet_bottles_kg": 110.0,
            "polyethylene_bags_kg": 120.0,
            "multilayer_packaging_kg": 40.0,
            "styrofoam_and_hard_plastics_kg": 20.0,
            "disposal_facility": "Taloja Cement Kiln Co-processing",
            "manifest_number": "MNF-MUM-260929-MTH03",
            "verification_status": "Verified",
            "verifier_name": "Inspection Lead P. Jadhav",
            "source_status": "Imported",
            "proof_image_url": "/api/static/sample_feeds/kurla_bkc_culvert_cam.jpg"
        }
    ]

    for rec in recoveries:
        db.add(models.RecoveryRecord(**rec))
    db.commit()

    # 8. Seed Initial Risk Forecasts
    from app.ai.forecaster import forecaster
    for s in pilot_sites:
        pred = forecaster.predict_outlet_risk(
            rainfall_24h_mm=85.0 if "MTH" in s["id"] else 45.0,
            rainfall_forecast_24h_mm=110.0 if "MTH" in s["id"] else 60.0,
            tide_level_m=4.45,
            tide_phase="High Tide (Spring)",
            upstream_urban_density=s["upstream_urban_density"],
            barrier_status=s["barrier_status"],
            catchment_area_sqkm=s["catchment_area_sqkm"]
        )
        db.add(models.RiskForecast(
            site_id=s["id"],
            horizon_hours=24,
            risk_score=pred["risk_score"],
            risk_level=pred["risk_level"],
            predicted_plastic_volume_kg=pred["predicted_plastic_volume_kg"],
            choke_probability_pct=pred["choke_probability_pct"],
            factors_json=json.dumps(pred["factors"]),
            action_recommendation=pred["action_recommendation"],
            source_status="Simulated" if "TRM" in s["id"] else "Real"
        ))
    db.commit()

    print("Database seeding completed successfully!")

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
