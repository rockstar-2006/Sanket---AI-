"""
Production-Grade Training Script for ISL Sequence Classifier
Includes GPU/CUDA Acceleration, NaN-Protected Gradients, Label Smoothing, and Cosine Annealing.
"""

import os
import time
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from dataset_loader import ISLParquetDataset
from model import ISLSequenceClassifier


def train_model(
    dataset_dir=None,
    epochs=40,
    batch_size=64,
    lr=1e-3,
    save_path="best_model.pth",
    device=None,
):
    # Detect GPU / CUDA capability
    if device is None:
        if torch.cuda.is_available():
            device = torch.device("cuda")
            gpu_name = torch.cuda.get_device_name(0)
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
            print(f"==================================================", flush=True)
            print(f"⚡ NVIDIA GPU ACCELERATION ACTIVE!", flush=True)
            print(f"  Device   : {gpu_name} ({vram_gb:.2f} GB VRAM)", flush=True)
            print(f"  CUDA Ver : {torch.version.cuda}", flush=True)
            print(f"  Speed    : RTX Tensor Accelerated (FP32 Rock-Solid Precision)", flush=True)
            print(f"==================================================", flush=True)
            torch.backends.cudnn.benchmark = True
        else:
            device = torch.device("cpu")
            print(f"==================================================", flush=True)
            print(f"ℹ️ Current PyTorch is running on CPU.", flush=True)
            print(f"==================================================", flush=True)

    use_cuda = device.type == "cuda"

    # 1. Prepare Dataset
    full_dataset = ISLParquetDataset(dataset_dir=dataset_dir, is_train=True, augment=True)
    num_classes = len(full_dataset.classes)
    total_samples = len(full_dataset)

    if total_samples == 0:
        raise ValueError(f"No .parquet samples found in {dataset_dir}!")

    # Train / Val Split (85% train, 15% validation)
    val_size = max(1, int(0.15 * total_samples))
    train_size = total_samples - val_size
    train_dataset, val_dataset = random_split(
        full_dataset, [train_size, val_size], generator=torch.Generator().manual_seed(42)
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        drop_last=(train_size > batch_size),
        pin_memory=use_cuda,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        pin_memory=use_cuda,
    )

    print(f"[Dataset] Train Samples: {train_size} | Val Samples: {val_size} | Classes: {num_classes}", flush=True)

    # 2. Initialize Model
    model = ISLSequenceClassifier(input_dim=138, num_classes=num_classes).to(device)
    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[Model] Trainable Parameters: {total_params:,} (~{total_params * 4 / 1024 / 1024:.2f} MB)", flush=True)

    # 3. Loss with Label Smoothing, AdamW, and Cosine Annealing
    criterion = nn.CrossEntropyLoss(label_smoothing=0.10)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    best_val_acc = 0.0
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        # ─── Training Phase ──────────────────────────────────────────
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0

        for seqs, labels in train_loader:
            seqs = seqs.to(device, non_blocking=use_cuda)
            labels = labels.to(device, non_blocking=use_cuda)

            optimizer.zero_grad(set_to_none=True)
            outputs = model(seqs)
            loss = criterion(outputs, labels)

            if torch.isnan(loss) or torch.isinf(loss):
                continue

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()

            train_loss += loss.item() * seqs.size(0)
            preds = torch.argmax(outputs, dim=1)
            train_correct += (preds == labels).sum().item()
            train_total += seqs.size(0)

        scheduler.step()
        epoch_train_loss = train_loss / train_total if train_total > 0 else 0
        epoch_train_acc = (train_correct / train_total * 100) if train_total > 0 else 0

        # ─── Validation Phase ────────────────────────────────────────
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for seqs, labels in val_loader:
                seqs = seqs.to(device, non_blocking=use_cuda)
                labels = labels.to(device, non_blocking=use_cuda)

                outputs = model(seqs)
                loss = criterion(outputs, labels)

                if not (torch.isnan(loss) or torch.isinf(loss)):
                    val_loss += loss.item() * seqs.size(0)

                preds = torch.argmax(outputs, dim=1)
                val_correct += (preds == labels).sum().item()
                val_total += seqs.size(0)

        epoch_val_loss = val_loss / val_total if val_total > 0 else 0
        epoch_val_acc = (val_correct / val_total * 100) if val_total > 0 else 0

        # Checkpoint Best Model
        is_best = epoch_val_acc > best_val_acc
        if is_best:
            best_val_acc = epoch_val_acc
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_acc": epoch_val_acc,
                "classes": full_dataset.classes,
            }, save_path)

        best_mark = " ⭐ (Best)" if is_best else ""
        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] "
            f"Train Loss: {epoch_train_loss:.4f} | Train Acc: {epoch_train_acc:.1f}% | "
            f"Val Loss: {epoch_val_loss:.4f} | Val Acc: {epoch_val_acc:.1f}%{best_mark}",
            flush=True
        )

    elapsed = time.time() - start_time
    print(f"\n✅ Training Finished in {elapsed:.1f}s | Best Val Accuracy: {best_val_acc:.1f}%", flush=True)
    print(f"💾 Checkpoint saved to: {os.path.abspath(save_path)}", flush=True)
    return save_path


if __name__ == "__main__":
    train_model(epochs=40, batch_size=64)
