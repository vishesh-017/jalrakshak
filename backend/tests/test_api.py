import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.seed_data import seed_database

@pytest.fixture(scope="session", autouse=True)
def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()

def test_health_check():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

def test_get_sites():
    with TestClient(app) as client:
        response = client.get("/api/sites")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 10
        # Check that Mithi River and Malad Creek sites exist
        site_names = [s["name"] for s in data]
        assert any("Mahim" in name for name in site_names)
        assert any("Malad" in name for name in site_names)
        assert any("Trombay" in name for name in site_names)

def test_overview_metrics():
    with TestClient(app) as client:
        response = client.get("/api/analytics/overview")
        assert response.status_code == 200
        data = response.json()
        assert "total_monitored_sites" in data
        assert data["total_monitored_sites"] >= 10
        assert "source_breakdown" in data
        assert "Real" in data["source_breakdown"]

def test_forecaster_engine():
    from app.ai.forecaster import forecaster
    result = forecaster.predict_outlet_risk(
        rainfall_24h_mm=120.0,
        rainfall_forecast_24h_mm=130.0,
        tide_level_m=4.5,
        tide_phase="High Tide (Spring)",
        upstream_urban_density="Very High",
        barrier_status="Partially Blocked",
        catchment_area_sqkm=12.0
    )
    assert result["risk_score"] >= 70.0
    assert result["risk_level"] in ["High", "Critical"]
    assert result["predicted_plastic_volume_kg"] > 50.0

def test_cleanup_tasks():
    with TestClient(app) as client:
        response = client.get("/api/cleanup")
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
        assert len(tasks) >= 1

def test_recovery_records():
    with TestClient(app) as client:
        response = client.get("/api/recovery")
        assert response.status_code == 200
        records = response.json()
        assert isinstance(records, list)
        assert len(records) >= 1
        statuses = [r["verification_status"] for r in records]
        assert "Verified" in statuses

def test_detection_samples_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/detections/samples")
        assert response.status_code == 200
        samples = response.json()
        assert len(samples) >= 4

def test_cleanup_recommendations():
    with TestClient(app) as client:
        response = client.get("/api/cleanup/recommendations?min_risk_score=30.0")
        assert response.status_code == 200
        recs = response.json()
        assert isinstance(recs, list)
        if len(recs) > 0:
            assert "recommendation_reason" in recs[0]
            assert "suggested_crew" in recs[0]

def test_route_optimization():
    with TestClient(app) as client:
        payload = {
            "site_ids": ["MTH-01", "MTH-02", "MLD-01"],
            "depot_lat": 19.0178,
            "depot_lon": 72.8478,
            "num_crews": 1,
            "max_shift_hours": 8.0
        }
        response = client.post("/api/cleanup/optimize-route", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "stops" in data
        assert "polyline" in data
        assert data["total_distance_km"] > 0.0
        assert "optimization_engine" in data

def test_recovery_audit_summary_and_csv():
    with TestClient(app) as client:
        # Check summary
        summary_res = client.get("/api/recovery/summary")
        assert summary_res.status_code == 200
        summary_data = summary_res.json()
        assert "audit_chain_integrity" in summary_data
        assert "potential_epr_eligible_kg" in summary_data

        # Check CSV export
        csv_res = client.get("/api/recovery/export.csv")
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers["content-type"]
        assert "Manifest_Number" in csv_res.text

def test_model_card_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/forecasts/model-card")
        assert response.status_code == 200
        card = response.json()
        assert "model_comparisons" in card
        assert "rainfall_only_baseline" in card["model_comparisons"]
        assert "model_b_xgboost" in card["model_comparisons"]
        assert "data_provenance" in card

def test_csv_import_and_validation():
    with TestClient(app) as client:
        # Valid and invalid rows in CSV
        csv_content = (
            "site_id,rainfall_24h_mm,timestamp\n"
            "MTH-01,65.5,2026-06-15T10:00:00\n"
            "NONEXISTENT_SITE,40.0,2026-06-15T10:00:00\n"
            "MLD-01,-15.0,2026-06-15T10:00:00\n"
            "TRM-01,88.2,2026-06-15T11:00:00\n"
        )
        files = {"file": ("test_import.csv", csv_content, "text/csv")}
        data = {"import_type": "rainfall"}
        res = client.post("/api/observations/import-csv", files=files, data=data)
        assert res.status_code == 200
        summary = res.json()
        assert summary["total_rows"] == 4
        assert summary["imported_rows"] == 2 # Only MTH-01 and TRM-01 are valid
        assert summary["rejected_rows"] == 2
        assert len(summary["warnings"]) > 0

def test_data_coverage_endpoint():
    with TestClient(app) as client:
        res = client.get("/api/observations/coverage")
        assert res.status_code == 200
        coverage = res.json()
        assert isinstance(coverage, list)
        assert len(coverage) >= 8
        site_keys = [c["site_id"] for c in coverage]
        assert "MTH-01" in site_keys
        assert "coverage_status" in coverage[0]

def test_storm_simulation_updates_forecast():
    with TestClient(app) as client:
        res = client.post("/api/simulation/trigger-storm", json={"intensity": "Severe Cloudburst (110mm)", "tide_surge_m": 4.5})
        assert res.status_code == 200
        updated = res.json()
        assert updated["simulated_rainfall_mm"] == 110.0
        assert len(updated["impacted_sites"]) >= 8


