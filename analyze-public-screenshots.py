#!/usr/bin/env python3
"""Analyze public demo screenshots - compute diffs between neutral and other states."""
import os
import sys
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/cheaplive-vs-e-20260626-135100/public"

def load(fn):
    path = os.path.join(OUT, fn)
    if not os.path.exists(path):
        print(f"  MISSING: {fn}")
        return None
    return np.array(Image.open(path))

def diff_score(a, b):
    if a is None or b is None: return None
    if a.shape != b.shape:
        return None
    diff = np.abs(a.astype(int) - b.astype(int)).astype(np.uint8)
    mean_diff = diff.mean()
    gray = diff.max(axis=2) if diff.ndim == 3 else diff
    rows = np.any(gray > 10, axis=1)
    cols = np.any(gray > 10, axis=0)
    if rows.any() and cols.any():
        r1, r2 = np.where(rows)[0][[0, -1]]
        c1, c2 = np.where(cols)[0][[0, -1]]
        bbox_area = (r2 - r1 + 1) * (c2 - c1 + 1)
        total = gray.shape[0] * gray.shape[1]
        bbox_ratio = bbox_area / total
        changed_px = (gray > 10).sum()
        changed_ratio = changed_px / total
    else:
        bbox_ratio = 0
        changed_ratio = 0
    return mean_diff, changed_ratio, bbox_ratio

def avatar_region(img):
    h, w = img.shape[:2]
    cx, cy = w // 2, h // 2
    rw, rh = w * 0.6, h * 0.7
    x1 = max(0, int(cx - rw/2))
    x2 = min(w, int(cx + rw/2))
    y1 = max(0, int(cy - rh/2))
    y2 = min(h, int(cy + rh/2))
    return img[y1:y2, x1:x2]

tests = [
    ("10-neutral.png", "10-blink.png", "face", "blink"),
    ("10-neutral.png", "10-halfblink.png", "face", "halfblink"),
    ("10-neutral.png", "10-mouth.png", "face", "mouth"),
    ("10-neutral.png", "10-smile.png", "face", "smile"),
    ("10-neutral.png", "10-look_left.png", "face", "look_left"),
    ("10-neutral.png", "10-look_right.png", "face", "look_right"),
    ("10-neutral.png", "10-look_up.png", "face", "look_up"),
    ("10-neutral.png", "10-brow_raise.png", "face", "brow_raise"),
    ("10-neutral.png", "10-head_left.png", "face", "head_left"),
    ("10-neutral.png", "10-head_right.png", "face", "head_right"),
    ("20-idle.png", "20-paw_left.png", "pose", "paw_left"),
    ("20-idle.png", "20-paw_right.png", "pose", "paw_right"),
    ("20-idle.png", "20-lean_left.png", "pose", "lean_left"),
    ("20-idle.png", "20-lean_right.png", "pose", "lean_right"),
    ("20-idle.png", "20-crouch.png", "pose", "crouch"),
    ("20-idle.png", "20-jump.png", "pose", "jump"),
    ("20-idle.png", "20-tail_wag.png", "pose", "tail_wag"),
    ("20-idle.png", "20-bounce.png", "pose", "bounce"),
]

print(f"=== Public Demo Visual Diff Analysis (v5) ===")
print(f"OUT: {OUT}\n")

face_diffs = []
pose_diffs = []

print("Full-image diffs:")
for base, comp, category, name in tests:
    a = load(base)
    b = load(comp)
    result = diff_score(a, b)
    if result is None:
        print(f"  SKIP {name}: missing file")
        continue
    mean_diff, changed_ratio, bbox_ratio = result
    verdict = "PASS" if (changed_ratio > 0.02 and bbox_ratio > 0.01) else "FAIL"
    print(f"  [{verdict}] {category}/{name}: mean={mean_diff:.2f} changed={changed_ratio*100:.1f}% bbox={bbox_ratio*100:.1f}%")
    if category == "face":
        face_diffs.append((name, mean_diff, changed_ratio, bbox_ratio, verdict))
    else:
        pose_diffs.append((name, mean_diff, changed_ratio, bbox_ratio, verdict))

print("\nAvatar-region diffs:")
for base, comp, category, name in tests:
    a = load(base)
    b = load(comp)
    if a is None or b is None: continue
    a_crop = avatar_region(a)
    b_crop = avatar_region(b)
    result = diff_score(a_crop, b_crop)
    if result is None: continue
    mean_diff, changed_ratio, bbox_ratio = result
    verdict = "PASS" if (changed_ratio > 0.03 and bbox_ratio > 0.02) else "FAIL"
    print(f"  [{verdict}] {category}/{name}: mean={mean_diff:.2f} changed={changed_ratio*100:.1f}% bbox={bbox_ratio*100:.1f}%")

# Animal distinction
print("\nAnimal distinction (cat vs others):")
cat_n = load("01-cat-neutral.png")
animals = ["01-sacabambaspis-neutral.png", "01-dog-neutral.png",
           "01-rabbit-neutral.png", "01-fox-neutral.png", "01-bear-neutral.png"]
for an in animals:
    a = load(an)
    result = diff_score(cat_n, a)
    if result:
        mean_diff, changed_ratio, bbox_ratio = result
        name = an.replace("01-", "").replace("-neutral.png", "")
        print(f"  cat vs {name}: mean={mean_diff:.2f} changed={changed_ratio*100:.1f}%")

print("\n=== Summary ===")
print("Face (need PASS):")
for name, mean_diff, changed_ratio, bbox_ratio, verdict in face_diffs:
    print(f"  [{verdict}] {name}: mean={mean_diff:.2f} changed={changed_ratio*100:.1f}%")
print("Pose (need PASS):")
for name, mean_diff, changed_ratio, bbox_ratio, verdict in pose_diffs:
    print(f"  [{verdict}] {name}: mean={mean_diff:.2f} changed={changed_ratio*100:.1f}%")
