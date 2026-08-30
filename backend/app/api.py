from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import CompletePayload, SessionResult, SessionStart
from app.scorer import score_session
from app.sessions import align_results, store

router = APIRouter(prefix="/api")


@router.post("/sessions", response_model=SessionStart)
def create_session() -> SessionStart:
    session = store.create()
    return SessionStart(session_id=session.id, challenges=session.challenges)


@router.post("/sessions/{session_id}/frames")
async def upload_frames(session_id: str, files: list[UploadFile] = File(...)) -> dict:
    payloads: list[bytes] = []
    for upload in files:
        payloads.append(await upload.read())
    session = store.add_frames(session_id, payloads)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "stored_frames": len(session.frames)}


@router.post("/sessions/{session_id}/complete", response_model=SessionResult)
def complete(session_id: str, payload: CompletePayload) -> SessionResult:
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    results = align_results(session.challenges, payload.challenge_results)
    scored = score_session(
        session_id=session.id,
        challenges=session.challenges,
        challenge_results=results,
        frames=session.frames,
        speech_transcript=payload.speech_transcript,
        face_lost_count=payload.face_lost_count,
        frozen_suspicion=payload.frozen_suspicion,
    )
    session.result = scored
    return scored


@router.get("/sessions/{session_id}", response_model=SessionResult)
def get_session(session_id: str) -> SessionResult:
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.result is None:
        raise HTTPException(status_code=409, detail="Session has not been scored yet")
    return session.result
