#!/usr/bin/env python3
"""Cropped avatar diff analysis using correct canvas position."""
import os, sys
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/cheaplive-vs-e-20260626-135100/public"

# Canvas is 360x360, CSS centered in 1280x900 viewport
# Canvas center: (640, 450), so left=460, right=820, top=270, bottom=630
CANVAS_L, CANVAS_R, CANVAS_T, CANVAS_B = 460, 820, 270, 630

def load_crop(fn):
    path = os.path.join(OUT, fn)
    if not os.path.exists(path):
        return None
    img = np.array(Image.open(path))
    # Crop to canvas region
    return img[CANVAS_T:CANVAS_B, CANVAS_L:CANVAS_R]

def diff_report(a, b, name):
    if a is None or b is None:
        print(f"  {name}: MISSING"); return None
    if a.shape != b.shape:
        print(f"  {name}: shape mismatch"); return None
    diff = np.abs(a.astype(int) - b.astype(int)).astype(np.uint8)
    mean_diff = diff.mean()
    gray = diff.max(axis=2) if diff.ndim == 3 else diff
    changed_px = (gray > 5).sum()
    total_px = gray.size
    changed_ratio = changed_px / total_px
    rows = np.any(gray > 5, axis=1)
    cols = np.any(gray > 5, axis=0)
    if rows.any() and cols.any():
        r1, r2 = np.where(rows)[0][[0,-1]]
        c1, c2 = np.where(cols)[0][[0,-1]]
        bbox_area = (r2-r1+1)*(c2-c1+1)
        bbox_ratio = bbox_area / total_px
    else:
        bbox_ratio = 0
    return mean_diff, changed_ratio, bbox_ratio

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

print(f"=== Avatar Canvas Diff Analysis (canvas={CANVAS_L}-{CANVAS_R}, {CANVAS_T}-{CANVAS_B}) ===\n")

results = []
for base, comp, category, name in tests:
    a = load_crop(base)
    b = load_crop(comp)
    r = diff_report(a, b, f"{category}/{name}")
    if r:
        mean_diff, changed_ratio, bbox_ratio = r
        is_pass = changed_ratio > 0.03 and bbox_ratio > 0.03
        verdict = "PASS" if is_pass else "FAIL"
        print(f"  [{verdict}] {category}/{name}: mean={mean_diff:.3f} changed={changed_ratio*100:.1f}% bbox={bbox_ratio*100:.1f}%")
        results.append((category, name, mean_diff, changed_ratio, bbox_ratio, verdict))

# Animal distinction
print("\nAnimal distinction:")
cat_n = load_crop("01-cat-neutral.png")
animals = ["01-sacabambaspis-neutral.png", "01-dog-neutral.png",
           "01-rabbit-neutral.png", "01-fox-neutral.png", "01-bear-neutral.png"]
for an in animals:
    a = load_crop(an)
    if cat_n is None or a is None: continue
    r = diff_report(cat_n, a, f"cat vs {an}")
    if r:
        mean_diff, changed_ratio, bbox_ratio = r
        nm = an.replace("01-","").replace("-neutral.png","")
        print(f"  cat vs {nm}: mean={mean_diff:.3f} changed={changed_ratio*100:.1f}%")

print("\n=== Summary ===")
face_results = [(n,m,c,b,v) for cat,n,m,c,b,v in results if cat=='face']
pose_results = [(n,m,c,b,v) for cat,n,m,c,b,v in results if cat=='pose']
for name, mean_diff, changed_ratio, bbox_ratio, verdict in face_results:
    print(f"  [{verdict}] face/{name}: changed={changed_ratio*100:.1f}%")
print()
for name, mean_diff, changed_ratio, bbox_ratio, verdict in pose_results:
    print(f"  [{verdict}] pose/{name}: changed={changed_ratio*100:.1f}%")
pass_face = sum(1 for _,_,_,_,v in face_results if v=='PASS')
pass_pose = sum(1 for _,_,_,_,v in pose_results if v=='PASS')
print(f"\nFace: {pass_face}/{len(face_results)} pass")
print(f"Pose: {pass_pose}/{len(pose_results)} pass")
