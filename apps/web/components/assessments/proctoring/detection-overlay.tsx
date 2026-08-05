"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import styles from "../assessments.module.css";

export interface DetectionOverlayProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  faceTrackingUnavailable: boolean;
  cameraDisconnected: boolean;
}

/**
 * A small, always-visible self-view (spec §17 transparency: "clearly inform students what is
 * monitored"). This is the same video element the on-device face tracker reads frames from —
 * there is no separate hidden capture, and nothing here is ever recorded or transmitted.
 */
export function DetectionOverlay({
  videoRef,
  faceTrackingUnavailable,
  cameraDisconnected,
}: DetectionOverlayProps) {
  const t = useTranslations("assessments");
  return (
    <div className={styles.detectionOverlay} role="status">
      <video autoPlay muted playsInline ref={videoRef} className={styles.detectionVideo} />
      <span className={styles.detectionDot} aria-hidden="true" />
      <p className={styles.detectionLabel}>
        {cameraDisconnected
          ? t("proctoring.overlay.disconnected")
          : faceTrackingUnavailable
            ? t("proctoring.overlay.limited")
            : t("proctoring.overlay.active")}
      </p>
    </div>
  );
}
