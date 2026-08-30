from __future__ import annotations

import cv2
import numpy as np


def _lbp_like(gray: np.ndarray) -> float:
    """Mean local contrast vs a 3x3 neighborhood — a cheap LBP-style texture cue."""
    small = cv2.resize(gray, (128, 128))
    center = small[1:-1, 1:-1].astype(np.float32)
    diffs = []
    for dy, dx in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
        neigh = small[1 + dy : 127 + dy, 1 + dx : 127 + dx].astype(np.float32)
        diffs.append(np.abs(neigh - center))
    return float(np.mean(diffs))


def analyze_texture(frame_bgr: np.ndarray) -> dict[str, float]:
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    if min(gray.shape) < 32:
        return {"laplacian_var": 0.0, "local_contrast": 0.0, "print_like": 0.0}
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    local = _lbp_like(gray)
    # Prints and phone-on-phone stills are flatter than live skin.
    print_like = 0.0
    if lap_var < 40:
        print_like += 0.55
    elif lap_var < 90:
        print_like += 0.25
    if local < 4.5:
        print_like += 0.45
    elif local < 7.0:
        print_like += 0.2
    return {
        "laplacian_var": lap_var,
        "local_contrast": local,
        "print_like": float(np.clip(print_like, 0.0, 1.0)),
    }
