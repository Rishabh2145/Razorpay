from __future__ import annotations

import urllib.request
from pathlib import Path

import cv2
import numpy as np

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

# Official Silent-Face scales, converted ONNX from yakhyo/face-anti-spoofing.
MODELS = (
    {
        "name": "MiniFASNetV2.onnx",
        "scale": 2.7,
        "url": "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx",
    },
    {
        "name": "MiniFASNetV1SE.onnx",
        "scale": 4.0,
        "url": "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV1SE.onnx",
    },
)

_sessions: list[tuple[object, float]] | None = None
_load_error: str | None = None


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    with urllib.request.urlopen(url, timeout=60) as resp, tmp.open("wb") as out:
        out.write(resp.read())
    tmp.replace(dest)


def ensure_models() -> list[Path]:
    paths: list[Path] = []
    for spec in MODELS:
        path = MODELS_DIR / spec["name"]
        if not path.exists() or path.stat().st_size < 10_000:
            _download(spec["url"], path)
        paths.append(path)
    return paths


def _load() -> list[tuple[object, float]]:
    global _sessions, _load_error
    if _sessions is not None:
        return _sessions
    try:
        import onnxruntime as ort

        ensure_models()
        sessions: list[tuple[object, float]] = []
        for spec in MODELS:
            path = MODELS_DIR / spec["name"]
            sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
            sessions.append((sess, float(spec["scale"])))
        _sessions = sessions
        return sessions
    except Exception as exc:  # noqa: BLE001 — model is optional at runtime
        _load_error = str(exc)
        _sessions = []
        return _sessions


def detect_face(bgr: np.ndarray) -> tuple[int, int, int, int] | None:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = cascade.detectMultiScale(gray, 1.1, 4, minSize=(60, 60))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    return int(x), int(y), int(w), int(h)


def crop_scaled(bgr: np.ndarray, box: tuple[int, int, int, int], scale: float) -> np.ndarray:
    x, y, w, h = box
    cx = x + w / 2
    cy = y + h / 2
    nw = w * scale
    nh = h * scale
    x1 = int(round(cx - nw / 2))
    y1 = int(round(cy - nh / 2))
    x2 = int(round(cx + nw / 2))
    y2 = int(round(cy + nh / 2))
    ih, iw = bgr.shape[:2]
    pad_left = max(0, -x1)
    pad_top = max(0, -y1)
    pad_right = max(0, x2 - iw)
    pad_bottom = max(0, y2 - ih)
    crop = bgr[max(0, y1) : min(ih, y2), max(0, x1) : min(iw, x2)]
    if pad_left or pad_top or pad_right or pad_bottom:
        crop = cv2.copyMakeBorder(
            crop, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_CONSTANT
        )
    return crop


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    return exp / (exp.sum() + 1e-9)


def _predict(session: object, crop: np.ndarray) -> np.ndarray:
    resized = cv2.resize(crop, (80, 80))
    # Original Silent-Face pipeline: BGR, raw 0–255, NCHW.
    tensor = resized.astype(np.float32).transpose(2, 0, 1)[None, ...]
    input_name = session.get_inputs()[0].name  # type: ignore[attr-defined]
    raw = session.run(None, {input_name: tensor})[0]  # type: ignore[attr-defined]
    vec = np.squeeze(raw).astype(np.float32)
    if vec.ndim == 0:
        return np.array([1.0 - float(vec), float(vec)], dtype=np.float32)
    total = float(vec.sum())
    if 0.95 <= total <= 1.05 and np.all(vec >= -1e-4):
        return vec
    return _softmax(vec)


def spoof_probability(frame_bgr: np.ndarray) -> float | None:
    sessions = _load()
    if not sessions:
        return None
    box = detect_face(frame_bgr)
    if box is None:
        h, w = frame_bgr.shape[:2]
        side = min(h, w)
        box = ((w - side) // 2, (h - side) // 2, side, side)

    live_scores: list[float] = []
    for session, scale in sessions:
        crop = crop_scaled(frame_bgr, box, scale)
        if crop.size == 0:
            continue
        probs = _predict(session, crop)
        if probs.size >= 3:
            live_scores.append(float(probs[1]))
        elif probs.size == 2:
            live_scores.append(float(probs[1]))
        else:
            live_scores.append(float(probs[-1]))
    if not live_scores:
        return None
    live = float(np.mean(live_scores))
    return float(np.clip(1.0 - live, 0.0, 1.0))


def model_status() -> str | None:
    _load()
    return _load_error
