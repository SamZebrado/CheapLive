#!/usr/bin/env python3
"""Debug: find canvas bounds in full-page screenshot."""
import numpy as np
from PIL import Image
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/cheaplive-vs-e-20260626-135100/public"
img = np.array(Image.open(f"{OUT}/10-neutral.png"))
print(f"Full image shape: {img.shape}")  # (height, width, channels)

h, w = img.shape[:2]
# Canvas is 360x360, CSS centered
# Viewport is 1280x900
# Canvas center: (640, 450)
# Canvas bounds: left=460, right=820, top=270, bottom=630
canvas_l = 460
canvas_r = 820
canvas_t = 270
canvas_b = 630

crop = img[canvas_t:canvas_b, canvas_l:canvas_r]
print(f"Cropped canvas shape: {crop.shape}")

# Check if cropped area has non-background content
# The avatar should be on a dark background
bg = img[:50, :, :].mean()
content_mean = crop.mean()
print(f"Background avg: {bg:.1f}")
print(f"Crop avg: {content_mean:.1f}")

# Find actual content bounds
gray = crop.mean(axis=2)
diff_from_bg = np.abs(gray.astype(float) - bg)
content = diff_from_bg > 5
if content.any():
    rows = np.any(content, axis=1)
    cols = np.any(content, axis=0)
    r1, r2 = np.where(rows)[0][[0, -1]]
    c1, c2 = np.where(cols)[0][[0, -1]]
    print(f"Content bounds in crop: rows {r1}-{r2}, cols {c1}-{c2}")
    print(f"Content pct: {content.sum() / content.size * 100:.1f}%")
else:
    print("NO content found in expected canvas area!")

# Try finding where the avatar is by scanning for non-background pixels
print("\nSearching for avatar region (non-background)...")
threshold = bg + 10
for y in range(0, h - 100, 20):
    row_mean = img[y:y+20, :, :].mean()
    if row_mean > threshold + 5:
        print(f"  y={y}: mean={row_mean:.1f} (background={bg:.1f})")
