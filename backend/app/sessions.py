from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from app.schemas import Challenge, ChallengeResult, SessionResult


@dataclass
class Session:
    id: str
    challenges: list[Challenge]
    frames: list[bytes] = field(default_factory=list)
    result: SessionResult | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class SessionStore:
    def __init__(self, ttl_minutes: int = 30) -> None:
        self._sessions: dict[str, Session] = {}
        self._ttl = timedelta(minutes=ttl_minutes)

    def _purge(self) -> None:
        now = datetime.now(timezone.utc)
        expired = [k for k, s in self._sessions.items() if now - s.created_at > self._ttl]
        for key in expired:
            del self._sessions[key]

    def create(self) -> Session:
        self._purge()
        session = Session(id=str(uuid.uuid4()), challenges=make_challenges())
        self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> Session | None:
        self._purge()
        return self._sessions.get(session_id)

    def add_frames(self, session_id: str, frames: list[bytes]) -> Session | None:
        session = self.get(session_id)
        if session is None:
            return None
        room = max(0, 6 - len(session.frames))
        session.frames.extend(frames[:room])
        return session


store = SessionStore()


def make_challenges() -> list[Challenge]:
    blinks = random.choice([2, 3])
    direction = random.choice(["left", "right"])
    digits = [str(random.randint(0, 9)) for _ in range(4)]
    code = "".join(digits)
    spoken = "-".join(digits)

    challenges = [
        Challenge(
            id=str(uuid.uuid4()),
            type="blink",
            prompt=f"Blink {blinks} times",
            timeout_sec=8,
            blinks=blinks,
        ),
        Challenge(
            id=str(uuid.uuid4()),
            type="turn_head",
            prompt=f"Turn your head to the {direction}",
            timeout_sec=8,
            direction=direction,
        ),
        Challenge(
            id=str(uuid.uuid4()),
            type="say_digits",
            prompt=f"Say {spoken}",
            timeout_sec=10,
            code=code,
        ),
    ]
    random.shuffle(challenges)
    return challenges


def expected_code(challenges: list[Challenge]) -> str | None:
    for challenge in challenges:
        if challenge.type == "say_digits":
            return challenge.code
    return None


def align_results(
    challenges: list[Challenge], incoming: list[ChallengeResult]
) -> list[ChallengeResult]:
    by_id = {item.id: item for item in incoming}
    aligned: list[ChallengeResult] = []
    for challenge in challenges:
        existing = by_id.get(challenge.id)
        if existing:
            aligned.append(existing)
        else:
            aligned.append(
                ChallengeResult(
                    id=challenge.id,
                    type=challenge.type,
                    passed=False,
                    detail="Challenge result missing",
                )
            )
    return aligned
