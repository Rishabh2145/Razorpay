from typing import Literal

from pydantic import BaseModel, Field

ChallengeType = Literal["blink", "turn_head", "say_digits"]
HeadDirection = Literal["left", "right"]
RiskLevel = Literal["low", "medium", "high"]


class Challenge(BaseModel):
    id: str
    type: ChallengeType
    prompt: str
    timeout_sec: int = 8
    blinks: int | None = None
    direction: HeadDirection | None = None
    code: str | None = None


class ChallengeResult(BaseModel):
    id: str
    type: ChallengeType
    passed: bool
    detail: str = ""
    duration_ms: int = 0


class SessionStart(BaseModel):
    session_id: str
    challenges: list[Challenge]


class CompletePayload(BaseModel):
    challenge_results: list[ChallengeResult]
    speech_transcript: str | None = None
    face_lost_count: int = 0
    frozen_suspicion: bool = False


class SignalBreakdown(BaseModel):
    challenges: int
    replay: int
    texture: int
    antispoof: int


class SessionResult(BaseModel):
    session_id: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    summary: str
    reasons: list[str]
    breakdown: SignalBreakdown
    challenge_results: list[ChallengeResult]
    antispoof_spoof_prob: float | None = None
    frames_analyzed: int = 0
