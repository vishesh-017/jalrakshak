"""
JalRakshak - Predictive Leakage Forecast ML Training Pipeline (XGBoost)
Target: "Relative likelihood of high visible plastic accumulation at a monitored outlet within 48h following rainfall."

Methodology:
- Features: rainfall_24h_mm, forecast_24h_mm, tide_level_m, water_depth_m,
            days_since_cleanup, catchment_area_sqkm, urban_density_idx, barrier_compromised_flag
- Chronological train/validation split (70% train, 30% test) to prevent future-data leakage
- Evaluates:
  1. Rainfall-only threshold baseline
  2. JalRakshak Rule-based Heuristic (Model A)
  3. XGBoost Gradient Boosted Classifier (Model B)
- Outputs precision, recall, F1-score, confusion matrix, feature importances, and honesty metadata.
"""

import os
import json
import datetime
import numpy as np
import pandas as pd
from typing import Dict, Any

try:
    import xgboost as xgb
    from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

def generate_synthetic_historical_data(n_samples: int = 1200) -> pd.DataFrame:
    """
    Generates realistic synthetic observations spanning 180 days across Mumbai pilot basins.
    Assumptions documented honestly:
    - High rainfall (>60mm) strongly correlates with flush
    - High spring tides (>3.8m) cause tidal backflow and block outlet escape
    - High urban density increases baseline debris loading
    - Compromised barriers dramatically elevate choke likelihood
    """
    np.random.seed(42)
    start_date = datetime.date(2025, 6, 1) # Start of monsoon
    dates = [start_date + datetime.timedelta(hours=int(h * 3.6)) for h in range(n_samples)]

    sites = ["MTH-01", "MTH-02", "MLD-01", "MLD-02", "TRM-01", "WR-01", "MHM-01", "VSV-01"]
    densities = {"Low": 1, "Moderate": 2, "High": 3, "Very High": 4}

    records = []
    for i in range(n_samples):
        site = np.random.choice(sites)
        rain_24h = max(0.0, np.random.exponential(scale=28.0) - 5.0)
        # Seasonal monsoon spikes
        if (i % 80) in range(10):
            rain_24h += np.random.uniform(50.0, 120.0)

        rain_fc = max(0.0, rain_24h * np.random.uniform(0.7, 1.4))
        # Tide proxy: semi-diurnal tide (approx 12.4h cycle) between 0.8m and 4.8m
        tide_phase_hr = (i % 24)
        tide_lvl = 2.8 + 1.6 * np.sin(2 * np.pi * tide_phase_hr / 12.4) + np.random.normal(0, 0.15)
        
        water_depth = 0.6 + (rain_24h / 80.0) + max(0.0, (tide_lvl - 3.5) * 0.4)
        days_cleanup = np.random.randint(1, 35)
        urban_density = "Very High" if "MTH" in site else "High" if "MLD" in site else "Moderate"
        density_idx = densities[urban_density]
        barrier_compromised = 1 if np.random.rand() < 0.22 else 0

        # Physical latent risk function based on InnovateX pilot parameters
        latent_risk = (
            (rain_24h * 0.35) +
            (rain_fc * 0.20) +
            (max(0.0, tide_lvl - 3.5) * 18.0) +
            (density_idx * 6.5) +
            (barrier_compromised * 22.0) +
            (days_cleanup * 0.6) +
            np.random.normal(0, 8.0)
        )
        
        # Ground truth target: High accumulation within 48h (latent_risk >= 55)
        is_high_accumulation = 1 if latent_risk >= 55.0 else 0

        records.append({
            "timestamp": dates[i].isoformat(),
            "site_id": site,
            "rainfall_24h_mm": round(rain_24h, 2),
            "forecast_24h_mm": round(rain_fc, 2),
            "tide_level_m": round(tide_lvl, 2),
            "water_depth_m": round(water_depth, 2),
            "days_since_cleanup": days_cleanup,
            "urban_density_idx": density_idx,
            "barrier_compromised_flag": barrier_compromised,
            "latent_score": round(latent_risk, 1),
            "is_high_accumulation_48h": is_high_accumulation
        })

    df = pd.DataFrame(records)
    # Sort chronologically
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df

def train_and_evaluate():
    print("=" * 65)
    print(" JalRakshak: Risk Forecaster Training & Baseline Evaluation")
    print(" Target: Relative likelihood of high plastic accumulation in 48h")
    print("=" * 65)

    df = generate_synthetic_historical_data(n_samples=1400)
    
    # Save dataset to data/observations.csv
    os.makedirs("data", exist_ok=True)
    df.to_csv("data/observations.csv", index=False)
    print(f"Generated synthetic training dataset: {len(df)} records saved to data/observations.csv")
    print(f"Positive class ratio (High Accumulation): {df['is_high_accumulation_48h'].mean():.2%}")

    feature_cols = [
        "rainfall_24h_mm", "forecast_24h_mm", "tide_level_m",
        "water_depth_m", "days_since_cleanup", "urban_density_idx",
        "barrier_compromised_flag"
    ]

    # Chronological Split (70% Train, 30% Test) to prevent future data leakage
    split_idx = int(len(df) * 0.70)
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()

    X_train = train_df[feature_cols]
    y_train = train_df["is_high_accumulation_48h"]
    X_test = test_df[feature_cols]
    y_test = test_df["is_high_accumulation_48h"]

    print(f"Chronological split: Train={len(train_df)} records, Test={len(test_df)} records")
    print(f"Train period: {train_df['timestamp'].min().strftime('%Y-%m-%d')} to {train_df['timestamp'].max().strftime('%Y-%m-%d')}")
    print(f"Test period:  {test_df['timestamp'].min().strftime('%Y-%m-%d')} to {test_df['timestamp'].max().strftime('%Y-%m-%d')}")

    # 1. Baseline 1: Rainfall Only (predicts positive if rainfall_24h_mm >= 55mm)
    pred_rain_only = (test_df["rainfall_24h_mm"] >= 55.0).astype(int)

    # 2. Baseline 2: Heuristic Model A (Score >= 55)
    heuristic_score = (
        test_df["rainfall_24h_mm"] * 0.35 +
        test_df["forecast_24h_mm"] * 0.20 +
        np.maximum(0, test_df["tide_level_m"] - 3.5) * 16.0 +
        test_df["urban_density_idx"] * 6.0 +
        test_df["barrier_compromised_flag"] * 20.0
    )
    pred_heuristic = (heuristic_score >= 50.0).astype(int)

    # 3. Model B: XGBoost Classifier
    scale_pos_weight = (len(y_train) - sum(y_train)) / max(1, sum(y_train))
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        eval_metric="logloss"
    )
    model.fit(X_train, y_train)

    pred_xgb = model.predict(X_test)
    pred_xgb_proba = model.predict_proba(X_test)[:, 1]

    # Metrics computation
    def compute_metrics(y_true, y_pred, y_proba=None):
        prec = float(precision_score(y_true, y_pred, zero_division=0))
        rec = float(recall_score(y_true, y_pred, zero_division=0))
        f1 = float(f1_score(y_true, y_pred, zero_division=0))
        auc = float(roc_auc_score(y_true, y_proba)) if y_proba is not None else None
        cm = confusion_matrix(y_true, y_pred).tolist()
        return {
            "precision": round(prec, 3),
            "recall": round(rec, 3),
            "f1_score": round(f1, 3),
            "roc_auc": round(auc, 3) if auc else None,
            "confusion_matrix": cm # [[TN, FP], [FN, TP]]
        }

    metrics_rain = compute_metrics(y_test, pred_rain_only)
    metrics_heur = compute_metrics(y_test, pred_heuristic)
    metrics_xgb = compute_metrics(y_test, pred_xgb, pred_xgb_proba)

    # Feature Importances
    importances = {feat: round(float(imp), 4) for feat, imp in zip(feature_cols, model.feature_importances_)}
    sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    model_card = {
        "model_version": "v1.2-synthetic-eval",
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "data_provenance": {
            "dataset_origin": "Synthetic scenario data generated under Mumbai monsoon conditions (data/observations.csv)",
            "validation_status": "PROTOTYPE PIPELINE VALIDATION (TRAINED ON SYNTHETIC DATA, NOT FIELD-VALIDATED)",
            "total_samples": len(df),
            "train_samples": len(train_df),
            "test_samples": len(test_df),
            "test_split_strategy": "Chronological (First 70% Train, Last 30% Test — No future-data leakage)",
            "positive_class_events": int(sum(df["is_high_accumulation_48h"])),
            "negative_class_events": int(len(df) - sum(df["is_high_accumulation_48h"]))
        },
        "target_definition": "Relative likelihood of high visible plastic accumulation at a monitored outlet within 48 hours following rainfall.",
        "model_comparisons": {
            "rainfall_only_baseline": {
                "name": "Rainfall-Only Threshold (≥55mm)",
                "type": "Single-feature threshold",
                **metrics_rain
            },
            "model_a_heuristic": {
                "name": "JalRakshak Heuristic Multi-Factor (Model A)",
                "type": "Physics-informed rule-based score",
                **metrics_heur
            },
            "model_b_xgboost": {
                "name": "XGBoost Classifier (Model B)",
                "type": "Gradient Boosted Decision Trees",
                **metrics_xgb
            }
        },
        "feature_importances": sorted_importances,
        "honest_limitations": [
            "Trained on synthetic training records based on physical heuristic assumptions, not sensor-calibrated ground truth.",
            "Visual accumulation severity is not equivalent to measured plastic mass.",
            "Requires field sensor calibration across Mithi, Malad, and Trombay basins before operational municipal deployment.",
            "Domain shift: Camera glare, monsoon turbidity, and low night light affect real-world camera detection accuracy."
        ]
    }

    # Save to ml/model_card_metrics.json
    os.makedirs("ml", exist_ok=True)
    with open("ml/model_card_metrics.json", "w", encoding="utf-8") as f:
        json.dump(model_card, f, indent=2)

    print("\n--- Model Evaluation Results (on held-out chronological test set) ---")
    print(f"1. Rainfall Only : Precision={metrics_rain['precision']}, Recall={metrics_rain['recall']}, F1={metrics_rain['f1_score']}")
    print(f"2. Heuristic (A) : Precision={metrics_heur['precision']}, Recall={metrics_heur['recall']}, F1={metrics_heur['f1_score']}")
    print(f"3. XGBoost (B)   : Precision={metrics_xgb['precision']}, Recall={metrics_xgb['recall']}, F1={metrics_xgb['f1_score']}, AUC={metrics_xgb['roc_auc']}")
    print("\nSaved metrics report to ml/model_card_metrics.json")

    return model_card

if __name__ == "__main__":
    train_and_evaluate()
