"""
Interactive Sample Predictor for Sanket AI ISL Model
Tests both the PyTorch checkpoint and the exported ONNX model on any .parquet file.
Usage:
    python predict_sample.py --random
    python predict_sample.py --file "D:\\Matri\\Dataset\\hello\\MVI_0045.parquet"
"""

import os
import sys
import glob
import json
import random
import time
import argparse
import numpy as np
import torch

from dataset_loader import load_and_preprocess_parquet, find_dataset_dir, find_labels_file
from model import ISLSequenceClassifier

try:
    import onnxruntime as ort
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False


def predict(file_path=None, pick_random=False, use_onnx=True):
    dataset_dir = find_dataset_dir()
    labels_file = find_labels_file()

    with open(labels_file, "r", encoding="utf-8") as f:
        classes = json.load(f)
    num_classes = len(classes)

    # 1. Select Target File
    if pick_random or file_path is None:
        all_parquets = []
        for root, _, files in os.walk(dataset_dir):
            for file in files:
                if file.lower().endswith(".parquet"):
                    all_parquets.append(os.path.join(root, file))

        if not all_parquets:
            print(f"[Error] No parquet files found in {dataset_dir}!", flush=True)
            return

        file_path = random.choice(all_parquets)

    if not os.path.exists(file_path):
        print(f"[Error] Target file does not exist: {file_path}", flush=True)
        return

    # Extract ground truth label from parent folder name
    parent_word = os.path.basename(os.path.dirname(file_path)).lower().replace("_", "")
    print(f"\n==================================================", flush=True)
    print(f"🎯 Testing ISL Model on Sequence File", flush=True)
    print(f"==================================================", flush=True)
    print(f"File Path    : {file_path}", flush=True)
    print(f"Ground Truth : {parent_word.upper()}", flush=True)

    # 2. Extract 30-frame x 138-dim landmarks
    seq = load_and_preprocess_parquet(file_path)
    if seq is None:
        print("[Error] Failed to parse landmarks from file.", flush=True)
        return

    # 3. Run Inference
    onnx_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "models", "isl_model.onnx"))
    
    if use_onnx and HAS_ONNX and os.path.exists(onnx_path):
        print(f"Engine       : ONNX Runtime WebGL/CPU ({onnx_path})", flush=True)
        session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
        input_name = session.get_inputs()[0].name
        
        # Shape: (1, 30, 138)
        feed_input = np.expand_dims(seq, axis=0).astype(np.float32)
        
        t0 = time.perf_counter()
        outputs = session.run(None, {input_name: feed_input})
        latency_ms = (time.perf_counter() - t0) * 1000
        
        logits = outputs[0][0]
    else:
        # Fallback to PyTorch checkpoint
        ckpt_path = os.path.join(os.path.dirname(__file__), "best_model.pth")
        print(f"Engine       : PyTorch Checkpoint ({ckpt_path})", flush=True)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = ISLSequenceClassifier(input_dim=138, num_classes=num_classes).to(device)
        ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()

        tensor_input = torch.from_numpy(seq).unsqueeze(0).float().to(device)
        t0 = time.perf_counter()
        with torch.no_grad():
            out = model(tensor_input)
        latency_ms = (time.perf_counter() - t0) * 1000
        logits = out.squeeze(0).cpu().numpy()

    # 4. Softmax Probabilities
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / np.sum(exp_logits)

    # 5. Top 5 Ranked Predictions
    top5_indices = np.argsort(probs)[::-1][:5]

    top_pred_word = classes[top5_indices[0]].upper()
    top_pred_conf = probs[top5_indices[0]] * 100
    is_correct = (top_pred_word.lower().replace("_", "") == parent_word)

    result_badge = "✅ MATCH (CORRECT)" if is_correct else "⚠️ MISMATCH"
    print(f"\nInference Latency: {latency_ms:.2f} ms")
    print(f"Top-1 Prediction : {top_pred_word} ({top_pred_conf:.1f}%) ➔ {result_badge}")
    print(f"\n📊 Top-5 Ranked Candidates:")
    print("--------------------------------------------------")
    for rank, idx in enumerate(top5_indices, 1):
        c_name = classes[idx].upper()
        c_prob = probs[idx] * 100
        bar = "█" * int(c_prob / 3)
        marker = " 👈 (Target)" if c_name.lower().replace("_", "") == parent_word else ""
        print(f"  #{rank}  {c_name:<16} {c_prob:>5.1f}%  {bar}{marker}")
    print("--------------------------------------------------\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test ISL model predictions on a parquet take")
    parser.add_argument("--file", type=str, default=None, help="Path to a specific .parquet file")
    parser.add_argument("--random", action="store_true", help="Pick a random take from Dataset")
    args = parser.parse_args()

    predict(file_path=args.file, pick_random=args.random or (args.file is None))
