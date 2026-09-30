import math
from typing import Dict, Any, Optional

class MumbaiLeakageForecaster:
    """
    Hydrological and plastic accumulation predictive forecasting engine
    tailored for Mumbai's tidal creeks and municipal storm nullahs.
    """

    DENSITY_WEIGHTS = {
        "Low": 0.8,
        "Moderate": 1.2,
        "High": 1.8,
        "Very High": 2.4
    }

    BARRIER_VULNERABILITY = {
        "Operational": 1.0,
        "Partially Blocked": 1.6,
        "Under Maintenance": 2.1,
        "Breached": 3.0
    }

    def predict_outlet_risk(
        self,
        rainfall_24h_mm: float,
        rainfall_forecast_24h_mm: float,
        tide_level_m: float,
        tide_phase: str,
        upstream_urban_density: str = "High",
        barrier_status: str = "Operational",
        catchment_area_sqkm: float = 5.0,
        current_water_depth_m: float = 1.2,
        recent_plastic_count: int = 15,
        horizon_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Calculates multidimensional risk score (0-100), predicted accumulation mass (kg),
        choke probability, and recommended municipal intervention.
        """
        # 1. Rainfall flush index (0 to 35 points)
        # Heavy Mumbai showers exceed 60mm/day; extreme monsoon events exceed 120mm/day
        combined_rain = rainfall_24h_mm * 0.4 + rainfall_forecast_24h_mm * 0.6
        # Sigmoid-shaped saturation for rainfall flush
        rain_component = 35.0 * (1.0 / (1.0 + math.exp(-0.045 * (combined_rain - 50.0))))
        rain_component = min(35.0, max(2.0, rain_component))

        # 2. Tidal backflow penalty (0 to 25 points)
        # High tide in Mumbai > 4.2m blocks gravity drainage and traps floating waste
        tide_threshold = 3.5 # meters
        if tide_level_m >= 4.2:
            tide_component = 25.0
        elif tide_level_m >= tide_threshold:
            tide_component = 12.0 + (tide_level_m - tide_threshold) / (4.2 - tide_threshold) * 13.0
        else:
            tide_component = max(1.0, (tide_level_m / tide_threshold) * 10.0)

        # 3. Catchment debris generation factor (0 to 20 points)
        density_multiplier = self.DENSITY_WEIGHTS.get(upstream_urban_density, 1.5)
        catchment_factor = min(2.0, math.sqrt(catchment_area_sqkm / 4.0))
        debris_component = min(20.0, 7.0 * density_multiplier * catchment_factor)

        # 4. Barrier condition & hydraulic capacity (0 to 20 points)
        vulnerability = self.BARRIER_VULNERABILITY.get(barrier_status, 1.0)
        water_depth_ratio = min(2.0, current_water_depth_m / 2.0)
        barrier_component = min(20.0, 4.0 * vulnerability * water_depth_ratio)

        # Total Risk Score (0 - 100)
        raw_score = rain_component + tide_component + debris_component + barrier_component
        risk_score = round(min(100.0, max(5.0, raw_score)), 1)

        # Categorize Risk Level
        if risk_score >= 80.0:
            risk_level = "Critical"
        elif risk_score >= 60.0:
            risk_level = "High"
        elif risk_score >= 35.0:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        # Predict accumulated plastic leakage volume (in kg) over horizon
        # Basal runoff + exponential flush during heavy rainfall events
        base_plastic_kg_per_sqkm_day = 14.5 * density_multiplier
        runoff_surge = 1.0 + (combined_rain / 25.0) ** 1.35
        tide_trap_multiplier = 1.3 if tide_level_m > 3.8 else 1.0
        horizon_multiplier = horizon_hours / 24.0

        predicted_kg = (
            base_plastic_kg_per_sqkm_day *
            catchment_area_sqkm *
            runoff_surge *
            tide_trap_multiplier *
            horizon_multiplier
        )
        predicted_kg = round(max(15.0, predicted_kg), 1)

        # Choke probability (%)
        # Higher if barrier is already blocked or water level is high during high tide
        choke_base = (risk_score / 100.0) ** 1.2 * 85.0
        if barrier_status in ["Partially Blocked", "Under Maintenance"]:
            choke_base += 15.0
        elif barrier_status == "Breached":
            choke_base += 25.0
        choke_prob = round(min(98.0, max(2.0, choke_base)), 1)

        # Operational recommendation
        if risk_level == "Critical":
            rec = "CRITICAL ALERT: High flood and plastic surge imminent. Immediately dispatch trash skimmers and raise hydraulic trash booms."
        elif risk_level == "High":
            rec = "PRIORITY DISPATCH: Sluice gate blockage risk. Schedule barrier clearing crew before next high-tide peak."
        elif risk_level == "Medium":
            rec = "WATCHLIST: Moderate plastic runoff expected. Monitor CCTV creek feeds and inspect boom anchors."
        else:
            rec = "ROUTINE MONITORING: Creek flow normal. Maintain scheduled weekly recovery operations."

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "predicted_plastic_volume_kg": predicted_kg,
            "choke_probability_pct": choke_prob,
            "action_recommendation": rec,
            "factors": {
                "rainfall_flush_score": round(rain_component, 1),
                "tidal_surge_score": round(tide_component, 1),
                "catchment_density_score": round(debris_component, 1),
                "barrier_vulnerability_score": round(barrier_component, 1),
            }
        }

# Global forecaster instance
forecaster = MumbaiLeakageForecaster()
