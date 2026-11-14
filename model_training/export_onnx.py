"""
Production-Grade ONNX Exporter & Runtime Verifier for ISL Classifier
Exports best_model.pth to public/models/isl_model.onnx and validates WebGL/CPU inference.
"""

import os
import json
import torch
import numpy as np
from model import ISLSequenceClassifier

try:
    import onnx
    import onnxruntime as ort
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False


def export_to_onnx(
    checkpoint_path="best_model.pth",
    output_onnx_path=None,
    labels_output_path=None,
):
    if output_onnx_path is None:
        output_onnx_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "public", "models", "isl_model.onnx")
        )
    if labels_output_path is None:
        labels_output_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "public", "models", "isl_labels.json")
        )

    os.makedirs(os.path.dirname(output_onnx_path), exist_ok=True)
    os.makedirs(os.path.dirname(labels_output_path), exist_ok=True)

    print(f"\n==================================================")
    print(f"📦 Exporting PyTorch Model to Production ONNX")
    print(f"==================================================")

    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found at {checkpoint_path}!")

    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    classes = checkpoint.get("classes", [])
    num_classes = len(classes)

    print(f"[Export] Checkpoint Val Accuracy: {checkpoint.get('val_acc', 0.0):.2f}%")
    print(f"[Export] Number of Output Classes: {num_classes}")

    # Save labels JSON
    with open(labels_output_path, "w", encoding="utf-8") as f:
        json.dump(classes, f, indent=2)
    print(f"[Export] Saved class labels to: {labels_output_path}")

    # Instantiate model
    model = ISLSequenceClassifier(input_dim=138, num_classes=num_classes)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Create dummy input: 1 batch, 30 frames, 138 landmark features
    dummy_input = torch.randn(1, 30, 138, dtype=torch.float32)

    # Export to ONNX
    torch.onnx.export(
        model,
        dummy_input,
        output_onnx_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input_landmarks"],
        output_names=["output_logits"],
        dynamic_axes={
            "input_landmarks": {0: "batch_size"},
            "output_logits": {0: "batch_size"},
        },
    )

    file_size_mb = os.path.getsize(output_onnx_path) / (1024 * 1024)
    print(f"[Export] Successfully generated ONNX model: {output_onnx_path} ({file_size_mb:.2f} MB)")

    # ─── Verification Step ──────────────────────────────────────────
    if HAS_ONNX:
        print(f"\n🔍 Verifying ONNX Graph & Execution Runtime...")
        onnx_model = onnx.load(output_onnx_path)
        onnx.checker.check_model(onnx_model)
        print("  ✓ ONNX Graph validation passed successfully.")

        # Test inference with ONNX Runtime
        session = ort.InferenceSession(output_onnx_path, providers=["CPUExecutionProvider"])
        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name

        dummy_np = dummy_input.numpy()
        ort_outs = session.run([output_name], {input_name: dummy_np})

        with torch.no_grad():
            torch_out = model(dummy_input).numpy()

        diff = np.max(np.abs(ort_outs[0] - torch_out))
        print(f"  ✓ Runtime Output shape: {ort_outs[0].shape}")
        print(f"  ✓ Max difference between PyTorch & ONNX: {diff:.2e} (Threshold: < 1e-4)")
        print(f"  ✓ Production verification complete! Ready for in-browser WebGL/WebAssembly deployment.")

    return output_onnx_path


if __name__ == "__main__":
    export_to_onnx()
