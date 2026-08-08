"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeSuspicionSummary,
  DEFAULT_SUSPICION_THRESHOLDS,
} from "../../../../../packages/domain/assessments/suspicion";
import { INTEGRITY_VIOLATION_EVENT_TYPES } from "../../../../../packages/domain/assessments/models";
import type { AssessmentEventRecord, SuspicionSummary } from "../../../../../packages/domain/assessments/models";
import { installClipboardGuard } from "./clipboard-guard";
import { createEvidenceCapture } from "./evidence-capture";
import { installFocusGuard, requestFullscreenReentry } from "./focus-guard";
import {
  startFaceTracking,
  type FaceTrackingFrame,
  type FaceTrackingHandle,
} from "./face-tracking-service";
import {
  startObjectDetection,
  type ObjectDetectionFrame,
  type ObjectDetectionHandle,
} from "./object-detection-service";
import { watchCameraHealth, type CameraHandle } from "./camera-service";
import { installShortcutGuard } from "./shortcut-guard";
import { SignalBus, type QueuedSignal } from "./signal-bus";

export interface ExamProctoringOptions {
  attemptId: string;
  /** Strict guards (keyboard/clipboard/context-menu/drag) — mirrors the version's fullscreenRequired flag. */
  strict: boolean;
  camera: {
    required: boolean;
    headTrackingEnabled: boolean;
    objectDetectionEnabled: boolean;
    evidenceCaptureEnabled: boolean;
  } | null;
  /** Already-granted stream from the preflight step; the runner never re-prompts for camera access. */
  cameraHandle: CameraHandle | null;
  containerRef: React.RefObject<HTMLElement | null>;
}

export interface ExamProctoringState {
  suspicion: SuspicionSummary;
  events: readonly AssessmentEventRecord[];
  fullscreenExited: boolean;
  cameraDisconnected: boolean;
  faceTrackingUnavailable: boolean;
  /** Live per-tick detection snapshot for a monitoring console — null until the first frame lands. */
  frame: FaceTrackingFrame | null;
  /** Same idea as `frame`, for the independent object-detection model — null until it starts, or
   * always null when `camera.objectDetectionEnabled` is off. */
  objectFrame: ObjectDetectionFrame | null;
  /** Count of the "left the exam" cluster (tab/focus/fullscreen/minimize) — the basis for a tutor's integrity policy. */
  integrityViolationCount: number;
  /** True once the server has ended this attempt under a tutor's `auto_submit` integrity policy. */
  attemptClosedByPolicy: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  bus: SignalBus;
  requestFullscreenReentry: () => void;
  /** Call before intentionally leaving the page (submit) so teardown-time DOM events never re-enter as signals. */
  stopAll: () => void;
}

const LIVE_SCORE_RECOMPUTE_MS = 1_000;

/** Composition root for every proctoring guard — the client-side analogue of an "ExamController". */
export function useExamProctoring(options: ExamProctoringOptions): ExamProctoringState {
  const { attemptId, strict, camera, cameraHandle, containerRef } = options;
  const [attemptClosedByPolicy, setAttemptClosedByPolicy] = useState(false);
  const [bus] = useState(() => new SignalBus(attemptId, () => setAttemptClosedByPolicy(true)));
  const stoppedRef = useRef(false);

  const [localEvents, setLocalEvents] = useState<AssessmentEventRecord[]>([]);
  const [fullscreenExited, setFullscreenExited] = useState(false);
  const [cameraDisconnected, setCameraDisconnected] = useState(false);
  const [faceTrackingUnavailable, setFaceTrackingUnavailable] = useState(false);
  const [frame, setFrame] = useState<FaceTrackingFrame | null>(null);
  const [objectFrame, setObjectFrame] = useState<ObjectDetectionFrame | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    return bus.onSignal((signal: QueuedSignal) => {
      sequenceRef.current += 1;
      setLocalEvents((current) => [
        ...current,
        {
          id: `local-${sequenceRef.current}`,
          attemptId,
          eventType: signal.eventType,
          occurredAt: new Date(signal.occurredAtMs),
          metadata: signal.metadata,
          createdAt: new Date(signal.occurredAtMs),
        },
      ]);
      if (signal.eventType === "fullscreen_exit") setFullscreenExited(true);
      if (signal.eventType === "camera_disconnected") setCameraDisconnected(true);
    });
  }, [bus, attemptId]);

  // Focus/tab/fullscreen/offline — always on, every assessment (not just strict exam mode).
  useEffect(() => {
    // installFocusGuard only emits "fullscreen_exit" on an entered->not-entered transition, so a
    // strict-mode session that reaches here still not in fullscreen (e.g. the exam tab's own
    // fullscreen request was rejected — see exam-run.tsx) would otherwise never trip the banner
    // below. Reflect that starting state directly rather than waiting for a transition that will
    // never fire. This has to run client-side post-hydration (reading `document`), so it can't
    // move into the `useState` initializer without breaking SSR.
    if (strict && typeof document !== "undefined" && !document.fullscreenElement) {
      // One-shot sync of DOM state captured at mount, not a cascading-render pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFullscreenExited(true);
    }
    return installFocusGuard(bus, {
      onFullscreenEnter: () => setFullscreenExited(false),
    });
  }, [bus, strict]);

  // Keyboard shortcuts and clipboard/context-menu/drag — only for versions in strict exam mode.
  useEffect(() => {
    if (!strict) return undefined;
    const teardownShortcuts = installShortcutGuard(bus);
    const container = containerRef.current;
    const teardownClipboard = container ? installClipboardGuard(container, bus) : null;
    return () => {
      teardownShortcuts();
      teardownClipboard?.();
    };
    // containerRef is a stable ref object; its .current is read here (post-commit), not depended on.
  }, [bus, strict, containerRef]);

  // Camera health + on-device face tracking, only when this attempt required a camera.
  useEffect(() => {
    if (!camera?.required || !cameraHandle) return undefined;

    bus.emit("camera_ready");
    const teardownHealth = watchCameraHealth(cameraHandle.stream, () => {
      setCameraDisconnected(true);
      bus.emit("camera_disconnected");
    });

    let faceTracking: FaceTrackingHandle | null = null;
    let objectDetection: ObjectDetectionHandle | null = null;
    let cancelled = false;
    const video = videoRef.current;
    if (camera.headTrackingEnabled && video) {
      // Shared by both detectors so the per-attempt evidence cap/cooldowns (evidence-capture.ts)
      // count captures from either model against the same budget, not two independent ones.
      const evidenceCapture = createEvidenceCapture({
        attemptId,
        enabled: camera.evidenceCaptureEnabled,
      });
      const onDetectionSignal = (eventType: Parameters<typeof bus.emit>[0], metadata: Parameters<typeof bus.emit>[1]) => {
        if (cancelled) return;
        bus.emit(eventType, metadata);
        evidenceCapture.capture(video, eventType);
      };
      video.srcObject = cameraHandle.stream;
      void video
        .play()
        .catch(() => undefined)
        .then(() => {
          void startFaceTracking(
            video,
            onDetectionSignal,
            () => {
              if (!cancelled) setFaceTrackingUnavailable(true);
            },
            (nextFrame) => {
              if (!cancelled) setFrame(nextFrame);
            },
          ).then((handle) => {
            if (cancelled) handle?.stop();
            else faceTracking = handle ?? null;
          });

          if (camera.objectDetectionEnabled) {
            void startObjectDetection(video, onDetectionSignal, undefined, (nextFrame) => {
              if (!cancelled) setObjectFrame(nextFrame);
            }).then((handle) => {
              if (cancelled) handle?.stop();
              else objectDetection = handle ?? null;
            });
          }
        });
    }

    return () => {
      cancelled = true;
      teardownHealth();
      faceTracking?.stop();
      objectDetection?.stop();
      setFrame(null);
      setObjectFrame(null);
    };
  }, [
    bus,
    camera?.required,
    camera?.headTrackingEnabled,
    camera?.objectDetectionEnabled,
    camera?.evidenceCaptureEnabled,
    cameraHandle,
    attemptId,
  ]);

  const suspicion = useMemo(() => computeSuspicionSummary(localEvents), [localEvents]);
  const integrityViolationCount = useMemo(
    () => localEvents.filter((item) => INTEGRITY_VIOLATION_EVENT_TYPES.includes(item.eventType)).length,
    [localEvents],
  );

  useEffect(() => {
    // Recompute periodically even with no new signals so time-based stats (duration) stay live.
    const timer = window.setInterval(() => {
      setLocalEvents((current) => [...current]);
    }, LIVE_SCORE_RECOMPUTE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // React Strict Mode (dev only) runs this cleanup once immediately after the real mount, as if
    // unmounting, to surface non-idempotent effects — then runs the (bodyless) setup again. Resume
    // undoes that simulated stop; a genuine final stop only ever happens via `stopAll()` or an
    // actual unmount, at which point this setup never reruns to resume it.
    bus.resume();
    return () => {
      if (!stoppedRef.current) bus.stop();
    };
  }, [bus]);

  return {
    suspicion,
    events: localEvents,
    fullscreenExited,
    cameraDisconnected,
    faceTrackingUnavailable,
    frame,
    objectFrame,
    integrityViolationCount,
    attemptClosedByPolicy,
    videoRef,
    bus,
    requestFullscreenReentry: () => void requestFullscreenReentry(),
    stopAll: () => {
      stoppedRef.current = true;
      bus.stop();
    },
  };
}

export { DEFAULT_SUSPICION_THRESHOLDS };
