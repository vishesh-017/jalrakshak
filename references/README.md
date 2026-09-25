# Open-Source References & Attribution

JalRakshak builds upon and extends techniques from two pivotal open-source projects for river plastic detection:

---

### 1. Plastic-In-River-Detection
- **Repository**: [https://github.com/AniLeo-01/Plastic-In-River-Detection](https://github.com/AniLeo-01/Plastic-In-River-Detection)
- **Author**: AniLeo-01
- **Dataset**: Kili `plastic_in_river` dataset on Hugging Face ([hf.co/datasets/Kili/plastic_in_river](https://huggingface.co/datasets/Kili/plastic_in_river))
- **Architecture**: YOLOv8m training pipeline
- **Classes**:
  1. `PLASTIC_BAG`
  2. `PLASTIC_BOTTLE`
  3. `OTHER_PLASTIC_WASTE`
  4. `NOT_PLASTIC_WASTE` (Negative background class)
- **Reused Components in JalRakshak**:
  - `ml/train_ground_yolo.py`: Adapts dataset configuration (`plastic.yaml`), hyperparameter schedule (imgsz 640, epochs 50, batch 16), and class taxonomy for ground CCTV stream analysis.
- **License**: Check upstream repository for details; users must verify dataset license conditions before commercial deployment.

---

### 2. ReWater
- **Repository**: [https://github.com/SwastikGorai/ReWater](https://github.com/SwastikGorai/ReWater)
- **Author**: Swastik Gorai
- **License**: **MIT License**
- **Architecture**: Single-class YOLOv8m trained on aerial drone imagery over contaminated water bodies.
- **Reused Components in JalRakshak**:
  - Drone / aerial inference mode reference in `app/ai/detector.py`
  - Contour and density calculation heuristics for floating waste beds.

---

### Third-Party Software & Data Disclaimers
- **Ultralytics YOLOv8**: Distributed under the AGPL-3.0 License. Commercial enterprise usage requires commercial licensing from Ultralytics Inc.
- **OpenStreetMap**: Map data © OpenStreetMap contributors, licensed under the Open Database License (ODbL).
- **Google OR-Tools**: Vehicle Routing Problem (VRP) optimization engine, licensed under Apache License 2.0.
