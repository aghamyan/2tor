"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeSuspicionSummary,
  DEFAULT_SUSPICION_THRESHOLDS,
} from "../../../../../packages/domain/assessments/suspicion";
import { INTEGRITY_VIOLATION_EVENT_TYPES } from "../../../../../packages/domain/assessments/models";
import type { AssessmentEventRecord, SuspicionSummary } from "../../../../../packages/domain/assessments/models";
import { installClipboardGuard } from "./clipboard-guard";
import { installFocusGuard, requestFullscreenReentry } from "./focus-guard";
import { startFaceTracking, type FaceTrackingHandle } from "./face-tracking-service";
import { watchCameraHealth, type CameraHandle } from "./camera-service";
import { installShortcutGuard } from "./shortcut-guard";
import { SignalBus, type QueuedSignal } from "./signal-bus";

export interface ExamProctoringOptions {
  attemptId: string;
  /** Strict guards (keyboard/clipboard/context-menu/drag) — mirrors the version's fullscreenRequired flag. */
  strict: boolean;
  camera: { required: boolean; headTrackingEnabled: boolean } | null;
  /** Already-granted stream from the preflight step; the runner never re-prompts for camera access. */
  cameraHandle: CameraHandle | null;
  containerRef: React.RefObject<HTMLElement | null>;
}

export interface ExamProctoringState {
  suspicion: SuspicionSummary;
  fullscreenExited: boolean;
  cameraDisconnected: boolean;
  faceTrackingUnavailable: boolean;
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
    return installFocusGuard(bus, {
      onFullscreenEnter: () => setFullscreenExited(false),
    });
  }, [bus]);

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
    let cancelled = false;
    const video = videoRef.current;
    if (camera.headTrackingEnabled && video) {
      video.srcObject = cameraHandle.stream;
      void video
        .play()
        .catch(() => undefined)
        .then(() =>
          startFaceTracking(
            video,
            (eventType, metadata) => {
              if (!cancelled) bus.emit(eventType, metadata);
            },
            () => {
              if (!cancelled) setFaceTrackingUnavailable(true);
            },
          ),
        )
        .then((handle) => {
          if (cancelled) handle?.stop();
          else faceTracking = handle ?? null;
        });
    }

    return () => {
      cancelled = true;
      teardownHealth();
      faceTracking?.stop();
    };
  }, [bus, camera?.required, camera?.headTrackingEnabled, cameraHandle]);

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
    return () => {
      if (!stoppedRef.current) bus.stop();
    };
  }, [bus]);

  return {
    suspicion,
    fullscreenExited,
    cameraDisconnected,
    faceTrackingUnavailable,
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
