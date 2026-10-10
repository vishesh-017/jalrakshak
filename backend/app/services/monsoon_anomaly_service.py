"""
JalRakshak Monsoon Blockage Detection Service
==============================================
Transparent, configurable rule-based anomaly detection for drain-flow behaviour
during rainfall events. Does NOT pretend to use a trained ML model.

Key principles:
- High water level alone is NOT proof of a blockage.
- Heavy rainfall can naturally cause high water levels.
- Flow anomalies are suspicious, not conclusive.
- Missing data is explicitly flagged -- never fabricated.
- All conclusions are labelled as suspected anomalies until verified.
"""

import datetime
from typing import Optional, Dict, Any, List

# ---------------------------------------------------------------------------
# Configurable thresholds (operators can adjust these per station)
# ---------------------------------------------------------------------------

DEFAULT_THRESHOLDS: Dict[str, Any] = {
    # Water-level rise rate (m/h) considered unusually fast vs baseline
    "rapid_rise_rate_m_per_h": 0.15,
    # Water depth (m) above which culvert is considered elevated
    "elevated_depth_m": 1.2,
    # Water depth (m) approaching critical capacity
    "critical_depth_m": 1.8,
    # Flow velocity (m/s) considered abnormally low during rainfall
    "low_flow_velocity_mps": 0.10,
    # Rainfall (mm/h) below which high water cannot be blamed on rain
    "min_rain_to_explain_high_water_mm": 5.0,
    # Rainfall (mm/h) above which high water is EXPECTED (normal response)
    "heavy_rain_threshold_mm": 25.0,
    # Minutes since last reading before device is considered stale
    "stale_sensor_minutes": 15,
    # Previous anomalies that elevate station priority
    "repeat_anomaly_count_threshold": 2,
}


# ---------------------------------------------------------------------------
# Incident status lifecycle
# ---------------------------------------------------------------------------

class BlockageStatus:
    NORMAL = "Normal"
    SUSPICIOUS_ANOMALY = "Suspicious Drainage Anomaly"
    POSSIBLE_BLOCKAGE = "Possible Blockage — Inspection Required"
    CONFIRMED_BLOCKAGE = "Confirmed Blockage"
    CONFIRMED_OTHER = "Confirmed — Other Drainage Issue"
    FALSE_ALARM = "False Alarm"
    RESOLVED = "Resolved"


# ---------------------------------------------------------------------------
# Demo scenario definitions
# ---------------------------------------------------------------------------

DEMO_SCENARIOS: Dict[str, Any] = {
    "normal_drainage": {
        "name": "Normal Drainage",
        "description": "Normal flow conditions with no significant rainfall. All readings within baseline.",
        "steps": [
            {"t": 0,  "rainfall_mm": 0.0,  "water_depth_m": 0.45, "flow_velocity_mps": 0.35, "label": "Baseline — normal dry-weather flow"},
            {"t": 5,  "rainfall_mm": 0.0,  "water_depth_m": 0.46, "flow_velocity_mps": 0.34, "label": "Stable conditions"},
            {"t": 10, "rainfall_mm": 0.5,  "water_depth_m": 0.48, "flow_velocity_mps": 0.35, "label": "Light drizzle — no change"},
            {"t": 15, "rainfall_mm": 0.8,  "water_depth_m": 0.50, "flow_velocity_mps": 0.36, "label": "Slight rise — expected"},
            {"t": 20, "rainfall_mm": 0.3,  "water_depth_m": 0.49, "flow_velocity_mps": 0.35, "label": "Returning to baseline"},
            {"t": 25, "rainfall_mm": 0.0,  "water_depth_m": 0.47, "flow_velocity_mps": 0.34, "label": "Fully normal — no alert triggered"},
        ]
    },
    "heavy_rain_normal_drainage": {
        "name": "Heavy Rainfall — Normal Drainage",
        "description": "Intense rainfall causes high water levels. Flow is proportional — no blockage.",
        "steps": [
            {"t": 0,  "rainfall_mm": 0.0,  "water_depth_m": 0.50, "flow_velocity_mps": 0.35, "label": "Pre-rain baseline"},
            {"t": 5,  "rainfall_mm": 15.0, "water_depth_m": 0.70, "flow_velocity_mps": 0.55, "label": "Moderate rain begins — water rising, flow rising proportionally"},
            {"t": 10, "rainfall_mm": 32.0, "water_depth_m": 1.10, "flow_velocity_mps": 0.85, "label": "Heavy rainfall — high water but flow proportional"},
            {"t": 15, "rainfall_mm": 45.0, "water_depth_m": 1.45, "flow_velocity_mps": 1.10, "label": "Very heavy rain — elevated but drainage functioning"},
            {"t": 20, "rainfall_mm": 38.0, "water_depth_m": 1.30, "flow_velocity_mps": 0.98, "label": "Rain easing — levels dropping"},
            {"t": 25, "rainfall_mm": 10.0, "water_depth_m": 0.80, "flow_velocity_mps": 0.62, "label": "Recovery — water receding"},
            {"t": 30, "rainfall_mm": 2.0,  "water_depth_m": 0.55, "flow_velocity_mps": 0.40, "label": "Near-normal — no blockage confirmed"},
        ]
    },
    "suspected_blockage": {
        "name": "Suspected Blockage — Rising Water, Abnormal Flow",
        "description": "Water level rising rapidly while flow is abnormally low relative to rainfall. Suspicious pattern.",
        "steps": [
            {"t": 0,  "rainfall_mm": 8.0,  "water_depth_m": 0.55, "flow_velocity_mps": 0.42, "label": "Light rain — normal readings"},
            {"t": 5,  "rainfall_mm": 20.0, "water_depth_m": 0.85, "flow_velocity_mps": 0.30, "label": "Rainfall increases but flow not rising proportionally"},
            {"t": 10, "rainfall_mm": 22.0, "water_depth_m": 1.25, "flow_velocity_mps": 0.12, "label": "ANOMALY: Water rising fast, flow very low"},
            {"t": 15, "rainfall_mm": 20.0, "water_depth_m": 1.55, "flow_velocity_mps": 0.08, "label": "ALERT: Water continues rising, near-zero flow — blockage suspected"},
            {"t": 20, "rainfall_mm": 18.0, "water_depth_m": 1.75, "flow_velocity_mps": 0.06, "label": "CRITICAL: Inspection recommended immediately"},
            {"t": 25, "rainfall_mm": 10.0, "water_depth_m": 1.80, "flow_velocity_mps": 0.05, "label": "Rain easing but water NOT dropping — confirms blockage pattern"},
            {"t": 30, "rainfall_mm": 5.0,  "water_depth_m": 1.82, "flow_velocity_mps": 0.04, "label": "Stagnant high water — manual inspection required"},
        ]
    },
    "high_water_insufficient_evidence": {
        "name": "High Water — Insufficient Evidence",
        "description": "High water level during very heavy rain. Cannot confirm blockage — rainfall likely explains levels.",
        "steps": [
            {"t": 0,  "rainfall_mm": 50.0, "water_depth_m": 1.60, "flow_velocity_mps": 1.20, "label": "Extreme rainfall — high water expected"},
            {"t": 5,  "rainfall_mm": 65.0, "water_depth_m": 1.75, "flow_velocity_mps": 1.35, "label": "Very heavy rain — high but flow is strong"},
            {"t": 10, "rainfall_mm": 70.0, "water_depth_m": 1.85, "flow_velocity_mps": 1.40, "label": "Peak rainfall — levels high but drain is flowing"},
            {"t": 15, "rainfall_mm": 55.0, "water_depth_m": 1.70, "flow_velocity_mps": 1.25, "label": "Rain reducing — water dropping proportionally"},
            {"t": 20, "rainfall_mm": 30.0, "water_depth_m": 1.40, "flow_velocity_mps": 1.00, "label": "Recovering — drainage functioning normally"},
        ]
    },
    "sensor_disconnection": {
        "name": "Sensor Disconnection",
        "description": "Sensor goes offline mid-event. Data gaps handled gracefully — no invented values.",
        "steps": [
            {"t": 0,  "rainfall_mm": 12.0, "water_depth_m": 0.80, "flow_velocity_mps": 0.60, "label": "Normal — sensor online"},
            {"t": 5,  "rainfall_mm": 18.0, "water_depth_m": 1.00, "flow_velocity_mps": None,  "label": "Flow sensor disconnected — flow data unavailable"},
            {"t": 10, "rainfall_mm": None,  "water_depth_m": None,  "flow_velocity_mps": None,  "label": "Full sensor offline — all readings unavailable"},
            {"t": 15, "rainfall_mm": None,  "water_depth_m": None,  "flow_velocity_mps": None,  "label": "Device still offline — stale reading detected"},
            {"t": 20, "rainfall_mm": 8.0,  "water_depth_m": 0.90, "flow_velocity_mps": 0.65, "label": "Sensor reconnected — readings resumed"},
            {"t": 25, "rainfall_mm": 3.0,  "water_depth_m": 0.60, "flow_velocity_mps": 0.45, "label": "Back to normal"},
        ]
    },
    "recovery_after_anomaly": {
        "name": "Recovery After Anomaly",
        "description": "A blockage was cleared. Shows water level drop and flow restoration after maintenance.",
        "steps": [
            {"t": 0,  "rainfall_mm": 5.0,  "water_depth_m": 1.80, "flow_velocity_mps": 0.04, "label": "Post-anomaly — blockage confirmed, crew dispatched"},
            {"t": 5,  "rainfall_mm": 4.0,  "water_depth_m": 1.75, "flow_velocity_mps": 0.05, "label": "Crew on-site — inspection in progress"},
            {"t": 10, "rainfall_mm": 3.0,  "water_depth_m": 1.50, "flow_velocity_mps": 0.30, "label": "Debris partially cleared — flow improving"},
            {"t": 15, "rainfall_mm": 2.0,  "water_depth_m": 1.10, "flow_velocity_mps": 0.65, "label": "Main blockage cleared — rapid drainage"},
            {"t": 20, "rainfall_mm": 1.0,  "water_depth_m": 0.70, "flow_velocity_mps": 0.52, "label": "Water dropping — cleanup completed"},
            {"t": 25, "rainfall_mm": 0.0,  "water_depth_m": 0.48, "flow_velocity_mps": 0.36, "label": "RESOLVED — back to normal baseline"},
        ]
    },
}


# ---------------------------------------------------------------------------
# Core anomaly detection function
# ---------------------------------------------------------------------------

def analyse_drain_anomaly(
    water_depth_m: Optional[float],
    flow_velocity_mps: Optional[float],
    rainfall_mm: Optional[float],
    previous_water_depth_m: Optional[float] = None,
    elapsed_minutes: float = 5.0,
    repeat_anomaly_count: int = 0,
    nearby_plastic_kg: float = 0.0,
    thresholds: Optional[Dict[str, Any]] = None,
    station_id: str = "UNKNOWN",
) -> Dict[str, Any]:
    """
    Analyses a single set of sensor readings and returns a structured anomaly report.
    All conclusions are clearly labelled as suspected until field verification.
    """
    t = thresholds or DEFAULT_THRESHOLDS
    triggered: List[str] = []
    factors: List[Dict[str, Any]] = []
    missing: List[str] = []

    if water_depth_m is None:
        missing.append("water_level")
    if flow_velocity_mps is None:
        missing.append("flow_velocity")
    if rainfall_mm is None:
        missing.append("rainfall")

    # All sensors offline
    if water_depth_m is None and flow_velocity_mps is None:
        return {
            "status": BlockageStatus.SUSPICIOUS_ANOMALY,
            "risk_score": 0.0,
            "risk_category": "Unknown",
            "triggered_rules": ["sensor_offline"],
            "evidence_factors": [{
                "factor": "Sensor Offline",
                "contribution": "UNAVAILABLE",
                "detail": "All sensor readings missing — cannot assess drain state.",
                "baseline": "N/A",
                "measured": "N/A"
            }],
            "missing_data": missing,
            "rainfall_context": "Rainfall data unavailable",
            "recommended_action": "Dispatch technician to inspect and restore sensor connectivity.",
            "confidence_note": "No assessment possible — all sensors offline.",
            "timestamp": datetime.datetime.utcnow().isoformat(),
        }

    # Rainfall context classification
    if rainfall_mm is None:
        rainfall_context = "Rainfall data unavailable — cannot confirm whether high water is rain-driven."
        rain_explains_high_water = False
        rain_category = "unknown"
    elif rainfall_mm >= t["heavy_rain_threshold_mm"]:
        rainfall_context = f"Heavy rainfall ({rainfall_mm:.1f} mm/h). High water levels are EXPECTED under these conditions."
        rain_explains_high_water = True
        rain_category = "heavy"
    elif rainfall_mm >= t["min_rain_to_explain_high_water_mm"]:
        rainfall_context = f"Moderate rainfall ({rainfall_mm:.1f} mm/h). Some water-level rise is expected."
        rain_explains_high_water = False
        rain_category = "moderate"
    elif rainfall_mm > 0:
        rainfall_context = f"Light rainfall ({rainfall_mm:.1f} mm/h). High water levels NOT expected from rainfall alone."
        rain_explains_high_water = False
        rain_category = "light"
    else:
        rainfall_context = "No active rainfall. High water levels are NOT explained by rainfall."
        rain_explains_high_water = False
        rain_category = "none"

    score = 0.0

    # Rule 1: Rapid water-level rise rate
    rise_rate_pts = 0.0
    if water_depth_m is not None and previous_water_depth_m is not None and elapsed_minutes > 0:
        rise_per_hour = (water_depth_m - previous_water_depth_m) / (elapsed_minutes / 60.0)
        if rise_per_hour > t["rapid_rise_rate_m_per_h"] and not rain_explains_high_water:
            rise_rate_pts = min(25.0, rise_per_hour * 80)
            triggered.append("rapid_water_rise")
            factors.append({
                "factor": "Rapid Water Level Rise",
                "contribution": f"+{rise_rate_pts:.0f} pts",
                "detail": f"Water rising at {rise_per_hour:.2f} m/h (threshold: {t['rapid_rise_rate_m_per_h']} m/h), not explained by current rainfall.",
                "baseline": f"{t['rapid_rise_rate_m_per_h']} m/h",
                "measured": f"{rise_per_hour:.3f} m/h"
            })
        elif rise_per_hour > t["rapid_rise_rate_m_per_h"]:
            factors.append({
                "factor": "Water Level Rising Fast",
                "contribution": "+0 pts (rain-driven)",
                "detail": f"Fast rise ({rise_per_hour:.2f} m/h) but heavy rainfall ({rainfall_mm:.1f} mm/h) explains this.",
                "baseline": f"{t['rapid_rise_rate_m_per_h']} m/h",
                "measured": f"{rise_per_hour:.3f} m/h"
            })
        score += rise_rate_pts

    # Rule 2: Elevated water depth
    depth_pts = 0.0
    if water_depth_m is not None:
        if water_depth_m >= t["critical_depth_m"]:
            if not rain_explains_high_water:
                depth_pts = 30.0
                triggered.append("critical_water_depth_no_rain")
                factors.append({
                    "factor": "Critical Water Depth Without Heavy Rain",
                    "contribution": f"+{depth_pts:.0f} pts",
                    "detail": f"Culvert at {water_depth_m:.2f}m (critical threshold: {t['critical_depth_m']}m). Rainfall ({rainfall_mm or 0:.1f} mm/h) does not explain this level.",
                    "baseline": f"{t['critical_depth_m']}m",
                    "measured": f"{water_depth_m:.2f}m"
                })
            else:
                depth_pts = 10.0
                factors.append({
                    "factor": "Critical Water Depth (Rain-Driven)",
                    "contribution": f"+{depth_pts:.0f} pts (rainfall context)",
                    "detail": f"Very high water ({water_depth_m:.2f}m) but heavy rainfall ({rainfall_mm:.1f} mm/h) substantially explains this.",
                    "baseline": f"{t['critical_depth_m']}m",
                    "measured": f"{water_depth_m:.2f}m"
                })
        elif water_depth_m >= t["elevated_depth_m"]:
            if not rain_explains_high_water:
                depth_pts = 15.0
                triggered.append("elevated_water_depth")
                factors.append({
                    "factor": "Elevated Water Depth",
                    "contribution": f"+{depth_pts:.0f} pts",
                    "detail": f"Culvert at {water_depth_m:.2f}m (elevated threshold: {t['elevated_depth_m']}m). Not explained by current rainfall.",
                    "baseline": f"{t['elevated_depth_m']}m",
                    "measured": f"{water_depth_m:.2f}m"
                })
            else:
                factors.append({
                    "factor": "Elevated Water Depth (Rain-Driven)",
                    "contribution": "+0 pts (heavy rain)",
                    "detail": f"Elevated water ({water_depth_m:.2f}m) fully explained by heavy rainfall ({rainfall_mm:.1f} mm/h).",
                    "baseline": f"{t['elevated_depth_m']}m",
                    "measured": f"{water_depth_m:.2f}m"
                })
        else:
            factors.append({
                "factor": "Water Depth",
                "contribution": "+0 pts (normal)",
                "detail": f"Normal depth: {water_depth_m:.2f}m (below elevated threshold of {t['elevated_depth_m']}m).",
                "baseline": f"{t['elevated_depth_m']}m",
                "measured": f"{water_depth_m:.2f}m"
            })
        score += depth_pts

    # Rule 3: Abnormally low flow during rainfall
    flow_pts = 0.0
    if flow_velocity_mps is not None and water_depth_m is not None:
        if water_depth_m >= t["elevated_depth_m"] and flow_velocity_mps < t["low_flow_velocity_mps"]:
            flow_pts = 35.0
            triggered.append("high_water_low_flow")
            factors.append({
                "factor": "High Water + Abnormally Low Flow",
                "contribution": f"+{flow_pts:.0f} pts",
                "detail": f"Water at {water_depth_m:.2f}m but flow only {flow_velocity_mps:.3f} m/s (threshold: {t['low_flow_velocity_mps']} m/s). Inconsistent with normal drainage — suggests partial or full blockage.",
                "baseline": f"{t['low_flow_velocity_mps']} m/s",
                "measured": f"{flow_velocity_mps:.3f} m/s"
            })
        elif water_depth_m >= t["elevated_depth_m"] and flow_velocity_mps < 0.3:
            flow_pts = 15.0
            triggered.append("elevated_water_reduced_flow")
            factors.append({
                "factor": "Elevated Water With Reduced Flow",
                "contribution": f"+{flow_pts:.0f} pts",
                "detail": f"Water at {water_depth_m:.2f}m with reduced flow ({flow_velocity_mps:.2f} m/s). Worth monitoring.",
                "baseline": "0.30 m/s expected",
                "measured": f"{flow_velocity_mps:.2f} m/s"
            })
        else:
            factors.append({
                "factor": "Flow Velocity",
                "contribution": "+0 pts (normal)",
                "detail": f"Flow {flow_velocity_mps:.2f} m/s — within acceptable range for current water level.",
                "baseline": f"{t['low_flow_velocity_mps']} m/s (low threshold)",
                "measured": f"{flow_velocity_mps:.2f} m/s"
            })
        score += flow_pts
    elif flow_velocity_mps is None:
        factors.append({
            "factor": "Flow Sensor",
            "contribution": "UNAVAILABLE",
            "detail": "Flow sensor unavailable — cannot assess flow anomaly. Reduces conclusion confidence.",
            "baseline": "N/A",
            "measured": "N/A"
        })

    # Rule 4: Repeat anomaly history
    repeat_pts = 0.0
    if repeat_anomaly_count >= t["repeat_anomaly_count_threshold"]:
        repeat_pts = min(10.0, repeat_anomaly_count * 3.0)
        triggered.append("repeat_anomaly_history")
        factors.append({
            "factor": "Recurring Anomaly History",
            "contribution": f"+{repeat_pts:.0f} pts",
            "detail": f"Station has recorded {repeat_anomaly_count} previous anomalies. Repeat events raise inspection priority.",
            "baseline": f"{t['repeat_anomaly_count_threshold']} events",
            "measured": f"{repeat_anomaly_count} events"
        })
    score += repeat_pts

    # Rule 5: Nearby plastic detection
    plastic_pts = 0.0
    if nearby_plastic_kg > 200:
        plastic_pts = 10.0
        triggered.append("nearby_plastic_detected")
        factors.append({
            "factor": "Prior Plastic Detection Nearby",
            "contribution": f"+{plastic_pts:.0f} pts",
            "detail": f"Previous surveys recorded ~{nearby_plastic_kg:.0f} kg of plastic near this station. Plausible contributing factor — not a confirmed cause.",
            "baseline": "200 kg threshold",
            "measured": f"{nearby_plastic_kg:.0f} kg"
        })
    elif nearby_plastic_kg > 50:
        plastic_pts = 5.0
        factors.append({
            "factor": "Moderate Plastic Detected Nearby",
            "contribution": f"+{plastic_pts:.0f} pts",
            "detail": f"Moderate plastic (~{nearby_plastic_kg:.0f} kg) in nearby surveys. Low contribution to priority.",
            "baseline": "50 kg threshold",
            "measured": f"{nearby_plastic_kg:.0f} kg"
        })
    score += plastic_pts

    score = min(100.0, max(0.0, score))

    # Determine status
    if score == 0 or not triggered:
        status = BlockageStatus.NORMAL
        risk_cat = "Normal"
    elif score < 20:
        status = BlockageStatus.NORMAL
        risk_cat = "Low"
    elif score < 45:
        status = BlockageStatus.SUSPICIOUS_ANOMALY
        risk_cat = "Medium"
    elif score < 70:
        status = BlockageStatus.POSSIBLE_BLOCKAGE
        risk_cat = "High"
    else:
        status = BlockageStatus.POSSIBLE_BLOCKAGE
        risk_cat = "Critical"

    # Recommended action
    if risk_cat in ("Critical", "High"):
        action = "Dispatch field inspector to verify drain condition. Do NOT treat as confirmed blockage until inspection is completed."
    elif risk_cat == "Medium":
        action = "Monitor closely for the next 15-30 minutes. If conditions worsen, dispatch an inspector."
    else:
        action = "No action required. Continue routine monitoring."

    # Confidence note
    conf_parts = []
    if "flow_velocity" in missing:
        conf_parts.append("flow sensor offline — blockage cannot be confirmed from water level alone")
    if "rainfall" in missing:
        conf_parts.append("rainfall data unavailable — cannot rule out rain as cause")
    if rain_explains_high_water:
        conf_parts.append("current heavy rainfall substantially explains elevated water levels")

    confidence_note = (
        f"Confidence limited: {'; '.join(conf_parts)}."
        if conf_parts
        else "All sensor readings complete. Assessment based on all available evidence."
    )

    return {
        "status": status,
        "risk_score": round(score, 1),
        "risk_category": risk_cat,
        "triggered_rules": triggered,
        "evidence_factors": factors,
        "missing_data": missing,
        "rainfall_context": rainfall_context,
        "recommended_action": action,
        "confidence_note": confidence_note,
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }


def build_explainable_priority_score(
    anomaly_result: Dict[str, Any],
    duration_abnormal_minutes: float = 0.0,
    downstream_vulnerability: Optional[str] = None,
) -> Dict[str, Any]:
    """Combines anomaly score with contextual factors into a final priority score."""
    base = anomaly_result.get("risk_score", 0.0)
    factors_out = list(anomaly_result.get("evidence_factors", []))
    bonus = 0.0

    if duration_abnormal_minutes > 30:
        d_pts = min(10.0, duration_abnormal_minutes / 30)
        bonus += d_pts
        factors_out.append({
            "factor": "Duration of Abnormal Conditions",
            "contribution": f"+{d_pts:.0f} pts",
            "detail": f"Anomalous conditions persisting for {duration_abnormal_minutes:.0f} minutes raises urgency.",
            "baseline": "30 min",
            "measured": f"{duration_abnormal_minutes:.0f} min"
        })

    if downstream_vulnerability in ("High", "Very High"):
        bonus += 8.0
        factors_out.append({
            "factor": "Downstream Infrastructure Vulnerability",
            "contribution": "+8 pts",
            "detail": f"Downstream area classified as {downstream_vulnerability} vulnerability.",
            "baseline": "Moderate",
            "measured": downstream_vulnerability
        })
    elif downstream_vulnerability is None:
        factors_out.append({
            "factor": "Downstream Vulnerability",
            "contribution": "UNAVAILABLE",
            "detail": "No downstream vulnerability data available for this station.",
            "baseline": "N/A",
            "measured": "N/A"
        })

    total = min(100.0, base + bonus)
    cat = "Normal"
    if total >= 75:
        cat = "Critical"
    elif total >= 55:
        cat = "High"
    elif total >= 30:
        cat = "Medium"
    elif total > 5:
        cat = "Low"

    return {
        "priority_score": round(total, 1),
        "priority_category": cat,
        "evidence_factors": factors_out,
        "status": anomaly_result.get("status", BlockageStatus.NORMAL),
        "missing_data": anomaly_result.get("missing_data", []),
        "confidence_note": anomaly_result.get("confidence_note", ""),
        "rainfall_context": anomaly_result.get("rainfall_context", ""),
        "recommended_action": anomaly_result.get("recommended_action", "No action required."),
    }

