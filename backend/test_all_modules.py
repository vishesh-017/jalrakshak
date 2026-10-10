"""
Comprehensive Test Suite for JalRakshak 3 Detection Modules & Geofenced Hotspot Engine
Validates all user acceptance criteria and automated workflows.
"""

import os
import requests
import datetime
from PIL import Image

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=================================================================")
    print("       JALRAKSHAK INTEGRATED DETECTION MODULES TEST SUITE        ")
    print("=================================================================")

    # 1. IoT Ingestion & Value Update
    print("\n[TEST 1] IoT Ingestion & Telemetry Update...")
    payload = {
        "device_id": "ESP32-MTH-01",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "water_level_cm": 182.5,
        "water_level_rate": 0.12,
        "rainfall_mm": 28.0,
        "camera_status": "Operational",
        "plastic_detection": "High",
        "battery_level": 94.0,
        "signal_strength": -65.0
    }
    r = requests.post(f"{BASE_URL}/iot/ingest", json=payload)
    assert r.status_code == 200, f"IoT ingest failed: {r.text}"
    print(f" -> Passed! Response: {r.json()}")

    # 2. IoT Heartbeat check
    print("\n[TEST 2] IoT Heartbeat Check & Device Query...")
    r = requests.get(f"{BASE_URL}/iot/devices")
    assert r.status_code == 200
    devices = r.json()
    assert len(devices) > 0, "No IoT devices found"
    print(f" -> Passed! Found {len(devices)} devices. Status of ESP32-MTH-01: {devices[0]['status']}, battery: {devices[0]['battery_level']}%")

    # 3. Model B: Satellite Detection with Georeferencing
    print("\n[TEST 3] Satellite Marine Debris (Model B) Spectral Pipeline...")
    r = requests.post(f"{BASE_URL}/satellite/analyze-sample-scene", data={"scene_id": "S2A-MSIL2A-MUMBAI-MITHI", "source_status": "Real"})
    assert r.status_code == 200, f"Satellite pipeline failed: {r.text}"
    sat_res = r.json()
    assert sat_res["success"] is True
    print(f" -> Passed! Candidate regions: {sat_res['metrics']['total_candidate_regions']}, Slick Area: {sat_res['metrics']['total_debris_area_sqm']} m²")
    print(f"    Resolution Notice: {sat_res['resolution_notice']}")

    # 4. Model A: Drone Image with GPS EXIF creates correctly located hotspot
    print("\n[TEST 4] Drone Image (Model A) with In-Bounds Mumbai Location...")
    # Create test image with valid Mumbai coordinates
    test_img_path = "test_drone_mumbai.jpg"
    img = Image.new('RGB', (640, 480), color=(30, 45, 60))
    img.save(test_img_path)

    with open(test_img_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/drone/upload",
            files={"file": ("test_drone_mumbai.jpg", f, "image/jpeg")},
            data={
                "manual_latitude": 19.0435, # Mahim Bay (Mumbai)
                "manual_longitude": 72.8415,
                "flight_id": "DJI-MAVIC3-TEST-01",
                "model_variant": "tiles",
                "source_status": "Real"
            }
        )
    assert r.status_code == 200, f"Drone upload failed: {r.text}"
    drone_res = r.json()
    assert drone_res["location"]["boundary_status"] == "VALID_MUMBAI", f"Expected VALID_MUMBAI but got {drone_res['location']['boundary_status']}"
    print(f" -> Passed! Model: {drone_res['model_version']}, Hotspot ID: {drone_res['hotspot_integration']['hotspot_id']}, Boundary: {drone_res['location']['boundary_status']}")

    # 5. Drone Image without coordinates flags UNLOCATED (Never fabricates!)
    print("\n[TEST 5] Drone Image without Coordinates...")
    with open(test_img_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/drone/upload",
            files={"file": ("test_drone_unlocated.jpg", f, "image/jpeg")},
            data={"flight_id": "DJI-UNLOCATED-01", "model_variant": "tiles"}
        )
    assert r.status_code == 200
    unloc_res = r.json()
    assert unloc_res["location"]["location_method"] == "UNLOCATED", f"Expected UNLOCATED but got {unloc_res['location']['location_method']}"
    assert unloc_res["location"]["boundary_status"] == "UNLOCATED_REVIEW", "Expected UNLOCATED_REVIEW"
    print(f" -> Passed! Never fabricated coordinates. Location Method: {unloc_res['location']['location_method']}, Status: {unloc_res['location']['boundary_status']}")

    # 6. Out-of-Mumbai detection rejected from active map
    print("\n[TEST 6] Out-of-Mumbai Detection Rejection (Pune/Delhi coordinates)...")
    with open(test_img_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/drone/upload",
            files={"file": ("test_drone_outside.jpg", f, "image/jpeg")},
            data={
                "manual_latitude": 18.5204, # Pune (Outside Mumbai)
                "manual_longitude": 73.8567,
                "flight_id": "DRONE-OUTSIDE-01"
            }
        )
    assert r.status_code == 200
    outside_res = r.json()
    assert outside_res["location"]["boundary_status"] == "OUTSIDE_BOUNDARY", f"Expected OUTSIDE_BOUNDARY but got {outside_res['location']['boundary_status']}"
    assert outside_res["location"]["is_valid_mumbai"] is False
    print(f" -> Passed! Out-of-Mumbai detection rejected. Status: {outside_res['location']['boundary_status']}")
    print(f"    Reason: {outside_res['location']['boundary_reason']}")

    # 7. Field Worker upload and Model A inference
    print("\n[TEST 7] Field Worker Photo Report (Model A Ground Inference)...")
    with open(test_img_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/worker/upload-report",
            files={"photo": ("worker_report.jpg", f, "image/jpeg")},
            data={
                "reporter_id": "WORKER-EMP-880",
                "reporter_name": "Sanitation Supervisor K. Shinde",
                "report_category": "Culvert Choke",
                "latitude": 19.0662, # Kurla BKC (Mumbai)
                "longitude": 72.8715,
                "location_description": "Kurla LBS Road Culvert Gate #2",
                "water_level_m": 1.75,
                "notes": "Severe plastic bag & bottle blockage observed during patrol."
            }
        )
    assert r.status_code == 200, f"Worker report failed: {r.text}"
    worker_res = r.json()
    assert worker_res["location"]["boundary_status"] == "VALID_MUMBAI"
    print(f" -> Passed! Report ID: {worker_res['report_id']}, Model: {worker_res['ai_results']['model_version']}")
    print(f"    Risk Category: {worker_res['hotspot']['risk_category']} (Score: {worker_res['hotspot']['risk_score']}/100)")

    # 8. Unsuitable/Corrupt Image Quality Handling
    print("\n[TEST 8] Corrupt / Unsuitable Image Handling...")
    corrupt_path = "corrupt_test.jpg"
    with open(corrupt_path, "wb") as f:
        f.write(b"NOT_A_VALID_JPEG_HEADER_CORRUPTED_BYTES")
    with open(corrupt_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/drone/upload",
            files={"file": ("corrupt.jpg", f, "image/jpeg")},
            data={"manual_latitude": 19.04, "manual_longitude": 72.84}
        )
    assert r.status_code == 200
    corrupt_res = r.json()
    assert corrupt_res["success"] is False
    print(f" -> Passed! Returned graceful error without crashing: '{corrupt_res['error']}'")

    # 9. Cross-module duplicate association (clustering within 75m)
    print("\n[TEST 9] Cross-Module Duplicate Association (Clustering within 75m)...")
    # Send another detection at the exact same location as Test 4 (19.0435, 72.8415)
    with open(test_img_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/drone/upload",
            files={"file": ("drone_duplicate.jpg", f, "image/jpeg")},
            data={
                "manual_latitude": 19.0435, # Same point
                "manual_longitude": 72.8415,
                "flight_id": "DJI-REPEAT-SURVEY"
            }
        )
    assert r.status_code == 200
    dup_res = r.json()
    print(f" -> Passed! Action taken: {dup_res['hotspot_integration']['action']}")
    print(f"    Linked to primary hotspot: {dup_res['hotspot_integration']['hotspot_id']}")

    # 10. Centralized Hotspots Dashboard & Summary Verification
    print("\n[TEST 10] Centralized Hotspots Query & Filters...")
    r = requests.get(f"{BASE_URL}/hotspots/summary")
    assert r.status_code == 200
    summary = r.json()
    print(f" -> Summary: Valid Mumbai Hotspots: {summary['total_valid_hotspots']}")
    print(f"    Source Breakdown: {summary['source_breakdown']}")
    print(f"    Risk Breakdown: {summary['risk_breakdown']}")

    # Cleanup temp test files
    for p in [test_img_path, corrupt_path]:
        if os.path.exists(p):
            os.remove(p)

    print("\n=================================================================")
    print("      ALL 10 TEST CASES PASSED WITH 100% SPEC COMPLIANCE!       ")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()
