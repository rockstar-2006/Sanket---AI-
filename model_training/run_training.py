r"""
One-Command End-to-End ISL Training & ONNX Export Pipeline
Usage:
    python run_training.py [--dataset D:\Matri\Dataset] [--epochs 40] [--batch 64]
"""

import sys
import os

print("[1/3] Sanket AI Training Pipeline initializing...", flush=True)

import argparse
import traceback

print("[2/3] Loading PyTorch and neural architecture modules...", flush=True)
from train import train_model
from export_onnx import export_to_onnx

print("[3/3] Ready! Starting dataset scanner & training loop...", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Train and export production ISL sequence model")
    parser.add_argument("--dataset", type=str, default=r"D:\Matri\Dataset", help="Path to ISL dataset containing .parquet files")
    parser.add_argument("--epochs", type=int, default=40, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=64, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    args = parser.parse_args()

    print("==================================================================", flush=True)
    print("  🇮🇳 Sanket AI — Production ISL 262-Class Model Training Pipeline ", flush=True)
    print("==================================================================", flush=True)
    print(f"Dataset Location : {args.dataset}", flush=True)
    print(f"Training Epochs  : {args.epochs}", flush=True)
    print(f"Batch Size       : {args.batch}", flush=True)
    print(f"Learning Rate    : {args.lr}", flush=True)
    print("------------------------------------------------------------------\n", flush=True)

    if not os.path.isdir(args.dataset):
        print(f"[Error] Dataset directory '{args.dataset}' does not exist!", flush=True)
        sys.exit(1)

    # 1. Train Model
    ckpt_path = os.path.join(os.path.dirname(__file__), "best_model.pth")
    train_model(
        dataset_dir=args.dataset,
        epochs=args.epochs,
        batch_size=args.batch,
        lr=args.lr,
        save_path=ckpt_path,
    )

    # 2. Export to Production ONNX
    output_onnx = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "public", "models", "isl_model.onnx")
    )
    output_labels = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "public", "models", "isl_labels.json")
    )
    export_to_onnx(
        checkpoint_path=ckpt_path,
        output_onnx_path=output_onnx,
        labels_output_path=output_labels,
    )

    print("\n==================================================================", flush=True)
    print("  🎉 COMPLETE: Production ONNX Model and Labels successfully built!", flush=True)
    print(f"  Model  : {output_onnx}", flush=True)
    print(f"  Labels : {output_labels}", flush=True)
    print("==================================================================", flush=True)


if __name__ == "__main__":
    try:
        main()
    except BaseException as e:
        print(f"\n[EXECUTION HALTED]: {e}", flush=True)
        traceback.print_exc()
