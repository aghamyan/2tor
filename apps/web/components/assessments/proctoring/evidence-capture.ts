"use client";

import { EVIDENCE_CAPTURE_EVENT_TYPES } from "../../../../../packages/domain/assessments/schemas";
import type { AssessmentEventType } from "../../../../../packages/domain/assessments/models";

const DEFAULT_COOLDOWN_MS = 20_000;
// Phones stay on the tight default cooldown — they're the highest-priority signal and should keep
// re-flagging promptly. Calmer "it might be nothing" signals cool down much longer so they can't
// crowd out phone evidence against the shared per-attempt cap below (services.ts mirrors this cap).
const COOLDOWN_MS_BY_TYPE: Partial<Record<AssessmentEventType, number>> = {
  unusual_item_detected: 60_000,
  eyes_closed: 90_000,
};
// Mirrors MAX_EVIDENCE_PER_ATTEMPT in services.ts — stops early locally rather than relying only
// on the server's 409 once the cap is already hit.
const MAX_CAPTURES_PER_ATTEMPT = 60;
const JPEG_QUALITY = 0.7;
const TARGET_WIDTH = 640;

const EVIDENCE_TYPE_SET = new Set<string>(EVIDENCE_CAPTURE_EVENT_TYPES);

export interface EvidenceCaptureOptions {
  attemptId: string;
  enabled: boolean;
}

export interface EvidenceCapture {
  capture(video: HTMLVideoElement | null, eventType: AssessmentEventType): void;
}

function drawFrame(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth || !video.videoHeight) return Promise.resolve(null);
  const scale = Math.min(1, TARGET_WIDTH / video.videoWidth);
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.drawImage(video, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY));
}

/**
 * Client-side counterpart to `recordAssessmentEvidence` in services.ts — captures a downscaled
 * JPEG frame on a bounded set of violation signals (`EVIDENCE_CAPTURE_EVENT_TYPES`) and uploads
 * it. Never throws: a failed capture or upload is dropped silently, matching `SignalBus.flush`'s
 * resilience style, since evidence is a review aid the exam flow never depends on completing.
 */
export function createEvidenceCapture(options: EvidenceCaptureOptions): EvidenceCapture {
  const { attemptId, enabled } = options;
  const lastCaptureAtByType = new Map<AssessmentEventType, number>();
  let totalCaptures = 0;

  return {
    capture(video, eventType) {
      if (!enabled || !video) return;
      if (!EVIDENCE_TYPE_SET.has(eventType)) return;
      if (totalCaptures >= MAX_CAPTURES_PER_ATTEMPT) return;
      const now = Date.now();
      const last = lastCaptureAtByType.get(eventType) ?? 0;
      const cooldownMs = COOLDOWN_MS_BY_TYPE[eventType] ?? DEFAULT_COOLDOWN_MS;
      if (now - last < cooldownMs) return;
      lastCaptureAtByType.set(eventType, now);
      totalCaptures += 1;

      void drawFrame(video)
        .then((blob) => {
          if (!blob) return undefined;
          const form = new FormData();
          form.set("eventType", eventType);
          form.set("file", blob, "evidence.jpg");
          return fetch(`/api/assessments/attempts/${encodeURIComponent(attemptId)}/evidence`, {
            method: "POST",
            body: form,
          });
        })
        .catch(() => undefined);
    },
  };
}
