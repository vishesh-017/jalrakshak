"""
JalRakshak Reusable Computer Vision Inference Service
Loads and executes the primary pretrained floating-plastic detection model (Model A):
- Repository: https://github.com/TianlongJia/deep_plastic_YoloV8
- Zenodo weights: https://zenodo.org/records/12800597
  (Model_resize_weights.pt, Model_tiles_weights.pt)
- Shared across Drone Monitoring and Field Worker Reporting modules.
- Evaluates image quality, extracts EXIF GPS metadata, and returns consistent detection schema.
"""

import os
import uuid
import datetime
from typing import Dict, Any, Optional, List, Tuple
from PIL import Image, ExifTags
import cv2
import numpy as np

CLASS_METRICS = {
    "PLASTIC": {"label": "Floating Plastic Debris", "color": "#0284c7", "unit_mass_kg": 0.040},
    "FLOATING_PLASTIC": {"label": "Free-Floating Plastic", "color": "#0284c7", "unit_mass_kg": 0.035},
    "ENTANGLED_PLASTIC": {"label": "Vegetation-Entangled Plastic", "color": "#f97316", "unit_mass_kg": 0.055},
    "WATER_HYACINTH": {"label": "Water Hyacinth Patch", "color": "#10b981", "unit_mass_kg": 0.010},
    "PLASTIC_BOTTLE": {"label": "Plastic Bottle / Container", "color": "#38bdf8", "unit_mass_kg": 0.028},
    "PLASTIC_BAG": {"label": "Plastic Film / Bag", "color": "#fb923c", "unit_mass_kg": 0.015},
    "OTHER_PLASTIC_WASTE": {"label": "General Plastic Waste", "color": "#2dd4bf", "unit_mass_kg": 0.030},
    "STYROFOAM_FRAGMENT": {"label": "Styrofoam / Thermocol", "color": "#eab308", "unit_mass_kg": 0.012}
}

class PlasticInferenceService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PlasticInferenceService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.weights_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai", "weights")
        self.model_rewater = None
        self.model_resize = None
        self.model_tiles = None
        self.model_fallback = None
        self.active_model_name = "Loading..."
        self._load_models()

    def _load_models(self):
        """Loads ReWater and deep_plastic_YoloV8 pretrained weights."""
        try:
            from ultralytics import YOLO

            rewater_path = os.path.join(self.weights_dir, "YOLO_Custom_v8m.pt")
            resize_path = os.path.join(self.weights_dir, "Model_resize_weights.pt")
            tiles_path = os.path.join(self.weights_dir, "Model_tiles_weights.pt")
            fallback_path = os.path.join(self.weights_dir, "yolov8m.pt")

            if os.path.exists(rewater_path):
                self.model_rewater = YOLO(rewater_path)
                self.active_model_name = "ReWater River Plastic (YOLOv8m)"
                print(f"[Inference Service] Loaded ReWater weights from {rewater_path}")

            if os.path.exists(resize_path):
                self.model_resize = YOLO(resize_path)
                if not self.model_rewater:
                    self.active_model_name = "Model A (deep_plastic_YoloV8 - Resize)"
                print(f"[Inference Service] Loaded Model A Resize weights from {resize_path}")

            if os.path.exists(tiles_path):
                self.model_tiles = YOLO(tiles_path)
                print(f"[Inference Service] Loaded Model A Tiles weights from {tiles_path}")

            if os.path.exists(fallback_path):
                self.model_fallback = YOLO(fallback_path)
                print(f"[Inference Service] Loaded Fallback weights from {fallback_path}")

        except Exception as e:
            print(f"[Inference Service] Model loading notice: {e}")

    def get_model(self, model_variant: str = "rewater"):
        # Reload if weights appeared on disk after startup
        if not self.model_rewater and not self.model_resize:
            self._load_models()

        if model_variant in ["rewater", "yolo_custom_v8m"] and self.model_rewater:
            return self.model_rewater, "ReWater River Plastic (YOLOv8m)"
        if model_variant == "tiles" and self.model_tiles:
            return self.model_tiles, "Model A (deep_plastic_YoloV8 - Tiles)"
        if model_variant == "resize" and self.model_resize:
            return self.model_resize, "Model A (deep_plastic_YoloV8 - Resize)"
        
        # Fallbacks
        if self.model_rewater:
            return self.model_rewater, "ReWater River Plastic (YOLOv8m)"
        if self.model_resize:
            return self.model_resize, "Model A (deep_plastic_YoloV8 - Resize)"
        if self.model_tiles:
            return self.model_tiles, "Model A (deep_plastic_YoloV8 - Tiles)"
        if self.model_fallback:
            return self.model_fallback, "YOLOv8m-Creek-Plastic (Pretrained)"
        return None, "No Model Available"

    def extract_exif_metadata(self, image_path: str) -> Dict[str, Any]:
        """
        Extracts GPS coordinates and timestamp from EXIF metadata.
        Returns decimal latitude, longitude, altitude, and capture time.
        """
        result = {
            "has_gps": False,
            "latitude": None,
            "longitude": None,
            "altitude_m": None,
            "capture_time": None,
            "camera_make": None,
            "camera_model": None
        }

        try:
            with Image.open(image_path) as img:
                exif_data = img._getexif()
                if not exif_data:
                    return result

                gps_info = {}
                for tag_id, val in exif_data.items():
                    tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                    if tag_name == "GPSInfo":
                        for t in val:
                            sub_tag = ExifTags.GPSTAGS.get(t, str(t))
                            gps_info[sub_tag] = val[t]
                    elif tag_name == "DateTimeOriginal":
                        result["capture_time"] = str(val)
                    elif tag_name == "Make":
                        result["camera_make"] = str(val).strip()
                    elif tag_name == "Model":
                        result["camera_model"] = str(val).strip()

                if gps_info:
                    lat_coords = gps_info.get("GPSLatitude")
                    lat_ref = gps_info.get("GPSLatitudeRef", "N")
                    lon_coords = gps_info.get("GPSLongitude")
                    lon_ref = gps_info.get("GPSLongitudeRef", "E")

                    if lat_coords and lon_coords:
                        def _to_decimal(coords):
                            d = float(coords[0])
                            m = float(coords[1])
                            s = float(coords[2])
                            return d + (m / 60.0) + (s / 3600.0)

                        lat = _to_decimal(lat_coords)
                        if lat_ref in ["S", "s"]:
                            lat = -lat

                        lon = _to_decimal(lon_coords)
                        if lon_ref in ["W", "w"]:
                            lon = -lon

                        result["has_gps"] = True
                        result["latitude"] = round(lat, 6)
                        result["longitude"] = round(lon, 6)

                    alt = gps_info.get("GPSAltitude")
                    if alt is not None:
                        try:
                            result["altitude_m"] = round(float(alt), 1)
                        except (ValueError, TypeError):
                            pass

        except Exception as e:
            print(f"[Inference Service] EXIF parsing notice: {e}")

        return result

    def assess_image_quality(self, image_path: str) -> Dict[str, Any]:
        """
        Assesses image quality, resolution, and blur to warn operators of uncertainty.
        """
        if not os.path.exists(image_path):
            return {"is_suitable": False, "reason": "Image file not found on disk"}

        img = cv2.imread(image_path)
        if img is None:
            return {"is_suitable": False, "reason": "Corrupt or unreadable image file"}

        h, w = img.shape[:2]
        if h < 180 or w < 180:
            return {"is_suitable": False, "reason": f"Image resolution too low ({w}x{h} px). Minimum required is 200x200 px."}

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        uncertainty = None
        if blur_score < 25.0:
            uncertainty = "Severe image blur detected. Detection confidence is degraded."
        elif blur_score < 60.0:
            uncertainty = "Moderate image motion/focus blur. Recommend operator manual verification."

        mean_brightness = float(np.mean(gray))
        if mean_brightness < 35.0:
            uncertainty = (uncertainty or "") + " Low-light / dark scene detected."

        return {
            "is_suitable": True,
            "width": w,
            "height": h,
            "blur_score": round(blur_score, 1),
            "uncertainty": uncertainty.strip() if uncertainty else None
        }

    def run_detection(
        self,
        image_path: str,
        confidence_threshold: float = 0.10,
        model_variant: str = "resize",
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Runs real inference on an image using Model A.
        Returns bounding boxes, class counts, confidence average, and estimated mass.
        """
        quality = self.assess_image_quality(image_path)
        if not quality["is_suitable"]:
            return {
                "success": False,
                "error": quality["reason"],
                "total_objects_detected": 0,
                "bounding_boxes": [],
                "confidence_avg": 0.0,
                "estimated_surface_mass_kg": 0.0,
                "plastic_detected": False
            }

        model, model_name = self.get_model(model_variant)
        if not model:
            return {
                "success": False,
                "error": "No plastic detection model weights available on server.",
                "total_objects_detected": 0,
                "bounding_boxes": []
            }

        img = cv2.imread(image_path)
        h, w = img.shape[:2]

        results = model.predict(source=image_path, conf=confidence_threshold, verbose=False)
        boxes_out = []
        class_counts: Dict[str, int] = {}
        total_mass = 0.0
        conf_sum = 0.0

        if results and len(results) > 0:
            r = results[0]
            boxes = r.boxes

            for box in boxes:
                xyxy = box.xyxy[0].tolist() # [x1, y1, x2, y2]
                conf = float(box.conf[0])
                cls_idx = int(box.cls[0])

                # Get class label from model names
                raw_label = r.names.get(cls_idx, f"CLASS_{cls_idx}").upper()
                
                # Normalize Model A classes (ff_litter, hyacinth, ent_litter) and general plastic classes
                raw_lower = raw_label.lower()
                if "ff_litter" in raw_lower:
                    mapped_class = "FLOATING_PLASTIC"
                elif "ent_litter" in raw_lower:
                    mapped_class = "ENTANGLED_PLASTIC"
                elif "hyacinth" in raw_lower:
                    mapped_class = "WATER_HYACINTH"
                elif "bottle" in raw_lower or "cup" in raw_lower:
                    mapped_class = "PLASTIC_BOTTLE"
                elif "bag" in raw_lower:
                    mapped_class = "PLASTIC_BAG"
                elif "plastic" in raw_lower or raw_lower in ["0", "class_0"]:
                    mapped_class = "FLOATING_PLASTIC"
                else:
                    mapped_class = "FLOATING_PLASTIC"

                class_counts[mapped_class] = class_counts.get(mapped_class, 0) + 1
                conf_sum += conf

                meta = CLASS_METRICS.get(mapped_class, CLASS_METRICS["PLASTIC"])
                total_mass += meta["unit_mass_kg"]

                # Convert to normalized coordinates
                x1, y1, x2, y2 = xyxy
                boxes_out.append({
                    "class_name": mapped_class,
                    "label": meta["label"],
                    "confidence": round(conf, 3),
                    "color": meta["color"],
                    "box": [
                        round(x1 / w, 4),
                        round(y1 / h, 4),
                        round((x2 - x1) / w, 4),
                        round((y2 - y1) / h, 4)
                    ],
                    "pixel_box": [int(x1), int(y1), int(x2), int(y2)]
                })

                # Draw bounding box on annotated copy
                cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), (0, 180, 255), 2)
                cv2.putText(
                    img,
                    f"{mapped_class} {conf:.2f}",
                    (int(x1), max(18, int(y1) - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 180, 255),
                    2
                )

        count = len(boxes_out)
        avg_conf = (conf_sum / count) if count > 0 else 0.0

        # Save annotated image
        annotated_path = None
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            annotated_filename = f"annotated_{uuid.uuid4().hex[:8]}.jpg"
            annotated_path = os.path.join(output_dir, annotated_filename)
            cv2.imwrite(annotated_path, img)

        plastic_items = sum(c for k, c in class_counts.items() if k != "WATER_HYACINTH")

        return {
            "success": True,
            "model_version": model_name,
            "plastic_detected": plastic_items > 0,
            "total_objects_detected": count,
            "plastic_objects_count": plastic_items,
            "class_counts": class_counts,
            "confidence_avg": round(avg_conf, 3),
            "estimated_surface_mass_kg": round(total_mass, 2),
            "bounding_boxes": boxes_out,
            "annotated_path": annotated_path,
            "uncertainty": quality.get("uncertainty"),
            "image_quality": quality
        }

    def run_detection_on_frame(
        self,
        frame_bgr: np.ndarray,
        confidence_threshold: float = 0.10,
        model_variant: str = "rewater"
    ) -> Dict[str, Any]:
        """
        Runs real inference on an in-memory BGR video frame without saving to disk first.
        Returns detections, annotated copy (numpy), counts, and confidence.
        """
        model, model_name = self.get_model(model_variant)
        if not model:
            return {
                "success": False,
                "error": "No model weights available",
                "boxes": [],
                "annotated_frame": frame_bgr
            }

        h, w = frame_bgr.shape[:2]
        annotated_copy = frame_bgr.copy()

        # Ultralytics accepts BGR numpy arrays directly
        results = model.predict(source=frame_bgr, conf=confidence_threshold, verbose=False)
        boxes_out = []
        conf_sum = 0.0

        if results and len(results) > 0:
            r = results[0]
            boxes = r.boxes

            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls_idx = int(box.cls[0])

                raw_label = r.names.get(cls_idx, f"CLASS_{cls_idx}").upper()
                raw_lower = raw_label.lower()

                if "ff_litter" in raw_lower:
                    mapped_class = "FLOATING_PLASTIC"
                elif "ent_litter" in raw_lower:
                    mapped_class = "ENTANGLED_PLASTIC"
                elif "hyacinth" in raw_lower:
                    mapped_class = "WATER_HYACINTH"
                elif "bottle" in raw_lower:
                    mapped_class = "PLASTIC_BOTTLE"
                elif "bag" in raw_lower:
                    mapped_class = "PLASTIC_BAG"
                else:
                    mapped_class = "FLOATING_PLASTIC"

                conf_sum += conf
                meta = CLASS_METRICS.get(mapped_class, CLASS_METRICS["PLASTIC"])

                x1, y1, x2, y2 = xyxy
                boxes_out.append({
                    "class_name": mapped_class,
                    "label": meta["label"],
                    "confidence": round(conf, 3),
                    "color": meta["color"],
                    "box": [
                        round(x1 / w, 4),
                        round(y1 / h, 4),
                        round((x2 - x1) / w, 4),
                        round((y2 - y1) / h, 4)
                    ],
                    "pixel_box": [int(x1), int(y1), int(x2), int(y2)]
                })

                # Draw bounding box and label
                cv2.rectangle(annotated_copy, (int(x1), int(y1)), (int(x2), int(y2)), (0, 180, 255), 2)
                cv2.putText(
                    annotated_copy,
                    f"{mapped_class} {conf:.2f}",
                    (int(x1), max(18, int(y1) - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 180, 255),
                    2
                )

        count = len(boxes_out)
        avg_conf = (conf_sum / count) if count > 0 else 0.0

        return {
            "success": True,
            "model_version": model_name,
            "total_objects_detected": count,
            "confidence_avg": round(avg_conf, 3),
            "boxes": boxes_out,
            "annotated_frame": annotated_copy
        }

inference_service = PlasticInferenceService()
