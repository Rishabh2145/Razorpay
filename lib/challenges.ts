import type { Challenge, ChallengeResult } from "./types";
import { BlinkCounter, headTurned, type FaceSignals } from "./face";
import { listenForDigits, speechSupported } from "./speech";

export interface ChallengeProgress {
  label: string;
  value: number;
  target: number;
}

export async function runChallenge(
  challenge: Challenge,
  opts: {
    getSignals: () => FaceSignals;
    onProgress: (progress: ChallengeProgress) => void;
    signal: AbortSignal;
  },
): Promise<ChallengeResult> {
  const started = performance.now();
  const timeoutMs = (challenge.timeout_sec || 8) * 1000;

  if (challenge.type === "blink") {
    return runBlink(challenge, opts, started, timeoutMs);
  }
  if (challenge.type === "turn_head") {
    return runHead(challenge, opts, started, timeoutMs);
  }
  return runSpeech(challenge, opts, started, timeoutMs);
}

function elapsed(started: number) {
  return Math.round(performance.now() - started);
}

function aborted(signal: AbortSignal) {
  return signal.aborted;
}

async function waitFrame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function runBlink(
  challenge: Challenge,
  opts: {
    getSignals: () => FaceSignals;
    onProgress: (progress: ChallengeProgress) => void;
    signal: AbortSignal;
  },
  started: number,
  timeoutMs: number,
): Promise<ChallengeResult> {
  const target = challenge.blinks ?? 2;
  const counter = new BlinkCounter();
  opts.onProgress({ label: "Blinks", value: 0, target });

  while (performance.now() - started < timeoutMs && !aborted(opts.signal)) {
    counter.update(opts.getSignals());
    opts.onProgress({ label: "Blinks", value: counter.count, target });
    if (counter.count >= target) {
      return {
        id: challenge.id,
        type: challenge.type,
        passed: true,
        detail: `Detected ${counter.count} blinks`,
        duration_ms: elapsed(started),
      };
    }
    await waitFrame();
  }

  return {
    id: challenge.id,
    type: challenge.type,
    passed: false,
    detail: `Detected ${counter.count}/${target} blinks`,
    duration_ms: elapsed(started),
  };
}

async function runHead(
  challenge: Challenge,
  opts: {
    getSignals: () => FaceSignals;
    onProgress: (progress: ChallengeProgress) => void;
    signal: AbortSignal;
  },
  started: number,
  timeoutMs: number,
): Promise<ChallengeResult> {
  const direction = challenge.direction ?? "left";
  opts.onProgress({ label: "Head turn", value: 0, target: 1 });

  while (performance.now() - started < timeoutMs && !aborted(opts.signal)) {
    const signals = opts.getSignals();
    if (headTurned(signals, direction)) {
      opts.onProgress({ label: "Head turn", value: 1, target: 1 });
      return {
        id: challenge.id,
        type: challenge.type,
        passed: true,
        detail: `Turned ${direction}`,
        duration_ms: elapsed(started),
      };
    }
    await waitFrame();
  }

  return {
    id: challenge.id,
    type: challenge.type,
    passed: false,
    detail: `Did not turn ${direction} in time`,
    duration_ms: elapsed(started),
  };
}

async function runSpeech(
  challenge: Challenge,
  opts: {
    getSignals: () => FaceSignals;
    onProgress: (progress: ChallengeProgress) => void;
    signal: AbortSignal;
  },
  started: number,
  timeoutMs: number,
): Promise<ChallengeResult> {
  const code = challenge.code ?? "";
  opts.onProgress({ label: "Spoken code", value: 0, target: 1 });

  if (!speechSupported()) {
    return {
      id: challenge.id,
      type: challenge.type,
      passed: false,
      detail: "Speech recognition is not available in this browser",
      duration_ms: elapsed(started),
    };
  }

  const remaining = Math.max(1000, timeoutMs - elapsed(started));
  const { transcript, matched } = await listenForDigits(code, remaining);
  opts.onProgress({ label: "Spoken code", value: matched ? 1 : 0, target: 1 });

  return {
    id: challenge.id,
    type: challenge.type,
    passed: matched,
    detail: matched
      ? `Heard ${transcript}`
      : `Heard "${transcript || "nothing"}", expected ${code.split("").join("-")}`,
    duration_ms: elapsed(started),
  };
}
