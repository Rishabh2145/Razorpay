from __future__ import annotations

import cv2
import numpy as np

from app.antispoof import model_status, spoof_probability
from app.replay import analyze_replay
from app.schemas import Challenge, ChallengeResult, SessionResult, SignalBreakdown
from app.sessions import expected_code
from app.texture import analyze_texture


def _decode(raw: bytes) -> np.ndarray | None:
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def _level(score: int) -> str:
    if score < 30:
        return "low"
    if score < 60:
        return "medium"
    return "high"


def _summary(score: int, reasons: list[str]) -> str:
    if score < 30:
        return (
            "Likely a live person in front of the camera. Residual risk remains "
            "because this demo does not detect sophisticated deepfakes."
        )
    if score < 60:
        return (
            "Mixed signals. A reviewer should treat this as elevated presentation-attack "
            "risk, not a confirmed spoof."
        )
    return reasons[0] if reasons else "High presentation-attack risk from liveness and replay checks."


def score_session(
    session_id: str,
    challenges: list[Challenge],
    challenge_results: list[ChallengeResult],
    frames: list[bytes],
    speech_transcript: str | None,
    face_lost_count: int,
    frozen_suspicion: bool,
) -> SessionResult:
    reasons: list[str] = []
    challenge_risk = 8
    failed = [r for r in challenge_results if not r.passed]
    if failed:
        challenge_risk += 12 * len(failed)
        for item in failed:
            reasons.append(f"Challenge failed: {item.detail}")
    else:
        reasons.append("All randomized liveness challenges were completed.")

    expected = expected_code(challenges)
    if expected and speech_transcript:
        digits = "".join(ch for ch in speech_transcript if ch.isdigit())
        if digits and digits != expected:
            challenge_risk += 10
            reasons.append(
                f"Spoken code did not match (heard {digits}, expected {expected})."
            )

    if face_lost_count > 40:
        challenge_risk += 12
        reasons.append("Face left the frame often during the check.")
    if frozen_suspicion:
        challenge_risk += 10
        reasons.append("Face landmarks looked frozen — possible still image.")

    challenge_risk = min(40, challenge_risk)

    replay_vals: list[float] = []
    texture_vals: list[float] = []
    spoof_vals: list[float] = []
    decoded = 0

    for raw in frames:
        image = _decode(raw)
        if image is None:
            continue
        decoded += 1
        replay = analyze_replay(image)
        texture = analyze_texture(image)
        replay_vals.append(replay["combined"])
        texture_vals.append(texture["print_like"])
        if replay["moire"] >= 0.55:
            reasons.append("Possible screen replay: periodic moiré in the face crop.")
        if replay["reflection"] >= 0.45:
            reasons.append("Strong specular highlights — possible screen glare or recapture.")
        if texture["print_like"] >= 0.55:
            reasons.append("Texture looks flatter than live skin (print or still image).")
        spoof = spoof_probability(image)
        if spoof is not None:
            spoof_vals.append(spoof)

    replay_mean = float(np.mean(replay_vals)) if replay_vals else 0.2
    texture_mean = float(np.mean(texture_vals)) if texture_vals else 0.15
    spoof_mean = float(np.mean(spoof_vals)) if spoof_vals else None

    replay_risk = int(round(replay_mean * 25))
    texture_risk = int(round(texture_mean * 15))
    if spoof_mean is None:
        antispoof_risk = 8
        if decoded == 0:
            reasons.append("No frames to run the anti-spoof model.")
        else:
            status = model_status()
            reasons.append(
                "Anti-spoof model unavailable"
                + (f" ({status})." if status else "; used heuristic fallback.")
            )
    else:
        antispoof_risk = int(round(spoof_mean * 30))
        if spoof_mean >= 0.25:
            reasons.append("Anti-spoof model: likely print or replay.")
        elif spoof_mean <= 0.15:
            reasons.append("Anti-spoof model: consistent with a live face.")
        else:
            reasons.append("Anti-spoof model: uncertain print/replay probability.")

    if decoded == 0:
        reasons.append("No usable frames were received, so visual replay checks are weak.")
        replay_risk = max(replay_risk, 10)
        texture_risk = max(texture_risk, 8)

    # Deduplicate reasons while keeping order.
    unique_reasons: list[str] = []
    for reason in reasons:
        if reason not in unique_reasons:
            unique_reasons.append(reason)

    total = int(np.clip(challenge_risk + replay_risk + texture_risk + antispoof_risk, 0, 100))
    level = _level(total)

    return SessionResult(
        session_id=session_id,
        risk_score=total,
        risk_level=level,  # type: ignore[arg-type]
        summary=_summary(total, unique_reasons),
        reasons=unique_reasons,
        breakdown=SignalBreakdown(
            challenges=challenge_risk,
            replay=replay_risk,
            texture=texture_risk,
            antispoof=antispoof_risk,
        ),
        challenge_results=challenge_results,
        antispoof_spoof_prob=None if spoof_mean is None else round(spoof_mean, 3),
        frames_analyzed=decoded,
    )
