"""
Production Model Evaluation Script
Computes Top-1 Accuracy, Top-5 Accuracy, and Top-K Confusion Analysis across all 261 ISL classes.
"""

import os
import json
import torch
import numpy as np
from torch.utils.data import DataLoader, random_split
from dataset_loader import ISLParquetDataset
from model import ISLSequenceClassifier


def evaluate():
    print("==================================================================", flush=True)
    print("  📊 Sanket AI — ISL Model Evaluation & Confusion Diagnostics     ", flush=True)
    print("==================================================================", flush=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluation Device: {device}", flush=True)

    ckpt_path = os.path.join(os.path.dirname(__file__), "best_model.pth")
    if not os.path.exists(ckpt_path):
        print(f"[Error] Checkpoint not found at {ckpt_path}. Run run_training.py first!", flush=True)
        return

    checkpoint = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    classes = checkpoint["classes"]
    num_classes = len(classes)

    # Load dataset
    dataset = ISLParquetDataset(is_train=False, augment=False)
    total_samples = len(dataset)
    val_size = max(1, int(0.15 * total_samples))
    train_size = total_samples - val_size

    _, val_dataset = random_split(
        dataset, [train_size, val_size], generator=torch.Generator().manual_seed(42)
    )
    val_loader = DataLoader(val_dataset, batch_size=64, shuffle=False)

    model = ISLSequenceClassifier(input_dim=138, num_classes=num_classes).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    top1_correct = 0
    top5_correct = 0
    total = 0
    confusions = {}

    with torch.no_grad():
        for seqs, labels in val_loader:
            seqs = seqs.to(device)
            labels = labels.to(device)

            logits = model(seqs)
            probs = torch.softmax(logits, dim=1)

            # Top 1
            top1_preds = torch.argmax(probs, dim=1)
            top1_correct += (top1_preds == labels).sum().item()

            # Top 5
            top5_preds = torch.topk(probs, k=min(5, num_classes), dim=1).indices
            for i in range(labels.size(0)):
                true_lbl = labels[i].item()
                pred_lbl = top1_preds[i].item()
                if true_lbl in top5_preds[i]:
                    top5_correct += 1

                if true_lbl != pred_lbl:
                    pair = (classes[true_lbl], classes[pred_lbl])
                    confusions[pair] = confusions.get(pair, 0) + 1

            total += labels.size(0)

    top1_acc = (top1_correct / total) * 100
    top5_acc = (top5_correct / total) * 100

    print(f"\n==================== EVALUATION SUMMARY ====================")
    print(f"Total Validation Samples Evaluated : {total}")
    print(f"Top-1 Accuracy                    : {top1_acc:.2f}%")
    print(f"Top-5 Accuracy                    : {top5_acc:.2f}%")
    print(f"============================================================")

    # Top confused pairs
    sorted_confusions = sorted(confusions.items(), key=lambda x: x[1], reverse=True)
    if sorted_confusions:
        print("\n🔍 Top Confused Sign Pairs (Ground Truth ➔ Model Predicted):")
        for (true_cls, pred_cls), count in sorted_confusions[:12]:
            print(f"   • {true_cls.upper():<16} ➔  {pred_cls.upper():<16} ({count} take{'s' if count > 1 else ''})")
    else:
        print("\nZero validation misclassifications found in this batch!")

    print("\n✅ Evaluation complete.")


if __name__ == "__main__":
    evaluate()
