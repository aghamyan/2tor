"use client";

import type { AssessmentEventType } from "../../../../../packages/domain/assessments/models";
import type { ProctoringMetadata } from "./signal-bus";

export interface ObjectDetectionHandle {
  stop: () => void;
}

export type ObjectDetectionSignalHandler = (
  eventType: AssessmentEventType,
  metadata: ProctoringMetadata | null,
) => void;

/** Pixel-space box from MediaPipe's `ObjectDetector`, normalized to [0,1] against the source
 * video's native resolution — see `startObjectDetection`'s coordinate-space note. */
export interface ObjectDetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ObjectDetectionCategory = "cell_phone" | "laptop" | "book" | "remote";

export interface ObjectDetection {
  category: ObjectDetectionCategory;
  score: number;
  box: ObjectDetectionBox;
}

/** A per-tick snapshot for the monitoring console — every detection above `SCORE_THRESHOLD`,
 * unfiltered by the grace/cooldown gating that the debounced `onSignal` events go through. */
export interface ObjectDetectionFrame {
  detections: readonly ObjectDetection[];
}

export type ObjectDetectionFrameHandler = (frame: ObjectDetectionFrame) => void;

// COCO's raw label strings (confirmed via a live `ObjectDetector.detect()` run against a real
// photo — see object-detection-service verification notes) mapped to a stable internal category
// key, since the raw strings ("cell phone") aren't ideal i18n/metadata keys. Deliberately narrow:
// COCO has 80 classes, and most (car, dog, traffic light, ...) are irrelevant here. "keyboard" and
// "mouse" are deliberately excluded even though COCO has them — a student's own exam peripherals
// would false-positive constantly.
const CATEGORY_BY_LABEL: Record<string, ObjectDetectionCategory> = {
  "cell phone": "cell_phone",
  laptop: "laptop",
  book: "book",
  remote: "remote",
};
const TARGET_CATEGORY_ALLOWLIST = Object.keys(CATEGORY_BY_LABEL);

const SCORE_THRESHOLD = 0.5;
const MAX_RESULTS = 5;
// Heavier model than face landmarks; a slower cadence keeps CPU/battery reasonable on modest
// student laptops (mirrors Sentinel's own "trade detection latency for CPU usage" knob).
const DETECTION_INTERVAL_MS = 700;
// A one-frame detection can be a misclassified hand or a reflection; require it to persist briefly
// before treating it as real, the same discipline `multiple_faces`/`gaze_away` already use.
const SUSTAIN_MS = 1_200;
// Phones are the single most important signal this module can surface — a shorter cooldown keeps
// re-flagging a phone that stays in frame. Softer "unusual item" categories cool down longer so
// they can't crowd out phone evidence against the shared per-attempt cap (see services.ts).
const PHONE_COOLDOWN_MS = 15_000;
const UNUSUAL_ITEM_COOLDOWN_MS = 45_000;

const WASM_BASE = "/mediapipe/wasm";
const MODEL_URL = "/mediapipe/object_detector.tflite";

let modulePromise: Promise<typeof import("@mediapipe/tasks-vision")> | null = null;
function loadMediaPipe() {
  modulePromise ??= import("@mediapipe/tasks-vision");
  return modulePromise;
}

function isBenignWasmInfoLog(args: unknown[]): boolean {
  return typeof args[0] === "string" && args[0].startsWith("INFO:");
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

/**
 * Client-side-only object presence detection (phone / laptop / book / remote in frame), the
 * "recognizes phones and unusual items" half of proctoring. Runs the same self-hosted MediaPipe
 * WASM runtime `face-tracking-service.ts` uses, with a second, independent model
 * (`ObjectDetector`, COCO-trained) — no image or video ever leaves the browser; see
 * README "Camera boundary". Degrades to a no-op handle (never throws) when the model or WASM
 * runtime fails to load.
 */
export async function startObjectDetection(
  video: HTMLVideoElement,
  onSignal: ObjectDetectionSignalHandler,
  onCapabilityUnavailable?: (reason: string) => void,
  onFrame?: ObjectDetectionFrameHandler,
): Promise<ObjectDetectionHandle> {
  let detector: Awaited<ReturnType<typeof import("@mediapipe/tasks-vision").ObjectDetector.createFromOptions>> | null =
    null;
  try {
    const { ObjectDetector, FilesetResolver } = await loadMediaPipe();
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const commonOptions = {
      runningMode: "VIDEO" as const,
      scoreThreshold: SCORE_THRESHOLD,
      maxResults: MAX_RESULTS,
      categoryAllowlist: TARGET_CATEGORY_ALLOWLIST,
    };
    try {
      detector = await withWasmInfoLogsSuppressedAsync(() =>
        ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          ...commonOptions,
        }),
      );
    } catch (gpuError) {
      console.warn("[assessments] Object detection: GPU delegate failed, retrying on CPU.", gpuError);
      detector = await withWasmInfoLogsSuppressedAsync(() =>
        ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          ...commonOptions,
        }),
      );
    }
  } catch (error) {
    console.warn("[assessments] Object detection unavailable; continuing without it.", error);
    onCapabilityUnavailable?.(error instanceof Error ? error.message : "unknown");
    return { stop: () => {} };
  }

  let stopped = false;
  let phoneSince: number | null = null;
  let unusualItemSince: number | null = null;
  let lastPhoneFlagAt = 0;
  let lastUnusualItemFlagAt = 0;

  function tick() {
    if (stopped || !detector || video.readyState < video.HAVE_CURRENT_DATA) return;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) return;
    const now = performance.now();
    let result: ReturnType<typeof detector.detectForVideo>;
    try {
      result = detector.detectForVideo(video, now);
    } catch {
      return; // a single malformed frame during camera warm-up shouldn't tear down the session
    }

    const detections: ObjectDetection[] = [];
    for (const detection of result.detections) {
      const top = detection.categories[0];
      const box = detection.boundingBox;
      if (!top || !box) continue;
      const category = CATEGORY_BY_LABEL[top.categoryName];
      if (!category) continue;
      detections.push({
        category,
        score: top.score,
        // ObjectDetector returns pixel coordinates in the source frame's native resolution —
        // normalize to [0,1] so ProctoringConsole's shared `projectBox` helper (built for
        // FaceLandmarker's normalized landmarks) works unchanged for both detectors.
        box: {
          x: box.originX / videoWidth,
          y: box.originY / videoHeight,
          width: box.width / videoWidth,
          height: box.height / videoHeight,
        },
      });
    }

    onFrame?.({ detections });

    const phoneDetected = detections.some((item) => item.category === "cell_phone");
    const unusualItem = detections.find(
      (item) => item.category === "laptop" || item.category === "book" || item.category === "remote",
    );

    if (phoneDetected) {
      phoneSince ??= now;
      if (now - phoneSince >= SUSTAIN_MS && now - lastPhoneFlagAt >= PHONE_COOLDOWN_MS) {
        lastPhoneFlagAt = now;
        const bestPhone = detections
          .filter((item) => item.category === "cell_phone")
          .reduce((a, b) => (b.score > a.score ? b : a));
        onSignal("phone_detected", { score: Math.round(bestPhone.score * 100) / 100 });
      }
    } else {
      phoneSince = null;
    }

    if (unusualItem) {
      unusualItemSince ??= now;
      if (now - unusualItemSince >= SUSTAIN_MS && now - lastUnusualItemFlagAt >= UNUSUAL_ITEM_COOLDOWN_MS) {
        lastUnusualItemFlagAt = now;
        onSignal("unusual_item_detected", {
          category: unusualItem.category,
          score: Math.round(unusualItem.score * 100) / 100,
        });
      }
    } else {
      unusualItemSince = null;
    }
  }

  const interval = window.setInterval(tick, DETECTION_INTERVAL_MS);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(interval);
      withWasmInfoLogsSuppressed(() => detector?.close());
    },
  };
}
