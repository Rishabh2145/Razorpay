import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

const MODEL_URL = "/models/face_landmarker.task";
const WASM_URL = "/mediapipe";

const BLINK_ON = 0.42;
const BLINK_OFF = 0.22;
const YAW_THRESHOLD = 18;

export interface FaceSignals {
  hasFace: boolean;
  blinkLeft: number;
  blinkRight: number;
  bothClosed: boolean;
  yaw: number;
  pitch: number;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
let lastVideoTs = -1;

function muteMediaPipeLogs<T>(fn: () => T): T {
  const { log, info, debug, warn } = console;
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
  try {
    return fn();
  } finally {
    console.log = log;
    console.info = info;
    console.debug = debug;
    console.warn = warn;
  }
}

function warmupOnBlankCanvas(landmarker: FaceLandmarker) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  muteMediaPipeLogs(() => landmarker.detect(canvas));
}

async function loadLandmarker(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const shared = {
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  };

  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    ...shared,
    runningMode: "IMAGE",
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
  });

  // First inference creates the XNNPACK delegate and prints C++ INFO lines.
  // Do that here so Next.js does not treat detectForVideo as a runtime error.
  warmupOnBlankCanvas(landmarker);
  await landmarker.setOptions({ runningMode: "VIDEO" });
  lastVideoTs = -1;
  return landmarker;
}

export function createFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = loadLandmarker().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

export function detectVideoFrame(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
): FaceLandmarkerResult | null {
  if (video.readyState < 2 || video.videoWidth < 16 || video.videoHeight < 16) {
    return null;
  }
  const ts = Math.max(performance.now(), lastVideoTs + 1);
  lastVideoTs = ts;
  try {
    return muteMediaPipeLogs(() => landmarker.detectForVideo(video, ts));
  } catch {
    return null;
  }
}

function blendScore(result: FaceLandmarkerResult, name: string): number {
  const cats = result.faceBlendshapes[0]?.categories ?? [];
  return cats.find((c) => c.categoryName === name)?.score ?? 0;
}

function yawFromLandmarks(result: FaceLandmarkerResult): number {
  const lm = result.faceLandmarks[0];
  if (!lm) return 0;
  const left = lm[33];
  const right = lm[263];
  const nose = lm[1];
  if (!left || !right || !nose) return 0;
  const midX = (left.x + right.x) / 2;
  const width = Math.abs(right.x - left.x);
  if (width < 1e-5) return 0;
  return ((midX - nose.x) / width) * 90;
}

function pitchFromLandmarks(result: FaceLandmarkerResult): number {
  const lm = result.faceLandmarks[0];
  if (!lm) return 0;
  const forehead = lm[10];
  const chin = lm[152];
  const nose = lm[1];
  if (!forehead || !chin || !nose) return 0;
  const midY = (forehead.y + chin.y) / 2;
  const height = Math.abs(chin.y - forehead.y);
  if (height < 1e-5) return 0;
  return ((nose.y - midY) / height) * 90;
}

export function readFaceSignals(
  result: FaceLandmarkerResult | null,
): FaceSignals {
  if (!result || result.faceLandmarks.length === 0) {
    return {
      hasFace: false,
      blinkLeft: 0,
      blinkRight: 0,
      bothClosed: false,
      yaw: 0,
      pitch: 0,
    };
  }
  const blinkLeft = blendScore(result, "eyeBlinkLeft");
  const blinkRight = blendScore(result, "eyeBlinkRight");
  return {
    hasFace: true,
    blinkLeft,
    blinkRight,
    bothClosed: blinkLeft > BLINK_ON && blinkRight > BLINK_ON,
    yaw: yawFromLandmarks(result),
    pitch: pitchFromLandmarks(result),
  };
}

export class BlinkCounter {
  private closed = false;
  count = 0;

  update(signals: FaceSignals) {
    if (!signals.hasFace) return;
    const avg = (signals.blinkLeft + signals.blinkRight) / 2;
    if (!this.closed && avg > BLINK_ON) {
      this.closed = true;
    } else if (this.closed && avg < BLINK_OFF) {
      this.closed = false;
      this.count += 1;
    }
  }

  reset() {
    this.closed = false;
    this.count = 0;
  }
}

export function headTurned(
  signals: FaceSignals,
  direction: "left" | "right",
): boolean {
  if (!signals.hasFace) return false;

  if (direction === "left") {
    return signals.yaw <= -YAW_THRESHOLD;
  }

  return signals.yaw >= YAW_THRESHOLD;
}

export { YAW_THRESHOLD };
