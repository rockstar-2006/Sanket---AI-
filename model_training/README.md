# 🇮🇳 Sanket AI — ISL Temporal Model Training Engine

Production-grade training and ONNX export pipeline for Indian Sign Language (ISL) recognition across 262 classes, trained directly from authentic `.parquet` motion-captured landmark files (`D:\Matri\Dataset`).

---

## 🏗️ Architecture Overview

```
Webcam 30 FPS MediaPipe Landmarks
               │
               ▼
   [30-Frame Rolling Window: (1, 30, 138)]
               │
               ▼
┌──────────────────────────────────────────────┐
│  Multi-Scale 1D Temporal Convolution (TCN)   │  Kernel 3 (velocity) + Kernel 5 (stroke direction)
│  BatchNorm1d + GELU + Residual Shortcut     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  2-Layer Bidirectional GRU (Hidden: 128)     │  Captures forward and backward temporal dependencies
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Self-Attention Temporal Pooling Layer       │  Automatically weights stroke peak & suppresses transitions
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Classification Head (128 -> 262 classes)    │  Softmax probabilities over 262 ISL vocabulary words
└──────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
d:\Matri\model_training\
 ├── requirements.txt       # Dependencies (PyTorch, ONNX, Pandas, PyArrow)
 ├── dataset_loader.py      # Parquet parser, normalization, and temporal/spatial augmentations
 ├── model.py               # TCN + BiGRU + Temporal Attention PyTorch architecture (~640k params)
 ├── train.py               # Training loop with Label Smoothing & CosineAnnealingLR
 ├── export_onnx.py         # Exports best_model.pth to public/models/isl_model.onnx
 ├── run_training.py        # 1-Command end-to-end pipeline
 └── README.md              # This documentation
```

---

## 🚀 Quickstart: How to Train

### 1. Install Dependencies
Open PowerShell or your terminal:
```powershell
cd d:\Matri\model_training
pip install -r requirements.txt
```

### 2. Run the 1-Click Pipeline
```powershell
python run_training.py --dataset "D:\Matri\Dataset" --epochs 40 --batch 32
```

### 3. Generated Production Files
The script automatically exports and verifies:
1. **`d:\Matri\public\models\isl_model.onnx`** ($\approx 2.5\text{ MB}$, verified with `onnx.checker` and `onnxruntime`).
2. **`d:\Matri\public\models\isl_labels.json`** (deterministic map of class indices to the 262 ISL vocabulary words).

---

## 🎯 Key Production Features

1. **Palm-Scale & Origin Normalization**:
   All joints are centered at the wrist and scaled by the anatomical distance between wrist and middle MCP, making the model invariant to camera distance.
2. **Data Augmentation**:
   * Temporal speed scaling ($\pm 15\%$, simulating faster or slower signers)
   * Spatial scaling ($\pm 10\%$)
   * Gaussian joint jitter
   * Horizontal mirroring (automatically supports both left-handed and right-handed signers)
3. **In-Browser Execution**:
   Exported model runs directly in client browsers via WebAssembly / WebGL with $< 10\text{ ms}$ latency per inference.
