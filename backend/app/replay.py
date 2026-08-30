from __future__ import annotations

import cv2
import numpy as np


def _face_or_center(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = cascade.detectMultiScale(gray, 1.1, 4, minSize=(80, 80))
    if len(faces) == 0:
        h, w = gray.shape
        side = min(h, w)
        x = (w - side) // 2
        y = (h - side) // 2
        return bgr[y : y + side, x : x + side]
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    pad = int(0.15 * max(w, h))
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(bgr.shape[1], x + w + pad)
    y2 = min(bgr.shape[0], y + h + pad)
    return bgr[y1:y2, x1:x2]


def moire_score(gray: np.ndarray) -> float:
    if gray.size == 0:
        return 0.0
    small = cv2.resize(gray, (256, 256))
    window = np.hanning(256)[:, None] * np.hanning(256)[None, :]
    spectrum = np.fft.fftshift(np.fft.fft2(small.astype(np.float32) * window))
    mag = np.log1p(np.abs(spectrum))
    y, x = np.ogrid[:256, :256]
    r = np.sqrt((x - 128) ** 2 + (y - 128) ** 2)
    low = mag[r < 12]
    band = mag[(r > 28) & (r < 90)]
    if low.size == 0 or band.size == 0:
        return 0.0
    ratio = float(band.mean() / (low.mean() + 1e-6))
    peakiness = float(band.max() / (band.mean() + 1e-6))
    score = (ratio - 0.35) * 1.4 + (peakiness - 4.5) * 0.08
    return float(np.clip(score, 0.0, 1.0))


def reflection_score(bgr: np.ndarray) -> float:
    if bgr.size == 0:
        return 0.0
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    value = hsv[:, :, 2]
    sat = hsv[:, :, 1]
    bright = float((value > 245).mean())
    saturated_bright = float(((value > 220) & (sat > 80)).mean())
    # Screen recaptures often have a few blown specular blobs.
    score = bright * 4.0 + saturated_bright * 2.5
    return float(np.clip(score, 0.0, 1.0))


def banding_score(gray: np.ndarray) -> float:
    if gray.size == 0:
        return 0.0
    small = cv2.resize(gray, (160, 160))
    row_diff = np.abs(np.diff(small.astype(np.float32), axis=0)).mean(axis=1)
    col_diff = np.abs(np.diff(small.astype(np.float32), axis=1)).mean(axis=0)
    row_peak = float(row_diff.std() / (row_diff.mean() + 1e-6))
    col_peak = float(col_diff.std() / (col_diff.mean() + 1e-6))
    score = max(row_peak, col_peak) / 8.0
    return float(np.clip(score, 0.0, 1.0))


def analyze_replay(frame_bgr: np.ndarray) -> dict[str, float]:
    crop = _face_or_center(frame_bgr)
    if crop.size == 0:
        return {"moire": 0.0, "reflection": 0.0, "banding": 0.0, "combined": 0.0}
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    moire = moire_score(gray)
    reflection = reflection_score(crop)
    banding = banding_score(gray)
    combined = float(np.clip(0.5 * moire + 0.3 * reflection + 0.2 * banding, 0.0, 1.0))
    return {
        "moire": moire,
        "reflection": reflection,
        "banding": banding,
        "combined": combined,
    }
