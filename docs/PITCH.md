# JalRakshak — Hackathon Pitch Outline & Competition Briefing

**Techfest IIT Bombay InnovateX — Theme 3: Plastic Pollution in Coastal Cities (Mumbai Focus)**  
*Project: JalRakshak — Predictive Plastic Leakage Monitoring, Smart Dispatch & Verified Recovery Ledger*

---

## 1. The One-Line Pitch
> **"JalRakshak forecasts which Mumbai drain outlets are most likely to leak plastic after rainfall, dispatches cleanup crews in an optimized order, and keeps an evidence-backed recovery ledger for potential EPR credit generation."**

---

## 2. Ten-Minute Pitch Structure

### Slide 1: The Problem (2 Minutes)
- **Mumbai Coastal Geography**: Greater Mumbai discharges runoff through over 200 major nullahs and creek outfalls into the Arabian Sea, Mahim Bay, and Thane Creek.
- **The Dual-Vulnerability Cycle**:
  1. *Heavy Monsoon Downpours (Flushing)*: Upstream stormwater washes uncollected urban solid waste toward outfalls.
  2. *High Spring Tides (>4.2m)*: Tidal backflow submerges gravity gates and floating trash booms, causing sudden choke events and structural barrier failures.
- **The Core Inefficiency**: Municipal ward operations are currently **100% reactive**—crews are deployed only after citizen complaints or street-level waterlogging occur, by which time thousands of kilograms of plastic debris have already escaped into the sea.

### Slide 2: The Solution Architecture (2 Minutes)
- **Software-First, Perception-Augmented**:
  - **Predictive Leakage Forecaster**: Combines Open-Meteo rainfall forecasts, semi-diurnal tidal curves, upstream catchment densities, and recent surveillance detections to score outlet risk 48 hours in advance.
  - **Decision-Support Dispatch**: Solves the multi-stop routing problem via Google OR-Tools to recommend crew stops before peak rainfall hits.
  - **Evidence-Backed Recovery Ledger**: Tracks weighbridge-scale collections with material category breakdowns, disposal facility manifests, and SHA-256 tamper-evident audit hashes.

### Slide 3: Live Demonstration Walkthrough (3 Minutes)
- *Step 1: Normal Ambient State* on the Mumbai Hotspot Map (10 pilot sites across Mithi River, Malad Creek, Trombay).
- *Step 2: Simulate Storm Event* (85mm downpour + 4.4m tidal surge). Show instant risk recalculation across all outfalls.
- *Step 3: AI Debris Detection Studio*. Run YOLO inference on CCTV outfall feeds; highlight bottles, bags, and debris index.
- *Step 4: Smart Dispatch*. Generate recommendations; inspect OR-Tools route for BMC Skimmer Boat 1 starting from Dadar Hub.
- *Step 5: Ledger Entry*. Log 485 kg scale-measured recovery at Bhandup MRF; display SHA-256 cryptographic hash and CSV audit export.

### Slide 4: Model Validation & Honesty (1.5 Minutes)
- Explicitly review the **Model Card**:
  - Baseline 1 (Rainfall Only): F1 = 0.613 (misses tidal backflow chokes).
  - Model A (Physical Heuristic): F1 = 0.784 (high precision, low false alarm rate).
  - Model B (XGBoost): F1 = 0.838, ROC-AUC = 0.956 (evaluated on strict chronological test set without future leakage).
- **Strict Data Honesty**: Synthetic training data is clearly marked. Potential EPR eligibility is shown as conditional on CPCB audit, never guaranteed.

### Slide 5: Economics & Phase 2 Roadmap (1.5 Minutes)
- **Pilot Economics**: ₹18 Lakhs/year operational cost for 10 outfalls (~₹15,000/month per outlet).
- **Phase 2 Hardware Roadmap**:
  - Solar-powered ESP32 ultrasonic water-depth telemetry over LoRaWAN.
  - Edge-compute camera nodes with micro-NPU to reduce 4G streaming costs.
  - Citizen WhatsApp reporting bot for slum settlements along Mithi River.

---

## 3. Five-Minute Compressed Demo Script

| Timing | Screen | Action & Key Talking Point |
|---|---|---|
| **0:00 - 1:00** | **Hotspot Map** | Point out the 8 pilot sites in Mumbai. "Here is Mithi River Outfall 1 (MTH-01). Right now, under normal weather, risk is Low (25/100)." |
| **1:00 - 2:00** | **Demo Mode / Settings** | Trigger the 85mm storm simulation with 4.4m spring tide. "Notice how MTH-01 and MLD-01 jump to Critical risk (85+/100) because high tide blocks gravity discharge." |
| **2:00 - 3:00** | **AI Detection Studio** | Run inference on CCTV sample `mithi_high_plastic_01.jpg`. "The model detects bottles and bags, giving a debris density score. Visual severity is an accumulation index, not a mass measurement." |
| **3:00 - 4:00** | **Cleanup Dispatch** | Click "Optimize Route". "Google OR-Tools solves the Traveling Salesperson Problem from Dadar Depot, giving BMC Skimmer Unit 1 an optimal stop sequence within an 8-hour shift budget." |
| **4:00 - 5:00** | **Recovery Ledger** | Complete the task and commit 485 kg weighed at Bhandup MRF. "Every record receives a SHA-256 audit hash and exportable CSV for third-party EPR verification." |

---

## 4. Judges' Q&A Cheat Sheet

### Q1: How do you handle domain shift between clean river datasets and muddy Mumbai nullahs?
> **Answer:** Open-source river datasets (such as Kili's European river benchmark) feature clear water and daylight lighting. Mumbai nullahs have high silt runoff (turbid brown water), floating hyacinths, and night glare.  
> We address this in two ways:
> 1. We designed a dedicated fine-tuning pipeline (`/data/mumbai` with YOLO format annotations) to adapt weights to localized conditions.
> 2. We maintain a hybrid OpenCV contour-and-density fallback in `app/ai/detector.py` that computes floating surface mat coverage even when individual bottle bounding boxes have low confidence.

### Q2: Why don't you automatically confirm EPR credits or guarantee revenue?
> **Answer:** In strict compliance with our non-negotiable honesty rules: Extended Producer Responsibility (EPR) credits under Central Pollution Control Board (CPCB) guidelines require registered plastic waste processors (PWPs), accredited third-party auditing, and manifest reconciliation. Claiming automated credits would be misleading. JalRakshak acts as the immutable evidence ledger that makes auditing fast and fraud-resistant.

### Q3: Why did you use chronological train/test splitting instead of random K-fold CV for XGBoost?
> **Answer:** Weather and river discharge are autocorrelated time series. Random K-fold cross-validation leaks future weather patterns into the training set, causing artificially inflated accuracy metrics. By enforcing a strict chronological split (first 70% for training, final 30% for testing), we ensure the model is evaluated exclusively on unseen future events.

### Q4: How does this prototype scale beyond the 10 pilot sites?
> **Answer:** The data model and API are multi-tenant and basin-agnostic. Outlets are defined with latitude, longitude, catchment area, and barrier status. Adding a new outlet (e.g. in Dahisar or Poisar River) requires only registering the site coordinates and linking nearest Open-Meteo weather coordinates.
