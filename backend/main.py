from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.antispoof import ensure_models, model_status


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        import numpy as np

        from app.antispoof import spoof_probability

        ensure_models()
        spoof_probability(np.zeros((160, 160, 3), dtype=np.uint8))
    except Exception:
        # Scoring still works with heuristics if weights cannot be fetched.
        pass
    yield


app = FastAPI(
    title="KYC Liveness & Replay Risk API",
    description=(
        "Liveness and presentation-attack scoring for merchant onboarding. "
        "This is not a production deepfake detector."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://kycriskanalyser.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "antispoof_error": model_status()}

