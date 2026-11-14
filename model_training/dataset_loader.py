r"""
Production-Grade ISL Parquet Dataset Loader & Ultra-Fast In-Memory Sequence Cache
Extracts 30-frame normalized 3D spatio-temporal landmark feature sequences from D:\Matri\Dataset.
"""

import os
import glob
import json
import math
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset
from scipy.interpolate import interp1d
from tqdm import tqdm

FEATURE_DIM = 138
SEQUENCE_LENGTH = 30  # 30 frames = 1.0 second at 30 fps


def find_dataset_dir():
    candidates = [
        r"D:\Matri\Dataset",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Dataset")),
        os.path.abspath("./Dataset"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return r"D:\Matri\Dataset"


def find_labels_file():
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "models", "isl_labels.json")),
        os.path.abspath("./public/models/isl_labels.json"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def dist3d(a, b):
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    dz = a[2] - b[2]
    d = math.sqrt(dx * dx + dy * dy + dz * dz)
    return 0.0 if (math.isnan(d) or math.isinf(d)) else d


def extract_frame_feature_vector(frame_data):
    """
    Constructs a 138-dimensional scale- & position-invariant feature vector for one frame.
    Strictly guaranteed to contain ZERO NaNs.
    """
    feat = np.zeros(FEATURE_DIM, dtype=np.float32)

    # 1. Pose landmarks: 0: Nose, 11: Left Shoulder, 12: Right Shoulder
    pose = frame_data.get("pose", {})
    nose = pose.get(0, [0.5, 0.2, 0.0])
    l_sh = pose.get(11, [0.4, 0.4, 0.0])
    r_sh = pose.get(12, [0.6, 0.4, 0.0])
    neck = [(l_sh[0] + r_sh[0]) / 2.0, (l_sh[1] + r_sh[1]) / 2.0, (l_sh[2] + r_sh[2]) / 2.0]

    shoulder_width = dist3d(l_sh, r_sh)
    if shoulder_width < 0.05 or math.isnan(shoulder_width):
        shoulder_width = 0.25

    # 12 Pose features: relative to neck, normalized by shoulder width
    pose_pts = [nose, l_sh, r_sh, neck]
    for i, pt in enumerate(pose_pts):
        feat[i * 3 + 0] = (pt[0] - neck[0]) / shoulder_width
        feat[i * 3 + 1] = (pt[1] - neck[1]) / shoulder_width
        feat[i * 3 + 2] = (pt[2] - neck[2]) / shoulder_width

    # 2. Right Hand (63 features: indices 12 to 74)
    rh = frame_data.get("right_hand", {})
    if 0 in rh:
        wrist = rh[0]
        palm_scale = dist3d(wrist, rh.get(9, [wrist[0], wrist[1] - 0.1, wrist[2]]))
        if palm_scale < 0.03 or math.isnan(palm_scale):
            palm_scale = 0.12

        for j in range(21):
            joint = rh.get(j, wrist)
            feat[12 + j * 3 + 0] = (joint[0] - wrist[0]) / palm_scale
            feat[12 + j * 3 + 1] = (joint[1] - wrist[1]) / palm_scale
            feat[12 + j * 3 + 2] = (joint[2] - wrist[2]) / palm_scale

    # 3. Left Hand (63 features: indices 75 to 137)
    lh = frame_data.get("left_hand", {})
    if 0 in lh:
        wrist = lh[0]
        palm_scale = dist3d(wrist, lh.get(9, [wrist[0], wrist[1] - 0.1, wrist[2]]))
        if palm_scale < 0.03 or math.isnan(palm_scale):
            palm_scale = 0.12

        for j in range(21):
            joint = lh.get(j, wrist)
            feat[75 + j * 3 + 0] = (joint[0] - wrist[0]) / palm_scale
            feat[75 + j * 3 + 1] = (joint[1] - wrist[1]) / palm_scale
            feat[75 + j * 3 + 2] = (joint[2] - wrist[2]) / palm_scale

    feat = np.nan_to_num(feat, nan=0.0, posinf=0.0, neginf=0.0)
    return feat


def resample_sequence(sequence, target_len=SEQUENCE_LENGTH):
    """
    Resamples variable length sequence to fixed 30 frames using stable linear interpolation.
    """
    sequence = np.nan_to_num(sequence, nan=0.0, posinf=0.0, neginf=0.0)
    n_frames = len(sequence)
    if n_frames == target_len:
        return sequence.astype(np.float32)

    if n_frames < 2:
        return np.repeat(sequence, target_len, axis=0).astype(np.float32)

    orig_x = np.linspace(0, 1, n_frames)
    target_x = np.linspace(0, 1, target_len)
    interp_func = interp1d(orig_x, sequence, axis=0, kind="linear", fill_value="extrapolate")
    resampled = interp_func(target_x).astype(np.float32)
    return np.nan_to_num(resampled, nan=0.0, posinf=0.0, neginf=0.0)


def load_and_preprocess_parquet(file_path):
    """
    Fast vectorized Pandas parquet parser into fixed 30-frame x 138-dim feature array.
    Zero NaNs guaranteed.
    """
    try:
        df = pd.read_parquet(file_path, columns=["frame", "type", "landmark_index", "x", "y", "z"])
    except Exception:
        try:
            df = pd.read_parquet(file_path)
        except Exception:
            return None

    if df.empty:
        return None

    frames = {}
    try:
        f_arr = df["frame"].to_numpy()
        t_arr = df["type"].astype(str).str.lower().to_numpy()
        lm_arr = df["landmark_index"].to_numpy()
        xs = np.nan_to_num(df["x"].to_numpy(dtype=np.float32), nan=0.0)
        ys = np.nan_to_num(df["y"].to_numpy(dtype=np.float32), nan=0.0)
        zs = np.nan_to_num(df["z"].to_numpy(dtype=np.float32), nan=0.0)

        n_rows = len(f_arr)
        for i in range(n_rows):
            f_idx = int(f_arr[i])
            if f_idx not in frames:
                frames[f_idx] = {"pose": {}, "left_hand": {}, "right_hand": {}}
            t_str = t_arr[i]
            lm_i = int(lm_arr[i])
            pt = [float(xs[i]), float(ys[i]), float(zs[i])]
            if "pose" in t_str:
                frames[f_idx]["pose"][lm_i] = pt
            elif "left" in t_str:
                frames[f_idx]["left_hand"][lm_i] = pt
            elif "right" in t_str:
                frames[f_idx]["right_hand"][lm_i] = pt
    except Exception:
        return None

    if not frames:
        return None

    sorted_indices = sorted(frames.keys())
    raw_seq = np.array([extract_frame_feature_vector(frames[f]) for f in sorted_indices], dtype=np.float32)
    raw_seq = np.nan_to_num(raw_seq, nan=0.0, posinf=0.0, neginf=0.0)
    return resample_sequence(raw_seq, target_len=SEQUENCE_LENGTH)


def augment_sequence(seq):
    """
    Data augmentation for sequence arrays with NaN protection.
    """
    augmented = seq.copy()

    # 1. Temporal Speed Scaling (+- 15%)
    speed_factor = np.random.uniform(0.85, 1.15)
    t_len = seq.shape[0]
    scaled_indices = np.linspace(0, t_len - 1, int(t_len * speed_factor))
    scaled_indices = np.clip(scaled_indices, 0, t_len - 1)
    orig_indices = np.arange(t_len)
    interp = interp1d(orig_indices, seq, axis=0, kind="linear", fill_value="extrapolate")
    augmented = interp(np.linspace(0, t_len - 1, t_len))

    # 2. Random Spatial Scale (+- 10%)
    scale = np.random.uniform(0.90, 1.10)
    augmented = augmented * scale

    # 3. Gaussian Jitter
    jitter = np.random.normal(0, 0.008, augmented.shape).astype(np.float32)
    augmented = augmented + jitter

    # 4. Mirroring (Swap left/right hands and negate x)
    if np.random.rand() < 0.30:
        rh_part = augmented[:, 12:75].copy()
        lh_part = augmented[:, 75:138].copy()
        augmented[:, 12:75] = lh_part
        augmented[:, 75:138] = rh_part
        augmented[:, 0::3] = -augmented[:, 0::3]

    augmented = np.nan_to_num(augmented, nan=0.0, posinf=0.0, neginf=0.0)
    return np.clip(augmented, -10.0, 10.0).astype(np.float32)


class ISLParquetDataset(Dataset):
    def __init__(self, dataset_dir=None, is_train=True, augment=True, labels_path=None):
        self.dataset_dir = dataset_dir or find_dataset_dir()
        self.is_train = is_train
        self.augment = augment and is_train

        cache_path = os.path.join(os.path.dirname(__file__), "cached_dataset.pt")

        # 1. Load ground truth classes
        lbl_file = labels_path or find_labels_file()
        if lbl_file and os.path.exists(lbl_file):
            with open(lbl_file, "r", encoding="utf-8") as f:
                self.classes = json.load(f)
            print(f"[Dataset] Loaded {len(self.classes)} ground-truth vocabulary classes from {lbl_file}", flush=True)
        else:
            discovered = set()
            for root, _, files in os.walk(self.dataset_dir):
                if any(f.lower().endswith(".parquet") for f in files):
                    word_name = os.path.basename(root).lower().replace("_", "")
                    discovered.add(word_name)
            self.classes = sorted(list(discovered))
            print(f"[Dataset] Discovered {len(self.classes)} classes from {self.dataset_dir}", flush=True)

        self.class_to_idx = {c.lower().replace("_", ""): i for i, c in enumerate(self.classes)}

        # 2. Check persistent cache
        if os.path.exists(cache_path):
            print(f"[Dataset] ⚡ Found existing cache: {cache_path}", flush=True)
            print(f"[Dataset] Loading cached features into RAM in ~0.5s...", flush=True)
            cached_data = torch.load(cache_path, map_location="cpu", weights_only=False)
            self.cached_features = cached_data["features"]
            self.cached_labels = cached_data["labels"]
            valid_feats = []
            valid_labels = []
            for f, l in zip(self.cached_features, self.cached_labels):
                clean_f = np.nan_to_num(f, nan=0.0, posinf=0.0, neginf=0.0)
                clean_f = np.clip(clean_f, -10.0, 10.0)
                valid_feats.append(clean_f)
                valid_labels.append(l)
            self.cached_features = valid_feats
            self.cached_labels = valid_labels
            print(f"✓ Loaded {len(self.cached_features)} clean sequences across {len(self.classes)} classes from disk cache!\n", flush=True)
            return

        # 3. Parse dataset parquets
        raw_samples = []
        for root, _, files in os.walk(self.dataset_dir):
            for file in files:
                if file.lower().endswith(".parquet"):
                    full_path = os.path.join(root, file)
                    parent_word = os.path.basename(root).lower().replace("_", "")
                    if parent_word in self.class_to_idx:
                        raw_samples.append((full_path, self.class_to_idx[parent_word]))

        print(f"[Dataset] Found {len(raw_samples)} parquet files matching target vocabulary.", flush=True)
        print(f"[Dataset] Pre-processing {len(raw_samples)} files into RAM...", flush=True)

        self.cached_features = []
        self.cached_labels = []

        with tqdm(total=len(raw_samples), desc="Pre-caching Parquets", unit="it") as pbar:
            for fpath, label_idx in raw_samples:
                feat = load_and_preprocess_parquet(fpath)
                if feat is not None:
                    feat = np.nan_to_num(feat, nan=0.0, posinf=0.0, neginf=0.0)
                    feat = np.clip(feat, -10.0, 10.0)
                    self.cached_features.append(feat)
                    self.cached_labels.append(label_idx)
                pbar.update(1)

        print(f"✓ Cached {len(self.cached_features)} valid sequences across {len(self.classes)} classes in RAM!", flush=True)

        try:
            torch.save({
                "features": self.cached_features,
                "labels": self.cached_labels,
                "classes": self.classes,
            }, cache_path)
            print(f"💾 Saved persistent dataset cache to: {cache_path}", flush=True)
        except Exception as e:
            print(f"Note: Could not write cache file: {e}", flush=True)

    def __len__(self):
        return len(self.cached_features)

    def __getitem__(self, idx):
        seq = self.cached_features[idx]
        label = self.cached_labels[idx]

        if self.augment:
            seq = augment_sequence(seq)

        tensor_seq = torch.from_numpy(seq).float()
        tensor_label = torch.tensor(label, dtype=torch.long)
        return tensor_seq, tensor_label
