"""
Real Evaluation Script for Sanket AI
Reads the REAL PyTorch model (model_training/best_model.pth)
and the REAL cached dataset (model_training/cached_dataset.pt).

Computes:
- True Validation Accuracy from the real checkpoint
- True Top-1 and Top-5 accuracy on the validation split
- True per-sign predictions
- Saves raw_predictions.csv and real_metrics.json
"""

import os
import sys
import json
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

# Add model_training directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'model_training')))

try:
    from model import ISLSequenceClassifier
    from dataset_loader import ISLParquetDataset
except ImportError as e:
    print(f"Error importing model modules: {e}")
    sys.exit(1)

def run_real_evaluation():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    model_path = os.path.join(base_dir, 'model_training', 'best_model.pth')
    cache_path = os.path.join(base_dir, 'model_training', 'cached_dataset.pt')
    labels_path = os.path.join(base_dir, 'public', 'models', 'isl_labels.json')
    output_dir = os.path.join(base_dir, 'real_evaluation_results')
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 70)
    print("  SANKET AI - REAL MODEL & DATASET AUDIT")
    print("=" * 70)

    # 1. Inspect Checkpoint
    if not os.path.exists(model_path):
        print(f"ERROR: Model checkpoint not found at: {model_path}")
        return
    
    print(f"1. Loading Real Model Checkpoint: {model_path} ({os.path.getsize(model_path) / 1024 / 1024:.2f} MB)")
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)
    
    saved_epoch = checkpoint.get("epoch", "N/A")
    saved_val_acc = checkpoint.get("val_acc", None)
    classes = checkpoint.get("classes", [])
    num_classes = len(classes)
    
    print(f"   • Best Saved Epoch:     {saved_epoch}")
    if saved_val_acc is not None:
        print(f"   • Saved Val Accuracy:   {saved_val_acc:.2f}%")
    print(f"   • Number of Classes:    {num_classes}")

    # 2. Inspect Dataset Cache
    if not os.path.exists(cache_path):
        print(f"ERROR: Cached dataset not found at: {cache_path}")
        return

    print(f"\n2. Loading Real Cached Dataset: {cache_path} ({os.path.getsize(cache_path) / 1024 / 1024:.2f} MB)")
    cached_data = torch.load(cache_path, map_location="cpu", weights_only=False)
    features = cached_data.get("features", [])
    labels = cached_data.get("labels", [])
    total_samples = len(features)
    print(f"   • Total Real Sequences: {total_samples}")
    print(f"   • Feature Matrix Shape: ({total_samples}, 30 frames, 138 landmarks)")

    # 3. Instantiate Real Model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n3. Evaluating on Device: {device}")
    model = ISLSequenceClassifier(input_dim=138, num_classes=num_classes).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # 4. Prepare Validation Split (identical to train.py 85/15 split with seed 42)
    val_size = max(1, int(0.15 * total_samples))
    train_size = total_samples - val_size
    
    # Simple reproducible dataset wrapper
    class SimpleDataset(torch.utils.data.Dataset):
        def __init__(self, feats, lbls):
            self.feats = feats
            self.lbls = lbls
        def __len__(self):
            return len(self.feats)
        def __getitem__(self, idx):
            return torch.from_numpy(self.feats[idx]).float(), torch.tensor(self.lbls[idx], dtype=torch.long)

    full_ds = SimpleDataset(features, labels)
    _, val_ds = random_split(full_ds, [train_size, val_size], generator=torch.Generator().manual_seed(42))
    
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False)
    print(f"   • Validation Set Size:  {len(val_ds)} held-out samples")

    # 5. Execute Real Forward Pass
    correct_top1 = 0
    correct_top5 = 0
    total_eval = 0
    predictions_log = []

    print("\n4. Running real forward inference on held-out validation samples...")
    with torch.no_grad():
        for batch_idx, (seqs, batch_labels) in enumerate(val_loader):
            seqs = seqs.to(device)
            batch_labels = batch_labels.to(device)
            logits = model(seqs)
            
            # Top 1
            preds_top1 = torch.argmax(logits, dim=1)
            correct_top1 += (preds_top1 == batch_labels).sum().item()

            # Top 5
            _, preds_top5 = torch.topk(logits, k=min(5, num_classes), dim=1)
            for i in range(len(batch_labels)):
                target = batch_labels[i].item()
                top5_list = preds_top5[i].tolist()
                pred1 = preds_top1[i].item()
                if target in top5_list:
                    correct_top5 += 1
                
                target_word = classes[target] if target < len(classes) else str(target)
                pred_word = classes[pred1] if pred1 < len(classes) else str(pred1)
                is_correct = (target == pred1)
                
                predictions_log.append({
                    "sample_idx": total_eval + i,
                    "ground_truth_idx": target,
                    "ground_truth_label": target_word,
                    "predicted_idx": pred1,
                    "predicted_label": pred_word,
                    "is_correct": is_correct,
                    "in_top5": (target in top5_list)
                })

            total_eval += seqs.size(0)

    real_top1_acc = (correct_top1 / total_eval) * 100.0 if total_eval > 0 else 0.0
    real_top5_acc = (correct_top5 / total_eval) * 100.0 if total_eval > 0 else 0.0

    print("=" * 70)
    print(f"  REAL MEASURED BENCHMARK RESULTS (HELD-OUT VALIDATION SET)")
    print("=" * 70)
    print(f"  • Total Evaluated Samples: {total_eval}")
    print(f"  • REAL Top-1 Accuracy:     {real_top1_acc:.2f}% ({correct_top1}/{total_eval})")
    print(f"  • REAL Top-5 Accuracy:     {real_top5_acc:.2f}% ({correct_top5}/{total_eval})")
    print("=" * 70)

    # 6. Save raw predictions CSV
    csv_path = os.path.join(output_dir, "raw_predictions.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("sample_idx,ground_truth_label,predicted_label,is_correct,in_top5\n")
        for p in predictions_log:
            f.write(f"{p['sample_idx']},{p['ground_truth_label']},{p['predicted_label']},{p['is_correct']},{p['in_top5']}\n")
    print(f"✓ Saved Raw Predictions CSV: {csv_path}")

    # 7. Save Metrics JSON
    metrics_path = os.path.join(output_dir, "real_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump({
            "model_path": model_path,
            "saved_epoch": saved_epoch,
            "saved_val_acc_checkpoint": saved_val_acc,
            "real_measured_top1_accuracy": round(real_top1_acc, 2),
            "real_measured_top5_accuracy": round(real_top5_acc, 2),
            "total_evaluated_samples": total_eval,
            "classes_count": num_classes,
        }, f, indent=2)
    print(f"✓ Saved Real Metrics JSON:   {metrics_path}")
    print("=" * 70)
    print("\nNext step: Run 'python scripts/evaluate_real_model.py' to see your exact real numbers!")

if __name__ == "__main__":
    run_real_evaluation()
