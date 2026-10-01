"""
JalRakshak - Ground CCTV Model Training Pipeline
Inspired by AniLeo-01/Plastic-In-River-Detection (AGPL-3.0) and Kili plastic_in_river dataset.

Classes:
0: PLASTIC_BAG
1: PLASTIC_BOTTLE
2: OTHER_PLASTIC_WASTE
3: NOT_PLASTIC_WASTE (negative class for drift reduction)
"""

import argparse
import os
import sys

def parse_args():
    parser = argparse.ArgumentParser(description="Train YOLOv8 on River Plastic Detection Dataset")
    parser.add_argument("--data", type=str, default="data/plastic.yaml", help="Path to data YAML config")
    parser.add_argument("--weights", type=str, default="yolov8m.pt", help="Base model weights (e.g. yolov8n.pt, yolov8m.pt)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image size")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--device", type=str, default="", help="cuda device, i.e. 0 or cpu")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    parser.add_argument("--project", type=str, default="runs/train", help="Save directory")
    parser.add_argument("--name", type=str, default="jalrakshak_ground_kili", help="Experiment name")
    return parser.parse_args()

def main():
    args = parse_args()
    print("=" * 60)
    print(" JalRakshak: Ground Camera Plastic Detector Training")
    print(" Reference: AniLeo-01/Plastic-In-River-Detection")
    print(f" Model: {args.weights} | Image Size: {args.imgsz} | Epochs: {args.epochs}")
    print("=" * 60)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics is required. Run 'pip install ultralytics'")
        sys.exit(1)

    # Initialize model
    model = YOLO(args.weights)

    # Train
    print(f"Starting training on {args.data}...")
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device if args.device else None,
        resume=args.resume,
        project=args.project,
        name=args.name,
        plots=True,
        save=True
    )
    print("Training complete! Best weights saved to runs/train/" + args.name + "/weights/best.pt")

if __name__ == "__main__":
    main()
