"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceLandmarker } from "@mediapipe/tasks-vision";

import { completeSession, startSession, uploadFrames } from "@/lib/api";
import { grabJpegFrame, startCamera, stopCamera } from "@/lib/camera";
import {
  runChallenge,
  type ChallengeProgress,
} from "@/lib/challenges";
import {
  createFaceLandmarker,
  detectVideoFrame,
  readFaceSignals,
  type FaceSignals,
} from "@/lib/face";
import type {
  Challenge,
  ChallengeResult,
  SessionResult,
} from "@/lib/types";

const RESULT_KEY = "kyc_result";

type Phase =
  | "boot"
  | "camera"
  | "tracker"
  | "ready"
  | "running"
  | "scoring"
  | "error";

export function KycSession() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  const signalsRef = useRef<FaceSignals>(readFaceSignals(null));
  const framesRef = useRef<Blob[]>([]);
  const faceLostRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const phaseRef = useRef<Phase>("boot");
  const uiTickRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("boot");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] =
    useState<ChallengeProgress | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [signals, setSignals] =
    useState<FaceSignals>(readFaceSignals(null));
  const [secondsLeft, setSecondsLeft] =
    useState<number | null>(null);

  /*
  
  * Keep the ref synchronized with React state.
  * The animation loop uses this ref so it always
  * sees the latest phase without being recreated.
    */
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /*
  
  * Boot the KYC session:
  * 1. Create backend session
  * 2. Start camera
  * 3. Load MediaPipe face tracker
       */
  useEffect(() => {
    let cancelled = false;


    async function boot() {



      try {
        setPhase("boot");

        const session = await startSession();

        if (cancelled) return;

        setSessionId(session.session_id);
        setChallenges(session.challenges);

        setPhase("camera");

        const video = videoRef.current;

        if (!video) {
          throw new Error("Video element missing");
        }

        streamRef.current = await startCamera(video);

        setPhase("tracker");

        const landmarker = await Promise.race([
          createFaceLandmarker(),

          new Promise<never>((_, reject) =>
            window.setTimeout(() => {
              reject(
                new Error(
                  "Face tracker timed out. Reload the page — the model is served from this app, not the backend."
                )
              );
            }, 25000)
          ),
        ]);

        if (cancelled) return;

        landmarkerRef.current = landmarker;

        setPhase("ready");
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error
            ? err.message
            : "Failed to start the check";

        setError(
          message.includes("Failed to fetch")
            ? "Cannot reach the scoring API on localhost:8000. Start the FastAPI backend."
            : message
        );

        setPhase("error");
      }
    }

    void boot();

    return () => {
      cancelled = true;

      abortRef.current?.abort();

      stopCamera(streamRef.current);

      streamRef.current = null;
    };


  }, []);

  /*
  
  * Face detection loop.
    */
  useEffect(() => {
    let raf = 0;


    const tick = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && landmarker) {
        const detection = detectVideoFrame(
          landmarker,
          video
        );

        if (detection) {
          const next = readFaceSignals(detection);
          const prev = signalsRef.current;

          signalsRef.current = next;

          const now = performance.now();

          /*
           * Avoid excessive React renders.
           */
          if (
            next.hasFace !== prev.hasFace ||
            now - uiTickRef.current > 150
          ) {
            uiTickRef.current = now;
            setSignals(next);
          }

          const currentPhase = phaseRef.current;

          if (
            !next.hasFace &&
            (currentPhase === "ready" ||
              currentPhase === "running")
          ) {
            faceLostRef.current += 1;
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
    };


  }, []);

  /*
  
  * Capture a JPEG frame from the video.
    */
  async function captureFrame() {
    const video = videoRef.current;


    if (!video) return;

    try {
      const blob = await grabJpegFrame(video);

      if (framesRef.current.length < 4) {
        framesRef.current.push(blob);
      }
    } catch {
      /*
       * Frame drop is not critical.
       */
    }


  }

  /*
  
  * Run all KYC challenges.
    */
  async function begin() {
    if (!sessionId || challenges.length === 0) return;


    setPhase("running");

    const collected: ChallengeResult[] = [];

    abortRef.current = new AbortController();

    const signal = abortRef.current.signal;

    let speechTranscript: string | undefined;

    await captureFrame();

    for (let i = 0; i < challenges.length; i++) {
      if (signal.aborted) return;

      setIndex(i);
      setProgress(null);

      const challenge = challenges[i];

      const endsAt =
        Date.now() + challenge.timeout_sec * 1000;

      setSecondsLeft(challenge.timeout_sec);

      const timer = window.setInterval(() => {
        setSecondsLeft(
          Math.max(
            0,
            Math.ceil(
              (endsAt - Date.now()) / 1000
            )
          )
        );
      }, 250);

      /*
       * Capture another frame during challenges.
       */
      if (i === 1) {
        await captureFrame();
      }

      const result = await runChallenge(challenge, {
        getSignals: () => signalsRef.current,
        onProgress: setProgress,
        signal,
      });

      window.clearInterval(timer);

      collected.push(result);

      setResults([...collected]);

      /*
       * Extract speech transcript.
       */
      if (challenge.type === "say_digits") {
        const heard = result.detail.match(
          /Heard "?([^",]+)"?/
        );

        if (heard) {
          speechTranscript = heard[1];
        }
      }
    }

    await captureFrame();

    setSecondsLeft(null);

    setPhase("scoring");

    try {
      /*
       * Send captured frames.
       */
      await uploadFrames(
        sessionId,
        framesRef.current
      );

      /*
       * Get final scoring result.
       */
      const outcome: SessionResult =
        await completeSession(sessionId, {
          challenge_results: collected,
          speech_transcript: speechTranscript,
          face_lost_count: faceLostRef.current,
        });

      sessionStorage.setItem(
        RESULT_KEY,
        JSON.stringify(outcome)
      );

      stopCamera(streamRef.current);

      router.push("/kyc/result");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Scoring failed"
      );

      setPhase("error");
    }


  }

  const current = challenges[index];

  const statusText =
    phase === "boot"
      ? "Creating secure verification session..."
      : phase === "camera"
        ? "Requesting camera and microphone access..."
        : phase === "tracker"
          ? "Loading face tracker..."
          : phase === "scoring"
            ? "Analyzing liveness and replay risk..."
            : phase === "error"
              ? error
              : phase === "ready"
                ? "Position your face inside the guide, then start."
                : current?.prompt;

  const challengeProgress =
    challenges.length > 0
      ? ((index + 1) / challenges.length) * 100
      : 0;

  return (<div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-background">
    {/* Background glow */} <div className="pointer-events-none absolute inset-0 overflow-hidden"> <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" /> <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" /> </div>


    {/* Header */}
    <header className="relative z-10 flex items-center justify-between border-b border-line bg-background/80 px-6 py-4 backdrop-blur">
      <div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>

          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            Live verification
          </p>
        </div>

        <h1 className="mt-1 text-lg font-semibold">
          Liveness &amp; replay risk check
        </h1>
      </div>

      <div className="text-right">
        <p className="text-xs text-muted">
          Secure session
        </p>

        <p className="mt-1 font-mono text-xs text-foreground">
          {sessionId
            ? `#${sessionId.slice(0, 8)}`
            : "Connecting..."}
        </p>
      </div>
    </header>

    {/* Main */}
    <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:py-10">
      {/* Camera */}
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-black shadow-2xl">
          <video
            ref={videoRef}
            className="h-full min-h-[380px] w-full object-cover sm:min-h-[520px]"
            style={{
              transform: "scaleX(-1)",
            }}
            playsInline
            muted
          />

          {/* Camera overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

          {/* Face guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`h-[55%] w-[45%] rounded-[50%] border-2 transition-all duration-500 ${signals.hasFace
                  ? "scale-100 border-accent"
                  : "scale-95 border-white/30"
                }`}
            />
          </div>

          {/* Top indicators */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-5">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur ${signals.hasFace
                  ? "border-accent/30 bg-accent/15 text-accent"
                  : "border-white/10 bg-black/40 text-white/70"
                }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${signals.hasFace
                    ? "animate-pulse bg-accent"
                    : "bg-red-400"
                  }`}
              />

              {signals.hasFace
                ? "Face detected"
                : "Looking for face"}
            </div>

            {phase === "running" &&
              secondsLeft !== null && (
                <div className="rounded-full border border-white/10 bg-black/50 px-4 py-2 font-mono text-sm text-white backdrop-blur">
                  {secondsLeft}s
                </div>
              )}
          </div>

          {/* Bottom camera status */}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/50">
                    Current status
                  </p>

                  <p className="mt-1 text-sm font-medium text-white sm:text-base">
                    {statusText}
                  </p>
                </div>

                {phase === "running" && (
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-white/50">
                      Progress
                    </p>

                    <p className="mt-1 font-mono text-sm text-accent">
                      {index + 1}/{challenges.length}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Camera statistics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-line bg-card/70 p-3 text-center">
            <p className="text-xs text-muted">
              Camera
            </p>

            <p className="mt-1 text-sm font-medium">
              {phase === "camera"
                ? "Starting..."
                : phase === "boot"
                  ? "Waiting"
                  : "Ready"}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-card/70 p-3 text-center">
            <p className="text-xs text-muted">
              Face
            </p>

            <p
              className={`mt-1 text-sm font-medium ${signals.hasFace
                  ? "text-accent"
                  : "text-muted"
                }`}
            >
              {signals.hasFace
                ? "Detected"
                : "Not found"}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-card/70 p-3 text-center">
            <p className="text-xs text-muted">
              Frames
            </p>

            <p className="mt-1 text-sm font-medium">
              {framesRef.current.length}/4
            </p>
          </div>
        </div>
      </section>

      {/* Right panel */}
      <aside className="flex w-full flex-col gap-4 lg:w-[340px]">
        {/* Main challenge card */}
        <div className="rounded-3xl border border-line bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
              {phase === "running"
                ? `Challenge ${index + 1} of ${challenges.length}`
                : "Verification status"}
            </p>

            {phase === "running" && (
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                LIVE
              </span>
            )}
          </div>

          {/* Progress */}
          {phase === "running" &&
            challenges.length > 0 && (
              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-lg font-bold text-accent">
                  {index + 1}
                </div>

                <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{
                      width: `${challengeProgress}%`,
                    }}
                  />
                </div>
              </div>
            )}

          <p className="mt-5 text-xl font-semibold leading-8">
            {statusText}
          </p>

          {/* Challenge progress */}
          {progress && (
            <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  {progress.label}
                </span>

                <span className="font-mono font-medium text-accent">
                  {progress.value}/{progress.target}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (progress.value /
                        progress.target) *
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Start */}
          {phase === "ready" && (
            <button
              type="button"
              onClick={() => void begin()}
              className="group mt-6 inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-accent text-sm font-semibold text-accent-dim transition duration-300 hover:scale-[1.02] hover:brightness-110 active:scale-95"
            >
              Start challenges

              <span className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </button>
          )}

          {/* Loading */}
          {(phase === "boot" ||
            phase === "camera" ||
            phase === "tracker") && (
              <div className="mt-6 flex items-center justify-center gap-3 rounded-full border border-line bg-background px-4 py-3 text-sm text-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                Preparing verification...
              </div>
            )}

          {/* Scoring */}
          {phase === "scoring" && (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-full bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              Analyzing liveness signals...
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <a
              href="/kyc"
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full border border-line text-sm font-medium transition hover:bg-card"
            >
              Try again
            </a>
          )}
        </div>

        {/* Challenge steps */}
        <div className="rounded-3xl border border-line bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold">
              Verification steps
            </p>

            <span className="text-xs text-muted">
              {results.length}/{challenges.length}
            </span>
          </div>

          <ol className="space-y-3">
            {challenges.map((challenge, i) => {
              const done = results.find(
                (result) =>
                  result.id === challenge.id
              );

              const active =
                phase === "running" &&
                i === index;

              return (
                <li
                  key={challenge.id}
                  className={`flex gap-3 rounded-2xl border p-3 transition-all ${active
                      ? "border-accent/40 bg-accent/5"
                      : done
                        ? "border-line bg-background/50"
                        : "border-line bg-background/20 opacity-70"
                    }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done
                        ? done.passed
                          ? "bg-accent/15 text-accent"
                          : "bg-red-500/10 text-red-400"
                        : active
                          ? "bg-accent text-accent-dim"
                          : "bg-card text-muted"
                      }`}
                  >
                    {done
                      ? done.passed
                        ? "✓"
                        : "!"
                      : i + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm leading-5 ${active
                          ? "font-medium"
                          : "text-muted"
                        }`}
                    >
                      {challenge.prompt}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      {done
                        ? done.passed
                          ? "Completed successfully"
                          : "Challenge failed"
                        : active
                          ? "In progress..."
                          : "Waiting"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Privacy */}
        <div className="rounded-2xl border border-line bg-card/50 p-4 text-xs leading-5 text-muted">
          <p className="font-medium text-foreground">
            Privacy note
          </p>

          <p className="mt-1">
            Camera processing runs in your browser.
            Selected frames and verification signals are
            sent to the configured scoring service.
          </p>
        </div>
      </aside>
    </main>
  </div>


  );
}

export { RESULT_KEY };
