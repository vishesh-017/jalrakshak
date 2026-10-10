"""
Comprehensive Verification Test Suite for JalRakshak Drone Video Analysis & ReWater YOLOv8 Integration
Tests all 10 acceptance criteria specified in user request.
"""

import os
import sys
import json
import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db, SessionLocal
from app.models import UnifiedHotspot, IoTDevice
from app.services.drone_video_service import drone_video_service
from app.services.inference_service import inference_service

client = TestClient(app)

print("=" * 65)
print("     JALRAKSHAK REWATER DRONE VIDEO INTEGRATION TEST SUITE      ")
print("=" * 65)

# -------------------------------------------------------------
# TEST 1: ReWater Pretrained Model Weights Verification
# -------------------------------------------------------------
print("\n[TEST 1] Verifying ReWater YOLO_Custom_v8m Model Weights...")
weights_path = os.path.join(os.path.dirname(__file__), "app", "ai", "weights", "YOLO_Custom_v8m.pt")
assert os.path.exists(weights_path), f"ReWater weights not found at {weights_path}"
model, model_name = inference_service.get_model("rewater")
assert model is not None, "Failed to load ReWater model"
print(f" -> Passed! Active Model: {model_name}, Weights Size: {os.path.getsize(weights_path) / (1024*1024):.1f} MB")

# -------------------------------------------------------------
# TEST 2: Real Drone Video Frame Extraction & ReWater Inference
# -------------------------------------------------------------
print("\n[TEST 2] Testing Drone Video Analysis with Real ReWater Model...")
sample_video = os.path.join(os.path.dirname(__file__), "uploads", "sample_drone_mumbai_nullah.mp4")
assert os.path.exists(sample_video), f"Sample video not found at {sample_video}"

res = drone_video_service.process_drone_video(
    job_id="test_suite_vjob_01",
    video_path=sample_video,
    sample_interval_sec=1.0,
    confidence_threshold=0.30,
    model_variant="rewater",
    start_latitude=19.0654,
    start_longitude=72.8712,
    end_latitude=19.0720,
    end_longitude=72.8750,
    flight_id="MITHI-AERIAL-TEST"
)

assert res["status"] == "COMPLETED", f"Video processing failed: {res.get('error')}"
assert res["summary"]["total_frames_sampled"] > 0, "No frames were sampled"
assert res["summary"]["total_plastic_detections"] > 0, "No plastic was detected"
print(f" -> Passed! Sampled Frames: {res['summary']['total_frames_sampled']}, Detections: {res['summary']['total_plastic_detections']}")
print(f"    Keyframe Boxes: {len(res['accumulations'][0]['keyframe']['boxes'])} detected bounding boxes")

# -------------------------------------------------------------
# TEST 3: Preservation of Video Timestamps Across Frames
# -------------------------------------------------------------
print("\n[TEST 3] Verifying Video Timestamps Preservation...")
frames = res["sampled_frames"]
timestamps = [f["timestamp_formatted"] for f in frames]
assert len(timestamps) >= 3, "Insufficient frame timestamps"
assert timestamps[0] == "00:00.0", f"Unexpected initial timestamp: {timestamps[0]}"
print(f" -> Passed! Timestamps preserved: {timestamps}")

# -------------------------------------------------------------
# TEST 4: Cross-Frame Accumulation Grouping & Deduplication
# -------------------------------------------------------------
print("\n[TEST 4] Verifying Cross-Frame Accumulation Grouping...")
accumulations = res["accumulations"]
assert len(accumulations) == 1, f"Expected 1 grouped accumulation cluster, got {len(accumulations)}"
acc = accumulations[0]
print(f" -> Passed! {res['summary']['total_plastic_detections']} detections across {acc['frame_count']} frames")
print(f"    grouped into single cluster: {acc['cluster_id']} ({acc['time_span']}), Peak Items: {acc['peak_items']}")

# -------------------------------------------------------------
# TEST 5: Geolocation Waypoint Interpolation
# -------------------------------------------------------------
print("\n[TEST 5] Verifying Waypoint Telemetry Synchronization...")
kf = acc["keyframe"]
assert kf["latitude"] is not None and kf["longitude"] is not None, "Missing interpolated coordinates"
assert kf["location_method"] == "GEOREFERENCED_WAYPOINT_INTERPOLATION", f"Wrong method: {kf['location_method']}"
print(f" -> Passed! Interpolated Coords: ({kf['latitude']}, {kf['longitude']}) via {kf['location_method']}")

# -------------------------------------------------------------
# TEST 6: Unlocated Video (Never Invent Coordinates)
# -------------------------------------------------------------
print("\n[TEST 6] Testing Video Footage Without GPS (Never Fabricate Coordinates)...")
unlocated_res = drone_video_service.process_drone_video(
    job_id="test_suite_unlocated_02",
    video_path=sample_video,
    sample_interval_sec=2.0,
    confidence_threshold=0.30,
    model_variant="rewater",
    start_latitude=None,
    start_longitude=None,
    flight_id="UNLOCATED-SURVEY"
)
assert unlocated_res["status"] == "COMPLETED"
unloc_acc = unlocated_res["accumulations"][0]["keyframe"]
assert unloc_acc["latitude"] is None and unloc_acc["longitude"] is None, "Fabricated coordinates when none provided!"
assert unloc_acc["location_method"] == "UNLOCATED", f"Wrong method: {unloc_acc['location_method']}"
print(f" -> Passed! Correctly flagged as {unloc_acc['location_method']} with null coordinates")

# -------------------------------------------------------------
# TEST 7: Mumbai-Only Boundary Rejection (Out-of-Area Video)
# -------------------------------------------------------------
print("\n[TEST 7] Testing Out-of-Mumbai Drone Footage Rejection (Pune Coordinates)...")
pune_res = drone_video_service.process_drone_video(
    job_id="test_suite_pune_03",
    video_path=sample_video,
    sample_interval_sec=2.0,
    confidence_threshold=0.30,
    model_variant="rewater",
    start_latitude=18.5204, # Pune Mutha River
    start_longitude=73.8567,
    end_latitude=18.5250,
    end_longitude=73.8600,
    flight_id="PUNE-OUT-OF-BOUNDS"
)
assert pune_res["status"] == "COMPLETED"
created = pune_res["created_hotspots"][0]
assert created["boundary_status"] == "OUTSIDE_BOUNDARY", f"Failed to reject Pune video: {created['boundary_status']}"
print(f" -> Passed! Out-of-Mumbai video cluster rejected from active map. Status: {created['boundary_status']}")

# -------------------------------------------------------------
# TEST 8: Worker Photograph Upload Reusing Shared ReWater Model
# -------------------------------------------------------------
print("\n[TEST 8] Testing Worker Photograph Upload Reusing ReWater Model...")
sample_img = os.path.join(os.path.dirname(__file__), "sample_feeds", "mithi_high_plastic_01.jpg")
with open(sample_img, "rb") as f:
    resp = client.post(
        "/api/worker/upload-report",
        data={
            "reporter_id": "WORKER-BMC-99",
            "reporter_name": "Senior River Marshal",
            "report_category": "Culvert Choke",
            "latitude": 19.0680,
            "longitude": 72.8730,
            "location_description": "Mithi River Pipe Bridge",
            "model_variant": "rewater",
            "confidence_threshold": 0.30
        },
        files={"photo": ("worker_debris.jpg", f, "image/jpeg")}
    )
assert resp.status_code == 200, f"Worker report upload failed: {resp.text}"
worker_data = resp.json()
assert "ReWater" in worker_data["ai_results"]["model_version"], f"Did not use ReWater model: {worker_data['ai_results']['model_version']}"
print(f" -> Passed! Report ID: {worker_data['report_id']}, Model: {worker_data['ai_results']['model_version']}, Risk: {worker_data['hotspot']['risk_category']}")

# -------------------------------------------------------------
# TEST 9: Corrupt / Invalid Video Graceful Error Handling
# -------------------------------------------------------------
print("\n[TEST 9] Testing Corrupt Video Handling...")
corrupt_path = os.path.join(os.path.dirname(__file__), "uploads", "corrupt_fake.mp4")
with open(corrupt_path, "wb") as f:
    f.write(b"NOT_A_REAL_VIDEO_HEADER_CONTENT_RANDOM_BYTES")

corrupt_res = drone_video_service.process_drone_video(
    job_id="test_suite_corrupt_04",
    video_path=corrupt_path
)
assert corrupt_res["status"] == "FAILED", "Failed to catch corrupt video"
print(f" -> Passed! Graceful failure without server crash: Error='{corrupt_res['error']}'")
if os.path.exists(corrupt_path):
    os.remove(corrupt_path)

# -------------------------------------------------------------
# TEST 10: Ingested Detections Reach Unified JalRakshak Dashboard
# -------------------------------------------------------------
print("\n[TEST 10] Verifying Ingested Video Detections in Centralized Dashboard...")
summary_resp = client.get("/api/hotspots/summary")
assert summary_resp.status_code == 200
summary = summary_resp.json()
assert summary["total_valid_hotspots"] > 0, "No hotspots found in dashboard summary"
assert "drone" in summary["source_breakdown"], "Drone source not listed in dashboard summary"
print(f" -> Passed! Active Mumbai Hotspots: {summary['total_valid_hotspots']}, Sources: {summary['source_breakdown']}")

print("\n" + "=" * 65)
print("   ALL 10 REWATER VIDEO PIPELINE TESTS PASSED WITH 100% SUCCESS!  ")
print("=" * 65)
