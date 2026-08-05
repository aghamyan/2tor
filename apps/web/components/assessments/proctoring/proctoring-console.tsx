"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import type {
  AssessmentEventRecord,
  SuspicionSummary,
} from "../../../../../packages/domain/assessments/models";
import styles from "../assessments.module.css";
import type { FaceTrackingFrame } from "./face-tracking-service";
import type { ObjectDetectionFrame } from "./object-detection-service";

export interface ProctoringConsoleProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  frame: FaceTrackingFrame | null;
  objectFrame: ObjectDetectionFrame | null;
  cameraDisconnected: boolean;
  faceTrackingUnavailable: boolean;
  suspicion: SuspicionSummary;
  events: readonly AssessmentEventRecord[];
}

const BOX_COLOR_OK = "#0b6b68";
const BOX_COLOR_WARN = "#c0392b";
// Distinct from the face boxes so a tutor/student can tell "a face was flagged" apart from
// "an object was flagged" at a glance — amber reads as "attention" without implying the same
// severity as the red face-box warning color.
const BOX_COLOR_OBJECT = "#b8860b";
const RECENT_EVENTS_SHOWN = 6;

/** Maps `object-fit: cover` positioning so a normalized [0,1] landmark box lands exactly on the
 * face as displayed, even though the canvas's CSS box rarely matches the camera's native aspect ratio. */
function projectBox(
  box: { x: number; y: number; width: number; height: number },
  videoW: number,
  videoH: number,
  canvasW: number,
  canvasH: number,
) {
  const scale = Math.max(canvasW / videoW, canvasH / videoH);
  const drawW = videoW * scale;
  const drawH = videoH * scale;
  const offsetX = (canvasW - drawW) / 2;
  const offsetY = (canvasH - drawH) / 2;
  return {
    x: box.x * drawW + offsetX,
    y: box.y * drawH + offsetY,
    width: box.width * drawW,
    height: box.height * drawH,
  };
}

/**
 * The student-facing analogue of Sentinel's monitoring console: the same self-view video used for
 * on-device face tracking, an overlaid canvas drawing the live detection box(es), and a status
 * panel mirroring what the tutor will eventually see (severity band, stats, recent signals) — see
 * README "Camera boundary" for what is and isn't ever sent anywhere. Purely a live mirror of
 * already-computed client-side state; draws nothing that isn't already derived for other purposes.
 */
export function ProctoringConsole({
  videoRef,
  frame,
  objectFrame,
  cameraDisconnected,
  faceTrackingUnavailable,
  suspicion,
  events,
}: ProctoringConsoleProps) {
  const t = useTranslations("assessments");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!video?.videoWidth || !video.videoHeight) return;

    context.lineWidth = Math.max(2, canvas.width * 0.004);
    context.font = `${Math.max(12, Math.round(canvas.width * 0.022))}px ui-monospace, monospace`;
    context.textBaseline = "bottom";

    function drawLabeledBox(
      targetCanvas: HTMLCanvasElement,
      targetContext: CanvasRenderingContext2D,
      videoWidth: number,
      videoHeight: number,
      box: { x: number; y: number; width: number; height: number },
      color: string,
      label: string,
    ) {
      const projected = projectBox(box, videoWidth, videoHeight, targetCanvas.width, targetCanvas.height);
      targetContext.strokeStyle = color;
      targetContext.strokeRect(projected.x, projected.y, projected.width, projected.height);
      const textWidth = targetContext.measureText(label).width;
      targetContext.fillStyle = color;
      targetContext.fillRect(projected.x, Math.max(0, projected.y - 20), textWidth + 10, 20);
      targetContext.fillStyle = "#ffffff";
      targetContext.fillText(label, projected.x + 5, Math.max(20, projected.y - 4));
    }

    if (frame) {
      const multiple = frame.faceCount >= 2;
      const missing = frame.faceCount === 0;
      const color = multiple || missing ? BOX_COLOR_WARN : BOX_COLOR_OK;
      frame.faces.forEach((box, index) => {
        const label = multiple
          ? t("proctoring.console.faceLabelMultiple", { index: index + 1 })
          : t("proctoring.console.faceLabel");
        drawLabeledBox(canvas, context, video.videoWidth, video.videoHeight, box, color, label);
      });
    }

    for (const detection of objectFrame?.detections ?? []) {
      const label = `${t(`proctoring.console.category.${detection.category}`)} ${Math.round(detection.score * 100)}%`;
      drawLabeledBox(
        canvas,
        context,
        video.videoWidth,
        video.videoHeight,
        detection.box,
        BOX_COLOR_OBJECT,
        label,
      );
    }
  }, [frame, objectFrame, t, videoRef]);

  const statusLine = cameraDisconnected
    ? { key: "disconnected", severity: "high" as const }
    : faceTrackingUnavailable
      ? { key: "limited", severity: "medium" as const }
      : { key: suspicion.severity, severity: suspicion.severity };

  const recentEvents = [...events]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, RECENT_EVENTS_SHOWN);

  return (
    <div className={styles.proctoringConsole}>
      <div className={styles.consoleVideoWrap} ref={wrapRef}>
        <video autoPlay muted playsInline ref={videoRef} className={styles.consoleVideo} />
        <canvas className={styles.consoleCanvas} ref={canvasRef} />
        <div className={styles.consoleLiveChip}>
          <span className={styles.detectionDot} aria-hidden="true" />
          <span>{t("proctoring.console.live")}</span>
        </div>
      </div>

      <div className={styles.consolePanel}>
        <div className={`${styles.consoleStatusBand} ${styles[`severity_${statusLine.severity}`]}`}>
          {t(`proctoring.console.statusLine.${statusLine.key}`)}
        </div>

        <dl className={styles.consoleStats}>
          <div>
            <dt>{t("proctoring.console.stats.suspicionScore")}</dt>
            <dd>{suspicion.score}</dd>
          </div>
          <div>
            <dt>{t("proctoring.console.stats.faces")}</dt>
            <dd>{frame ? frame.faceCount : "—"}</dd>
          </div>
          <div>
            <dt>{t("proctoring.console.stats.headDirection")}</dt>
            <dd>
              {frame?.headDirection
                ? t(`proctoring.console.direction.${frame.headDirection}`)
                : "—"}
            </dd>
          </div>
          <div>
            <dt>{t("proctoring.console.stats.gaze")}</dt>
            <dd>
              {frame?.gazeDirection ? t(`proctoring.console.direction.${frame.gazeDirection}`) : "—"}
            </dd>
          </div>
          <div>
            <dt>{t("proctoring.console.stats.objects")}</dt>
            <dd>
              {objectFrame
                ? objectFrame.detections.length === 0
                  ? t("proctoring.console.stats.objectsNone")
                  : objectFrame.detections
                      .map((detection) => t(`proctoring.console.category.${detection.category}`))
                      .join(", ")
                : "—"}
            </dd>
          </div>
        </dl>

        <div className={styles.consoleFeed}>
          <p className={styles.consoleFeedTitle}>{t("proctoring.console.recentActivity")}</p>
          {recentEvents.length === 0 ? (
            <p className={styles.consoleFeedEmpty}>{t("proctoring.console.noActivity")}</p>
          ) : (
            <ul>
              {recentEvents.map((event) => (
                <li key={event.id}>
                  <time>{event.occurredAt.toLocaleTimeString()}</time>
                  <span>{t(`signals.${event.eventType}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
