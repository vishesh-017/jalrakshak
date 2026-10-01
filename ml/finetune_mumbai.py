"""
JalRakshak - Fine-Tuning Pipeline for Mumbai Nullah Imagery
Takes pre-trained weights (e.g., Kili-trained or ReWater aerial) and fine-tunes
on localized Mumbai drain outfall and creek camera captures (/data/mumbai).
"""

import argparse
import os
import sys

def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune YOLOv8 on Mumbai Nullah Images")
    parser.add_argument("--base-weights", type=str, default="yolov8m.pt", help="Path to base pre-trained checkpoint")
    parser.add_argument("--data", type=str, default="data/mumbai/dataset.yaml", help="Path to Mumbai dataset YAML")
    parser.add_argument("--epochs", type=int, default=30, help="Fine-tuning epochs")
    parser.add_argument("--lr0", type=float, default=0.001, help="Initial learning rate (lower for fine-tuning)")
    parser.add_argument("--freeze", type=int, default=10, help="Number of backbone layers to freeze")
    parser.add_argument("--imgsz", type=int, default=640, help="Image resolution")
    parser.add_argument("--project", type=str, default="runs/finetune", help="Save directory")
    parser.add_argument("--name", type=str, default="jalrakshak_mumbai_outfalls", help="Experiment name")
    return parser.parse_args()

def main():
    args = parse_args()
    print("=" * 60)
    print(" JalRakshak: Fine-Tuning on Mumbai Nullah Imagery")
    print(f" Base Weights: {args.base_weights} | Epochs: {args.epochs} | lr0: {args.lr0}")
    print("=" * 60)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics is required.")
        sys.exit(1)

    model = YOLO(args.base_weights)
    print(f"Fine-tuning on {args.data} with backbone freeze={args.freeze}...")
    
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        lr0=args.lr0,
        freeze=args.freeze,
        imgsz=args.imgsz,
        project=args.project,
        name=args.name,
        plots=True
    )
    print("Fine-tuning complete!")

if __name__ == "__main__":
    main()
