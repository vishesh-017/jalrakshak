# Mumbai Nullah and Creek Drain Outfalls Dataset Directory

This directory is structured for fine-tuning YOLOv8 on localized Mumbai camera feeds.

## Folder Structure
```
data/mumbai/
├── dataset.yaml
├── images/
│   ├── train/
│   └── val/
└── labels/
    ├── train/
    └── val/
```

## Annotation Guidelines
- Bounding boxes in standard YOLO format: `<class-id> <x_center> <y_center> <width> <height>` (normalized 0.0 to 1.0).
- Classes:
  - `0`: PLASTIC_BAG (polythene carry bags, thin film packaging)
  - `1`: PLASTIC_BOTTLE (PET drinking bottles, beverage containers)
  - `2`: OTHER_PLASTIC_WASTE (cups, sachets, food wrappers, rigid fragments)
  - `3`: STYROFOAM_FRAGMENT (thermocol insulation, foam packaging)

## Known Domain Shifts
1. **Turbid Monsoon Waters**: Silty brown water during heavy rain shifts color balance compared to clear river benchmark images.
2. **Surface Glare**: Solar reflections on water require polarized camera lenses or augmentation during fine-tuning.
3. **Floating Hyacinth / Debris Mix**: Organic matter frequently intermingles with plastic waste near trash booms.
