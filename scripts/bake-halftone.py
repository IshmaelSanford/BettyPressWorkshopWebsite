#!/usr/bin/env python3
"""
Pre-render the cow halftone effect to a video file for smooth playback.
Keep grid constants in sync with js/halftone-video.js.

Usage (from project root):
  pip install opencv-python numpy imageio-ffmpeg
  python scripts/bake-halftone.py
  python scripts/bake-halftone.py --input img/cow.mp4 --output img/cow-halftone.mp4
"""

from __future__ import annotations

import argparse
import math
import subprocess
import sys
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np

# Grid — match halftone-video.js
CELL_W = 6
CELL_H = 7
BAR_W = 6
ROW_OVERLAP = 2
DARKNESS_THRESHOLD = 0.07
DARKNESS_FULL = 0.30

BG_LUMINANCE = 0.72
BG_MIN_CHANNEL = 188
BG_COLOR_DISTANCE = 58
CELL_BG_RATIO = 0.34
CELL_AVG_LUMINANCE = 0.68

# Section palette (BGR for OpenCV)
BG_BGR = (112, 144, 164)  # #a49070
FG_BGR = (34, 38, 42)  # #2a2622

MAX_STAGE_W = 0.96
MAX_STAGE_H = 0.92
REF_VIEWPORT_W = 1200
REF_VIEWPORT_H = 900


def luminance(r: float, g: float, b: float) -> float:
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


def color_distance(r: float, g: float, b: float, ref: tuple[float, float, float]) -> float:
    dr, dg, db = r - ref[0], g - ref[1], b - ref[2]
    return math.sqrt(dr * dr + dg * dg + db * db)


def detect_background_color(frame: np.ndarray) -> tuple[float, float, float]:
    h, w = frame.shape[:2]
    points = [
        (2, 2),
        (w - 3, 2),
        (2, h - 3),
        (w - 3, h - 3),
        (w // 2, 2),
        (w // 2, h - 3),
        (2, h // 2),
        (w - 3, h // 2),
    ]
    samples = [frame[y, x, :3].astype(np.float32) for x, y in points]
    arr = np.mean(samples, axis=0)
    return float(arr[0]), float(arr[1]), float(arr[2])


def is_background(r: float, g: float, b: float, bg_ref: tuple[float, float, float]) -> bool:
    lum = luminance(r, g, b)
    min_ch = min(r, g, b)
    if lum >= BG_LUMINANCE:
        return True
    if min_ch >= BG_MIN_CHANNEL:
        return True
    if color_distance(r, g, b, bg_ref) <= BG_COLOR_DISTANCE and lum >= 0.58:
        return True
    return False


def bar_height(darkness: float) -> float:
    if darkness < DARKNESS_THRESHOLD:
        return 0.0
    if darkness >= DARKNESS_FULL:
        return CELL_H + ROW_OVERLAP * 2
    t = (darkness - DARKNESS_THRESHOLD) / (DARKNESS_FULL - DARKNESS_THRESHOLD)
    t = math.pow(t, 0.4)
    return CELL_H * (0.15 + t * 0.85) + ROW_OVERLAP


def analyze_cell(
    frame: np.ndarray,
    cell_x: int,
    cell_y: int,
    bg_ref: tuple[float, float, float],
) -> tuple[bool, float]:
    h, w = frame.shape[:2]
    bg_hits = 0
    lum_sum = 0.0
    count = 0
    max_lum = 0.0
    min_lum = 1.0

    y_end = min(cell_y + CELL_H, h)
    x_end = min(cell_x + CELL_W, w)

    for py in range(cell_y, y_end):
        for px in range(cell_x, x_end):
            b, g, r = frame[py, px, :3].astype(np.float32)
            lum = luminance(r, g, b)
            lum_sum += lum
            count += 1
            max_lum = max(max_lum, lum)
            min_lum = min(min_lum, lum)
            if is_background(r, g, b, bg_ref):
                bg_hits += 1

    if not count:
        return True, 0.0

    avg_lum = lum_sum / count
    bg_ratio = bg_hits / count
    skip = bg_ratio >= CELL_BG_RATIO or avg_lum >= CELL_AVG_LUMINANCE or max_lum >= 0.9
    darkness = 1.0 - (min_lum * 0.8 + avg_lum * 0.2)
    return skip, darkness


def compute_display_size(vw: int, vh: int) -> tuple[int, int]:
    max_w = REF_VIEWPORT_W * MAX_STAGE_W
    max_h = REF_VIEWPORT_H * MAX_STAGE_H
    w = max_w
    h = w * (vh / vw)
    if h > max_h:
        h = max_h
        w = h * (vw / vh)
    return max(1, int(w)), max(1, int(h))


def render_halftone_frame(small: np.ndarray) -> np.ndarray:
    h, w = small.shape[:2]
    out = np.full((h, w, 3), BG_BGR, dtype=np.uint8)
    bg_ref = detect_background_color(small)

    cols = w // CELL_W
    rows = h // CELL_H
    if cols == 0 or rows == 0:
        return out

    crop_h = rows * CELL_H
    crop_w = cols * CELL_W
    crop = small[:crop_h, :crop_w].astype(np.float32)
    b, g, r = crop[:, :, 0], crop[:, :, 1], crop[:, :, 2]
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
    min_ch = np.minimum(np.minimum(r, g), b)
    bg_dist = np.sqrt(
        (r - bg_ref[0]) ** 2 + (g - bg_ref[1]) ** 2 + (b - bg_ref[2]) ** 2
    )
    is_bg = (
        (lum >= BG_LUMINANCE)
        | (min_ch >= BG_MIN_CHANNEL)
        | ((bg_dist <= BG_COLOR_DISTANCE) & (lum >= 0.58))
    )

    lum_cells = lum.reshape(rows, CELL_H, cols, CELL_W)
    bg_cells = is_bg.reshape(rows, CELL_H, cols, CELL_W)

    bg_ratio = bg_cells.mean(axis=(1, 3))
    avg_lum = lum_cells.mean(axis=(1, 3))
    max_lum = lum_cells.max(axis=(1, 3))
    min_lum = lum_cells.min(axis=(1, 3))

    skip = (
        (bg_ratio >= CELL_BG_RATIO)
        | (avg_lum >= CELL_AVG_LUMINANCE)
        | (max_lum >= 0.9)
    )
    darkness = 1.0 - (min_lum * 0.8 + avg_lum * 0.2)

    for row in range(rows):
        cell_y = row * CELL_H
        for col in range(cols):
            if skip[row, col]:
                continue

            bar_h = int(round(bar_height(float(darkness[row, col]))))
            if bar_h <= 0:
                continue

            bar_x = col * CELL_W
            bar_y = max(0, cell_y - ROW_OVERLAP)
            bar_h = min(bar_h, h - bar_y)
            out[bar_y : bar_y + bar_h, bar_x : bar_x + BAR_W] = FG_BGR

    return out


def bake(input_path: Path, output_path: Path) -> None:
    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        raise SystemExit(f"Could not open video: {input_path}")

    vw = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    vh = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    out_w, out_h = compute_display_size(vw, vh)
    print(f"Input: {vw}x{vh} @ {fps:.1f} fps, {frame_count} frames")
    print(f"Output: {out_w}x{out_h} -> {output_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg,
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        f"{out_w}x{out_h}",
        "-r",
        f"{fps:.3f}",
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-crf",
        "22",
        str(output_path),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    index = 0
    report_every = max(1, frame_count // 20) if frame_count else 30
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        small = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_AREA)
        baked = render_halftone_frame(small)
        try:
            proc.stdin.write(baked.tobytes())
        except BrokenPipeError:
            break
        index += 1
        if index % report_every == 0 or index == frame_count:
            pct = (index / frame_count * 100) if frame_count else 0
            print(f"  {index}/{frame_count} frames ({pct:.0f}%)")

    cap.release()
    if proc.stdin:
        proc.stdin.close()
    stderr = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
    return_code = proc.wait()
    if return_code != 0:
        raise SystemExit(f"ffmpeg failed ({return_code}):\n{stderr[-2000:]}")

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"Done — {index} frames, {size_mb:.1f} MB")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Bake halftone video for the workshop site.")
    parser.add_argument("--input", type=Path, default=root / "img" / "cow.mp4")
    parser.add_argument("--output", type=Path, default=root / "img" / "cow-halftone.mp4")
    args = parser.parse_args()
    bake(args.input.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
