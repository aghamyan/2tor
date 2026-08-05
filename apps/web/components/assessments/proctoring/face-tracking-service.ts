"use client";

import {
  classifyHeadDirection,
  headPoseFromColumnMajor4x4,
  type HeadDirection,
} from "../../../../../packages/domain/assessments/head-pose";
import type { AssessmentEventType } from "../../../../../packages/domain/assessments/models";
import type { ProctoringMetadata } from "./signal-bus";

export interface FaceTrackingHandle {
  stop: () => void;
}

export type FaceTrackingSignalHandler = (
  eventType: AssessmentEventType,
  metadata: ProctoringMetadata | null,
) => void;

/** Normalized [0,1] box relative to the source video frame, top-left origin — see `startFaceTracking`. */
export interface FaceTrackingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A per-tick snapshot for a live monitoring console (not gated by grace periods or cooldowns, so
 * it can flicker where the debounced `onSignal` events deliberately don't) — see the "primary"
 * face's pose is whichever face MediaPipe lists first, generally the largest/most centered.
 */
export interface FaceTrackingFrame {
  faceCount: number;
  faces: readonly FaceTrackingBox[];
  yawDeg: number | null;
  pitchDeg: number | null;
  headDirection: HeadDirection | null;
  gazeDirection: "center" | "left" | "right" | null;
}

export type FaceTrackingFrameHandler = (frame: FaceTrackingFrame) => void;

function landmarksBoundingBox(landmarks: readonly { x: number; y: number }[]): FaceTrackingBox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

const DETECTION_INTERVAL_MS = 250; // ~4Hz: enough to catch sustained state, light on CPU/battery.
const FACE_MISSING_GRACE_MS = 4_000; // tolerates looking down to write or brief occlusion.
const MULTIPLE_FACES_GRACE_MS = 1_500;
const GAZE_AWAY_YAW_THRESHOLD_DEG = 25;
const GAZE_AWAY_GRACE_MS = 4_000;
// A brief down-and-to-a-side glance is what checking a phone/notes on the desk looks like; a
// centered, sustained downward tilt is normal handwriting posture and stays exempt (spec §11).
const GLANCE_PITCH_THRESHOLD_DEG = -15;
const GLANCE_YAW_THRESHOLD_DEG = 15;
const GLANCE_WINDOW_MS = 45_000;
const GLANCE_COUNT_THRESHOLD = 4;
const EXTERNAL_DEVICE_COOLDOWN_MS = 60_000;
// A normal blink is ~100-400ms and MediaPipe's eyeBlinkLeft/Right blendshapes also spike on a
// heavily angled or partly-occluded face — a short sustain would flag constantly on nothing.
// Requiring several seconds and both eyes together is deliberately conservative; see suspicion.ts
// for why this signal carries zero score weight until it's been tuned against real footage.
const EYES_CLOSED_BLINK_THRESHOLD = 0.65;
const EYES_CLOSED_SUSTAIN_MS = 6_000;
const EYES_CLOSED_COOLDOWN_MS = 60_000;

// Self-hosted from apps/web/public/mediapipe/ (see scripts/prepare-mediapipe-assets.mjs) rather
// than fetched from a third-party CDN at exam time. A CDN dependency here is a single point of
// failure a student can't work around — any network policy, firewall, or ad-blocker that blocks
// cdn.jsdelivr.net or storage.googleapis.com takes down proctoring for that student. Same-origin
// assets also mean nothing about the exam session is ever requested from a third party.
const WASM_BASE = "/mediapipe/wasm";
const MODEL_URL = "/mediapipe/face_landmarker.task";

let modulePromise: Promise<typeof import("@mediapipe/tasks-vision")> | null = null;
function loadMediaPipe() {
  modulePromise ??= import("@mediapipe/tasks-vision");
  return modulePromise;
}

// MediaPipe's WASM runtime writes plain stderr (including harmless "INFO:"-level startup lines
// like delegate creation) through console.error, which shows up as a red error in Next's dev
// overlay and in any console.error-based monitoring. Filter only lines with that INFO prefix, and
// only for the duration of the MediaPipe call that can emit them — a real error raised in that
// same window has no such prefix and still gets through.
function isBenignWasmInfoLog(args: unknown[]): boolean {
  return typeof args[0] === "string" && args[0].startsWith("INFO:");
}

function withWasmInfoLogsSuppressed<T>(fn: () => T): T {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (!isBenignWasmInfoLog(args)) originalError(...args);
  };
  try {
    return fn();
  } finally {
    console.error = originalError;
  }
}

async function withWasmInfoLogsSuppressedAsync<T>(fn: () => Promise<T>): Promise<T> {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (!isBenignWasmInfoLog(args)) originalError(...args);
  };
  try {
    return await fn();
  } finally {
    console.error = originalError;
  }
}

/**
 * Client-side-only face presence/count/gaze tracking (spec §2, §12, §13). Every frame is
 * processed on-device via WASM; no image or video ever leaves the browser, nothing is stored —
 * see packages/domain/assessments/README.md "Camera boundary". Degrades to a no-op handle (never
 * throws) when the model or WASM runtime fails to load, per the spec's graceful-degradation rule.
 */
export async function startFaceTracking(
  video: HTMLVideoElement,
  onSignal: FaceTrackingSignalHandler,
  onCapabilityUnavailable?: (reason: string) => void,
  onFrame?: FaceTrackingFrameHandler,
): Promise<FaceTrackingHandle> {
  let landmarker: Awaited<ReturnType<typeof import("@mediapipe/tasks-vision").FaceLandmarker.createFromOptions>> | null =
    null;
  try {
    const { FaceLandmarker, FilesetResolver } = await loadMediaPipe();
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const commonOptions = {
      runningMode: "VIDEO" as const,
      numFaces: 2,
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: true,
    };
    try {
      // GPU is faster but needs a WebGL context; that's unavailable in a lot of real-world
      // setups (VMs, remote desktops, disabled hardware acceleration, some Linux GPU drivers).
      landmarker = await withWasmInfoLogsSuppressedAsync(() =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          ...commonOptions,
        }),
      );
    } catch (gpuError) {
      console.warn("[assessments] Face tracking: GPU delegate failed, retrying on CPU.", gpuError);
      landmarker = await withWasmInfoLogsSuppressedAsync(() =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          ...commonOptions,
        }),
      );
    }
  } catch (error) {
    console.warn("[assessments] Face tracking unavailable; falling back to camera-presence-only.", error);
    onCapabilityUnavailable?.(error instanceof Error ? error.message : "unknown");
    return { stop: () => {} };
  }

  let stopped = false;
  let faceVisible = true; // optimistic until the first frame says otherwise
  let faceMissingSince: number | null = null;
  let multipleFacesSince: number | null = null;
  let gazeAwaySince: number | null = null;
  let lastGazeDirection: "left" | "right" | null = null;
  const glanceTimestamps: number[] = [];
  let lastExternalDeviceFlagAt = 0;
  let eyesClosedSince: number | null = null;
  let lastEyesClosedFlagAt = 0;

  function tick() {
    if (stopped || !landmarker || video.readyState < video.HAVE_CURRENT_DATA) return;
    const now = performance.now();
    let result: ReturnType<typeof landmarker.detectForVideo>;
    try {
      result = landmarker.detectForVideo(video, now);
    } catch {
      return; // a single malformed frame during camera warm-up shouldn't tear down the session
    }

    const faceCount = result.faceLandmarks.length;

    if (faceCount === 0) {
      faceMissingSince ??= now;
      if (faceVisible && now - faceMissingSince >= FACE_MISSING_GRACE_MS) {
        faceVisible = false;
        onSignal("face_missing", null);
      }
    } else {
      if (!faceVisible) onSignal("face_returned", null);
      faceVisible = true;
      faceMissingSince = null;
    }

    if (faceCount >= 2) {
      if (multipleFacesSince === null) {
        multipleFacesSince = now;
      } else if (now - multipleFacesSince >= MULTIPLE_FACES_GRACE_MS) {
        onSignal("multiple_faces", { faceCount });
        multipleFacesSince = now; // re-arm: a sustained extra face keeps flagging, not just once
      }
    } else {
      multipleFacesSince = null;
    }

    const blendshapes = result.faceBlendshapes[0]?.categories;
    const eyeBlinkLeft = blendshapes?.find((item) => item.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const eyeBlinkRight = blendshapes?.find((item) => item.categoryName === "eyeBlinkRight")?.score ?? 0;
    const eyesClosedNow =
      faceCount === 1 &&
      eyeBlinkLeft >= EYES_CLOSED_BLINK_THRESHOLD &&
      eyeBlinkRight >= EYES_CLOSED_BLINK_THRESHOLD;
    if (eyesClosedNow) {
      eyesClosedSince ??= now;
      if (
        now - eyesClosedSince >= EYES_CLOSED_SUSTAIN_MS &&
        now - lastEyesClosedFlagAt >= EYES_CLOSED_COOLDOWN_MS
      ) {
        lastEyesClosedFlagAt = now;
        onSignal("eyes_closed", null);
      }
    } else {
      eyesClosedSince = null;
    }

    const matrix = result.facialTransformationMatrixes[0]?.data;
    const pose =
      faceCount >= 1 && matrix && matrix.length === 16 ? headPoseFromColumnMajor4x4(matrix) : null;

    onFrame?.({
      faceCount,
      faces: result.faceLandmarks.map(landmarksBoundingBox),
      yawDeg: pose?.yawDeg ?? null,
      pitchDeg: pose?.pitchDeg ?? null,
      headDirection: pose ? classifyHeadDirection(pose.yawDeg, pose.pitchDeg) : null,
      gazeDirection: pose
        ? Math.abs(pose.yawDeg) < GAZE_AWAY_YAW_THRESHOLD_DEG
          ? "center"
          : pose.yawDeg > 0
            ? "left"
            : "right"
        : null,
    });

    if (faceCount === 1 && pose) {
      const { yawDeg, pitchDeg } = pose;

      if (Math.abs(yawDeg) >= GAZE_AWAY_YAW_THRESHOLD_DEG) {
        const direction: "left" | "right" = yawDeg > 0 ? "left" : "right";
        gazeAwaySince ??= now;
        if (now - gazeAwaySince >= GAZE_AWAY_GRACE_MS && lastGazeDirection !== direction) {
          onSignal("gaze_away", { direction, yawDeg: Math.round(yawDeg) });
          lastGazeDirection = direction;
        }
      } else {
        gazeAwaySince = null;
        lastGazeDirection = null;
      }

      if (pitchDeg <= GLANCE_PITCH_THRESHOLD_DEG && Math.abs(yawDeg) >= GLANCE_YAW_THRESHOLD_DEG) {
        glanceTimestamps.push(now);
      }
      while (now - (glanceTimestamps[0] ?? now) > GLANCE_WINDOW_MS) {
        glanceTimestamps.shift();
      }
      if (
        glanceTimestamps.length >= GLANCE_COUNT_THRESHOLD &&
        now - lastExternalDeviceFlagAt >= EXTERNAL_DEVICE_COOLDOWN_MS
      ) {
        lastExternalDeviceFlagAt = now;
        onSignal("external_device_suspected", { recentGlances: glanceTimestamps.length });
      }
    }
  }

  const interval = window.setInterval(tick, DETECTION_INTERVAL_MS);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(interval);
      withWasmInfoLogsSuppressed(() => landmarker?.close());
    },
  };
}
