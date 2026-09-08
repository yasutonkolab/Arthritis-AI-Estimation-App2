#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
RA joint-inflammation inference API (Stage 4 of the pipeline, see PIPELINE.md).

Given the URL of a single hand photo (e.g. an image already uploaded to cloud
storage), this module downloads it, detects hand landmarks, crops the same 11
joint patches + 1 dorsum reference patch used during training
(app/prepare_real_dataset.py), runs the trained RGE-LA -> Dual-Path -> GNN model
(app/train_eval.py) and returns a JSON-serializable result: per-joint
probabilities/positive flags, the positive joint count, and an overall
hand-level RA-detected decision.

This file is self-contained: it re-implements the inference-only subset of the
model defined in app/train_eval.py (ResNet18 backbone only; no timm/Grad-CAM/CDA
training machinery), so it can be deployed on its own. The submodule names
below (joint_emb, rge, backbone, cbam, bridge_m/p, gnn_conv, classifier, ...)
intentionally match app/train_eval.py exactly, so a checkpoint produced by
`train_eval.py --save_ckpt` loads here with `strict=True`.

CLI usage
---------
  python serve.py --checkpoint model.pt --image-url https://example.com/hand.jpg
  python serve.py --checkpoint model.pt --image-url URL_LEFT URL_RIGHT   # both hands

Library usage
-------------
  from serve import RAScreeningService
  service = RAScreeningService.from_checkpoint("model.pt", device="cuda")
  result = service.predict_from_url("https://example.com/hand.jpg")
"""

import argparse
import io
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import requests
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision
import torchvision.transforms as T
from PIL import Image
from torch_geometric.data import Batch, Data
from torch_geometric.nn import GraphConv

import mediapipe as mp

# =========================================================
# Joint definitions (must match app/prepare_real_dataset.py / app/train_eval.py)
# =========================================================
NUM_JOINT_SLOTS = 16  # joint-id embedding table size (ids 1-15 used, 0 = padding)
VALID_JOINT_IDS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15}  # 9 finger joints + thumb IP + wrist

JOINT_NAMES = {
    1: "MCP1", 2: "MCP2", 3: "MCP3", 4: "MCP4", 5: "MCP5",
    6: "PIP2", 7: "PIP3", 8: "PIP4", 9: "PIP5",
    14: "IP1 (thumb)", 15: "Wrist",
}

# Mediapipe hand-landmark index -> joint id (see app/prepare_real_dataset.py)
KEYPOINT_TO_JOINT = {
    2: 1, 5: 2, 9: 3, 13: 4, 17: 5,
    6: 6, 10: 7, 14: 8, 18: 9,
    3: 14,
    0: 15,
}
JOINT_OFFSETS = {
    1: (0, 0), 2: (0, 0), 3: (0, 0), 4: (0, 0), 5: (0, 0),
    6: (0, 0), 7: (0, 0), 8: (0, 0), 9: (0, 0),
    14: (0, -3), 15: (0, 0),
}
JOINT_MARGIN_RATIO = {
    1: 0.06, 2: 0.065, 3: 0.065, 4: 0.055, 5: 0.055,
    6: 0.055, 7: 0.055, 8: 0.050, 9: 0.060,
    14: 0.055, 15: 0.275,
    16: 0.03,  # dorsum
}
DORSUM_JOINT_ID = 16
DORSUM_KPTS = [0, 5, 9, 13]
NORMALIZE_SIZE = 1024
MIN_SAFE_MARGIN = 16
SAFE_PAD = 12
MIN_SHRINK_RATIO = 0.70

# joint-adjacency graph: MCPs form a chain, each finger's MCP connects to its PIP
# (must match app/train_eval.py's _make_bidirectional_edge_index)
JOINT_ADJACENCY_EDGES = [
    [1, 2], [2, 3], [3, 4], [4, 5],
    [1, 14], [2, 6], [3, 7], [4, 8], [5, 9],
]


# =========================================================
# RGE-LA cue maps (redness / gloss / edge) -- identical to app/train_eval.py
# =========================================================
def _compute_redness(x01: torch.Tensor, dorsum01: Optional[torch.Tensor], edge: torch.Tensor) -> torch.Tensor:
    r, g, b = x01[:, 0:1], x01[:, 1:2], x01[:, 2:3]
    r_joint = r - torch.max(g, b)

    if dorsum01 is not None:
        r_d, g_d, b_d = dorsum01[:, 0:1], dorsum01[:, 1:2], dorsum01[:, 2:3]
        r_dorsum = r_d - torch.max(g_d, b_d)
        redness = torch.clamp(r_joint - r_dorsum, min=0)
    else:
        redness = torch.clamp(r_joint, min=0)

    edge_inv = 1.0 - edge
    redness = redness * edge_inv

    b_, c_, h_, w_ = redness.shape
    flat = redness.view(b_, -1).float()
    p5 = torch.quantile(flat, 0.05, dim=1, keepdim=True).unsqueeze(-1).unsqueeze(-1)
    p95 = torch.quantile(flat, 0.95, dim=1, keepdim=True).unsqueeze(-1).unsqueeze(-1)
    redness = (redness - p5.to(redness.dtype)) / (p95.to(redness.dtype) - p5.to(redness.dtype) + 1e-8)
    redness = redness.clamp(0, 1)
    return torch.pow(redness, 0.2).clamp(0, 1)


def _rgb_to_hsv_torch(x01: torch.Tensor) -> torch.Tensor:
    r, g, b = x01[:, 0], x01[:, 1], x01[:, 2]
    maxc, _ = torch.max(x01, dim=1)
    minc, _ = torch.min(x01, dim=1)
    v = maxc
    delt = maxc - minc + 1e-8
    s = delt / (maxc + 1e-8)

    rc, gc, bc = (maxc - r) / delt, (maxc - g) / delt, (maxc - b) / delt
    h = torch.zeros_like(maxc)
    mask = maxc == r
    h[mask] = (bc - gc)[mask]
    mask = maxc == g
    h[mask] = 2.0 + (rc - bc)[mask]
    mask = maxc == b
    h[mask] = 4.0 + (gc - rc)[mask]
    h = (h / 6.0) % 1.0
    return torch.stack([h, s, v], dim=1)


def _hsv_gloss(x01: torch.Tensor, edge: torch.Tensor) -> torch.Tensor:
    hsv = _rgb_to_hsv_torch(x01)
    s, v = hsv[:, 1:2], hsv[:, 2:3]
    gloss = (v * (1.0 - s)).clamp(0, 1)
    gloss = gloss * (1.0 - edge)

    b_, c_, h_, w_ = gloss.shape
    flat = gloss.view(b_, -1).float()
    p2 = torch.quantile(flat, 0.02, dim=1, keepdim=True).unsqueeze(-1).unsqueeze(-1)
    p98 = torch.quantile(flat, 0.98, dim=1, keepdim=True).unsqueeze(-1).unsqueeze(-1)
    gloss = (gloss - p2.to(gloss.dtype)) / (p98.to(gloss.dtype) - p2.to(gloss.dtype) + 1e-8)
    gloss = gloss.clamp(0, 1)
    return torch.pow(gloss, 0.5).clamp(0, 1)


def _sobel_edge(x01: torch.Tensor) -> torch.Tensor:
    gray = 0.2989 * x01[:, 0:1] + 0.5870 * x01[:, 1:2] + 0.1140 * x01[:, 2:3]
    kx = torch.tensor([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=x01.dtype, device=x01.device).view(1, 1, 3, 3)
    ky = torch.tensor([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=x01.dtype, device=x01.device).view(1, 1, 3, 3)
    gx = F.conv2d(gray, kx, padding=1)
    gy = F.conv2d(gray, ky, padding=1)
    mag = torch.sqrt(gx * gx + gy * gy + 1e-8)

    b_, c_, h_, w_ = mag.shape
    flat = mag.view(b_, -1).float()
    p95 = torch.quantile(flat, 0.95, dim=1, keepdim=True).unsqueeze(-1).unsqueeze(-1)
    mag = mag / (p95.to(mag.dtype) + 1e-8)
    return torch.pow(mag.clamp(0, 1), 0.5).clamp(0, 1)


class RGEExtractionModule(nn.Module):
    """Redness-Gloss-Edge Lesion Attention: 3 cue-specific branches, weighted sum."""

    def __init__(self, hidden: int = 16):
        super().__init__()

        def make_branch() -> nn.Sequential:
            return nn.Sequential(
                nn.Conv2d(3 + 1, hidden, kernel_size=3, padding=1, bias=False),
                nn.BatchNorm2d(hidden),
                nn.ReLU(inplace=True),
                nn.Conv2d(hidden, hidden, kernel_size=3, padding=1, bias=False),
                nn.BatchNorm2d(hidden),
                nn.ReLU(inplace=True),
                nn.Conv2d(hidden, 1, kernel_size=1, bias=True),
            )

        self.redness_branch = make_branch()
        self.gloss_branch = make_branch()
        self.edge_branch = make_branch()
        self.branch_weight_logits = nn.Parameter(torch.zeros(3))

    def forward(self, x: torch.Tensor, dorsum_tensor: Optional[torch.Tensor] = None) -> torch.Tensor:
        rgb01 = (x[:, :3] * 0.5 + 0.5).clamp(0, 1)
        dorsum01 = (dorsum_tensor * 0.5 + 0.5).clamp(0, 1) if dorsum_tensor is not None else None

        edge = _sobel_edge(rgb01)
        gloss = _hsv_gloss(rgb01, edge)
        red01 = _compute_redness(rgb01, dorsum01, edge)

        a_red = torch.sigmoid(self.redness_branch(torch.cat([rgb01, red01], dim=1)))
        a_gloss = torch.sigmoid(self.gloss_branch(torch.cat([rgb01, gloss], dim=1)))
        a_edge = torch.sigmoid(self.edge_branch(torch.cat([rgb01, edge], dim=1)))

        w = torch.softmax(self.branch_weight_logits, dim=0)
        return w[0] * a_red + w[1] * a_gloss + w[2] * a_edge


class ChannelAttention(nn.Module):
    def __init__(self, in_planes: int, ratio: int = 16):
        super().__init__()
        hid = max(1, in_planes // ratio)
        self.mlp = nn.Sequential(
            nn.Conv2d(in_planes, hid, kernel_size=1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(hid, in_planes, kernel_size=1, bias=False),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        avg = F.adaptive_avg_pool2d(x, 1)
        mx = F.adaptive_max_pool2d(x, 1)
        return torch.sigmoid(self.mlp(avg) + self.mlp(mx))


class SpatialAttention(nn.Module):
    def __init__(self, kernel_size: int = 7):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size=kernel_size, padding=(kernel_size - 1) // 2, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        avg = torch.mean(x, dim=1, keepdim=True)
        mx, _ = torch.max(x, dim=1, keepdim=True)
        return torch.sigmoid(self.conv(torch.cat([avg, mx], dim=1)))


class CBAM(nn.Module):
    def __init__(self, channels: int, ratio: int = 16, kernel_size: int = 7):
        super().__init__()
        self.ca = ChannelAttention(channels, ratio=ratio)
        self.sa = SpatialAttention(kernel_size=kernel_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x * self.ca(x)
        return x * self.sa(x)


class ResNet18FeatureExtractor(nn.Module):
    """
    Inference-only ResNet18 + RGE-LA (+ optional CBAM) feature extractor.
    Mirrors app/train_eval.py's SimpleResNet18FeatureExtractor for the
    resnet18-backbone configuration only (the one used for the reported model).
    """

    def __init__(self, use_cbam: bool, use_rge_module: bool, rge_scale: float,
                 embedding_dim: int = 32, num_joints: int = NUM_JOINT_SLOTS):
        super().__init__()
        self.num_joints = num_joints
        self.embedding_dim = embedding_dim
        self.use_cbam = use_cbam
        self.rge_scale = rge_scale

        self.joint_emb = nn.Embedding(num_joints, embedding_dim)
        self.rge = RGEExtractionModule() if use_rge_module else None
        self.in_proj = nn.Identity()  # kept for state_dict-name parity; input is always 3ch here

        backbone = torchvision.models.resnet18(weights=None)
        self.feat_dim = backbone.fc.in_features
        backbone.fc = nn.Identity()
        self.backbone = backbone
        self.cbam = CBAM(channels=512) if use_cbam else None
        self.out_dim = self.feat_dim + embedding_dim

    def forward(self, x: torch.Tensor, joint_ids: torch.Tensor,
                dorsum_tensor: Optional[torch.Tensor] = None) -> torch.Tensor:
        aj = self.rge(x, dorsum_tensor=dorsum_tensor) if self.rge is not None else None

        b = self.backbone
        z = b.maxpool(b.relu(b.bn1(b.conv1(x))))
        z = b.layer1(z)
        z2 = b.layer2(z)
        if aj is not None:
            a2 = F.interpolate(aj, size=z2.shape[-2:], mode="bilinear", align_corners=False)
            z2 = z2 * (1.0 + self.rge_scale * (a2 - 0.5))  # F_L2_tilde = F_L2 (x) (1 + scale*(a-0.5))
        z4 = b.layer4(b.layer3(z2))
        if self.cbam is not None:
            z4 = self.cbam(z4)

        feat = torch.flatten(b.avgpool(z4), 1)
        joint_ids = joint_ids.clamp_min(0).clamp_max(self.num_joints - 1)
        return torch.cat([feat, self.joint_emb(joint_ids)], dim=1)


class FeatureExtractorNoJoint(nn.Module):
    def __init__(self, base: ResNet18FeatureExtractor):
        super().__init__()
        self.base = base

    def forward(self, x, joint_ids, dorsum_tensor=None):
        joint_ids = torch.clamp(joint_ids.to(x.device), min=0, max=self.base.num_joints - 1).long()
        return self.base(x, joint_ids, dorsum_tensor=dorsum_tensor)


class DualPathGNNClassifier(nn.Module):
    """Morphology-Path (no CBAM) + Pathology-Path (CBAM) -> z^(0) -> GNN -> z^(1) -> logit."""

    def __init__(self, fe_m: FeatureExtractorNoJoint, fe_p: FeatureExtractorNoJoint,
                 gnn_hidden: int = 128, out_channels: int = 1, p_drop: float = 0.5,
                 bridge_hid: int = 256, bridge_out: int = 256):
        super().__init__()
        self.fe_m = fe_m
        self.fe_p = fe_p

        self.bridge_m = nn.Sequential(
            nn.Linear(fe_m.base.out_dim, bridge_hid), nn.ReLU(inplace=True),
            nn.Dropout(p_drop), nn.Linear(bridge_hid, bridge_out),
        )
        self.bridge_p = nn.Sequential(
            nn.Linear(fe_p.base.out_dim, bridge_hid), nn.ReLU(inplace=True),
            nn.Dropout(p_drop), nn.Linear(bridge_hid, bridge_out),
        )
        self.fuse_z0 = nn.Sequential(
            nn.Linear(2 * bridge_out, gnn_hidden), nn.ReLU(inplace=True), nn.Dropout(p_drop),
        )
        self.gnn_conv = GraphConv(gnn_hidden, gnn_hidden)
        self.classifier = nn.Sequential(
            nn.ReLU(inplace=True), nn.Dropout(p_drop), nn.Linear(gnn_hidden, out_channels),
        )

    def forward(self, batch: Data) -> torch.Tensor:
        dorsum_x = getattr(batch, "dorsum_x", None)
        fm = self.fe_m(batch.x, batch.joint_id, dorsum_tensor=dorsum_x)
        fp = self.fe_p(batch.x, batch.joint_id, dorsum_tensor=dorsum_x)
        z0 = self.fuse_z0(torch.cat([self.bridge_m(fm), self.bridge_p(fp)], dim=1))
        z1 = z0 + F.relu(self.gnn_conv(z0, batch.edge_index))
        return self.classifier(z1).view(-1)


def build_model(ckpt_extra: dict) -> DualPathGNNClassifier:
    use_cbam = bool(ckpt_extra.get("use_cbam", True))
    use_rge = bool(ckpt_extra.get("use_rge_module", True))
    rge_scale = float(ckpt_extra.get("rge_scale", 0.2))
    gnn_hidden = int(ckpt_extra.get("gnn_hidden", 128))
    gnn_dropout = float(ckpt_extra.get("gnn_dropout", 0.5))
    bridge_hid = int(ckpt_extra.get("bridge_hid", 256))
    bridge_out = int(ckpt_extra.get("bridge_out", 256))

    fe_m = FeatureExtractorNoJoint(ResNet18FeatureExtractor(use_cbam=False, use_rge_module=use_rge, rge_scale=rge_scale))
    fe_p = FeatureExtractorNoJoint(ResNet18FeatureExtractor(use_cbam=use_cbam, use_rge_module=use_rge, rge_scale=rge_scale))
    return DualPathGNNClassifier(
        fe_m, fe_p, gnn_hidden=gnn_hidden, p_drop=gnn_dropout,
        bridge_hid=bridge_hid, bridge_out=bridge_out,
    )


# =========================================================
# Image download + landmark-based joint/dorsum cropping
# (crop geometry mirrors app/prepare_real_dataset.py exactly)
# =========================================================
def download_image(url: str, timeout: float = 15.0) -> Image.Image:
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content)).convert("RGB")


def _normalize_image(img: Image.Image, target: int = NORMALIZE_SIZE):
    w, h = img.size
    scale = target / max(w, h)
    resized = img.resize((int(w * scale), int(h * scale)), Image.BICUBIC)
    pad_x, pad_y = (target - resized.width) // 2, (target - resized.height) // 2
    canvas = Image.new("RGB", (target, target), (0, 0, 0))
    canvas.paste(resized, (pad_x, pad_y))
    return canvas, scale, pad_x, pad_y


@dataclass
class JointCrop:
    joint_id: int
    image: Image.Image


@dataclass
class HandCrops:
    joints: List[JointCrop] = field(default_factory=list)
    dorsum: Optional[Image.Image] = None
    warnings: List[str] = field(default_factory=list)


class HandLandmarkCropper:
    """Runs Mediapipe Hands once and crops joint + dorsum patches from a single image."""

    def __init__(self, final_size: int = 256):
        self.final_size = final_size
        self._hands = mp.solutions.hands.Hands(
            static_image_mode=True, max_num_hands=1, min_detection_confidence=0.5
        )

    def close(self):
        self._hands.close()

    def crop(self, image: Image.Image) -> HandCrops:
        result = HandCrops()
        norm, scale, pad_x, pad_y = _normalize_image(image)
        norm_np = np.array(norm)

        detection = self._hands.process(norm_np)
        if not detection.multi_hand_landmarks:
            result.warnings.append("No hand detected in image.")
            return result

        landmarks = detection.multi_hand_landmarks[0].landmark
        norm_w, norm_h = norm.size
        coords: Dict[int, Tuple[int, int]] = {
            i: (int(lm.x * norm_w), int(lm.y * norm_h)) for i, lm in enumerate(landmarks)
        }

        for kpt, joint_id in KEYPOINT_TO_JOINT.items():
            if kpt not in coords:
                continue
            cx, cy = coords[kpt]
            ox, oy = JOINT_OFFSETS.get(joint_id, (0, 0))
            cx, cy = cx + ox, cy + oy

            default_r = int(NORMALIZE_SIZE * JOINT_MARGIN_RATIO[joint_id])
            other_dists = [
                max(abs(cx - px), abs(cy - py)) for i, (px, py) in coords.items() if i != kpt
            ] or [NORMALIZE_SIZE]
            tight_r = min(other_dists) - SAFE_PAD
            lower_bound = int(default_r * MIN_SHRINK_RATIO)
            margin = max(MIN_SAFE_MARGIN, max(lower_bound, min(default_r, tight_r)))

            xmin, xmax = max(0, cx - margin), min(norm_w, cx + margin)
            ymin, ymax = max(0, cy - margin), min(norm_h, cy + margin)
            if xmax <= xmin or ymax <= ymin:
                result.warnings.append(f"Joint {joint_id} ({JOINT_NAMES.get(joint_id)}) crop out of frame; skipped.")
                continue

            crop = norm.crop((xmin, ymin, xmax, ymax)).resize((self.final_size, self.final_size), Image.BICUBIC)
            result.joints.append(JointCrop(joint_id=joint_id, image=crop))

        if all(k in coords for k in DORSUM_KPTS):
            cx = int(np.mean([coords[k][0] for k in DORSUM_KPTS]))
            cy = int(np.mean([coords[k][1] for k in DORSUM_KPTS]))
            margin = int(NORMALIZE_SIZE * JOINT_MARGIN_RATIO[DORSUM_JOINT_ID])
            xmin, xmax = max(0, cx - margin), min(norm_w, cx + margin)
            ymin, ymax = max(0, cy - margin), min(norm_h, cy + margin)
            if xmax > xmin and ymax > ymin:
                result.dorsum = norm.crop((xmin, ymin, xmax, ymax)).resize(
                    (self.final_size, self.final_size), Image.BICUBIC
                )
        else:
            result.warnings.append("Dorsum reference patch unavailable (landmarks not detected); redness cue degraded.")

        missing = VALID_JOINT_IDS - {j.joint_id for j in result.joints}
        if missing:
            names = ", ".join(str(JOINT_NAMES.get(j, j)) for j in sorted(missing))
            result.warnings.append(f"Joints not detected/cropped: {names}")

        return result


def _make_bidirectional_edge_index(joint_ids: List[int]) -> torch.Tensor:
    edge_full = torch.tensor(JOINT_ADJACENCY_EDGES, dtype=torch.long).t().contiguous()
    edge_full = torch.cat([edge_full, edge_full.flip(0)], dim=1)
    node_of = {jid: idx for idx, jid in enumerate(joint_ids)}
    edges = [[node_of[u], node_of[v]] for u, v in edge_full.t().tolist() if u in node_of and v in node_of]
    if not edges:
        return torch.tensor([[0], [0]], dtype=torch.long)
    return torch.tensor(edges, dtype=torch.long).t().contiguous()


# =========================================================
# End-to-end service
# =========================================================
@dataclass
class JointResult:
    joint_id: int
    joint_name: str
    probability: float
    positive: bool


@dataclass
class HandResult:
    ra_detected: bool
    hand_probability: float
    num_positive_joints: int
    num_joints_detected: int
    joints: List[JointResult]
    warnings: List[str]

    def to_dict(self) -> dict:
        return {
            "ra_detected": self.ra_detected,
            "hand_probability": self.hand_probability,
            "num_positive_joints": self.num_positive_joints,
            "num_joints_detected": self.num_joints_detected,
            "joints": [j.__dict__ for j in self.joints],
            "warnings": self.warnings,
        }


def require_checkpoint_file(checkpoint_path: str) -> None:
    """Fail fast when the delivered weight file has not been placed locally."""
    path = Path(checkpoint_path)
    if not path.is_file():
        raise FileNotFoundError(
            f"Checkpoint not found: {path}. "
            "This .pt weight file is not stored in git. "
            "Copy the delivered ra_screening_model.pt to that path, then retry."
        )


class RAScreeningService:
    def __init__(self, model: DualPathGNNClassifier, thr_node: float, thr_hand: float,
                 img_size: int, device: str = "cpu"):
        self.model = model.to(device).eval()
        self.thr_node = thr_node
        self.thr_hand = thr_hand
        self.device = device
        self.to_tensor = T.Compose([
            T.Resize((img_size, img_size)),
            T.ToTensor(),
            T.Normalize([0.5] * 3, [0.5] * 3),
        ])
        self.cropper = HandLandmarkCropper(final_size=img_size)

    @classmethod
    def from_checkpoint(cls, checkpoint_path: str, device: str = "cpu") -> "RAScreeningService":
        require_checkpoint_file(checkpoint_path)
        ckpt = torch.load(checkpoint_path, map_location=device)
        extra = ckpt.get("extra", {})
        model = build_model(extra)
        model.load_state_dict(ckpt["model"], strict=True)
        return cls(
            model,
            thr_node=float(extra.get("thr_node", 0.5)),
            thr_hand=float(extra.get("thr_hand", 0.5)),
            img_size=int(extra.get("img_size", 256)),
            device=device,
        )

    def predict_from_image(self, image: Image.Image) -> HandResult:
        crops = self.cropper.crop(image)
        if not crops.joints:
            return HandResult(
                ra_detected=False, hand_probability=0.0,
                num_positive_joints=0, num_joints_detected=0,
                joints=[], warnings=crops.warnings,
            )

        joint_ids = [c.joint_id for c in crops.joints]
        x = torch.stack([self.to_tensor(c.image) for c in crops.joints], dim=0).to(self.device)
        dorsum_x = None
        if crops.dorsum is not None:
            dorsum_t = self.to_tensor(crops.dorsum).to(self.device)
            dorsum_x = dorsum_t.unsqueeze(0).repeat(x.size(0), 1, 1, 1)

        edge_index = _make_bidirectional_edge_index(joint_ids).to(self.device)
        data = Data(
            x=x,
            joint_id=torch.tensor(joint_ids, dtype=torch.long, device=self.device),
            edge_index=edge_index,
        )
        if dorsum_x is not None:
            data.dorsum_x = dorsum_x
        batch = Batch.from_data_list([data])

        with torch.no_grad():
            probs = torch.sigmoid(self.model(batch)).cpu().numpy().tolist()

        joint_results = [
            JointResult(
                joint_id=jid,
                joint_name=JOINT_NAMES.get(jid, str(jid)),
                probability=float(p),
                positive=bool(p >= self.thr_node),
            )
            for jid, p in zip(joint_ids, probs)
        ]
        hand_prob = max(probs) if probs else 0.0
        return HandResult(
            ra_detected=bool(hand_prob >= self.thr_hand),
            hand_probability=float(hand_prob),
            num_positive_joints=sum(1 for j in joint_results if j.positive),
            num_joints_detected=len(joint_results),
            joints=joint_results,
            warnings=crops.warnings,
        )

    def predict_from_url(self, url: str) -> dict:
        image = download_image(url)
        result = self.predict_from_image(image).to_dict()
        result["image_url"] = url
        return result

    def predict_from_urls(self, urls: List[str]) -> dict:
        hands = [self.predict_from_url(u) for u in urls]
        return {
            "hands": hands,
            "ra_detected": any(h["ra_detected"] for h in hands),
            "total_positive_joints": sum(h["num_positive_joints"] for h in hands),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="RA joint-inflammation inference from an image URL")
    parser.add_argument("--checkpoint", required=True, help="Path to a train_eval.py --save_ckpt checkpoint (.pt)")
    parser.add_argument("--image-url", nargs="+", required=True,
                         help="One image URL (one hand), or two (left + right)")
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    try:
        service = RAScreeningService.from_checkpoint(args.checkpoint, device=args.device)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
    if len(args.image_url) == 1:
        output = service.predict_from_url(args.image_url[0])
    else:
        output = service.predict_from_urls(args.image_url)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
