"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "../assessments.module.css";
import { CameraUnavailableError, requestCameraStream, type CameraHandle } from "./camera-service";

export interface CameraPreflightProps {
  /** Called once the stream is confirmed working — the parent takes ownership of stopping it. */
  onReady: (handle: CameraHandle) => void;
}

type Status = "idle" | "requesting" | "ready" | "error";

/**
 * The pre-exam camera check (spec §1): request access, show a live preview, and require a
 * confirmed-working camera before the student can start — never a bare consent checkbox alone.
 */
export function CameraPreflight({ onReady }: CameraPreflightProps) {
  const t = useTranslations("assessments");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handleRef = useRef<CameraHandle | null>(null);
  const ownershipTransferred = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] = useState<string>("unknown");

  useEffect(() => {
    return () => {
      // Only tear down a stream the parent never took ownership of (preflight abandoned before start).
      if (!ownershipTransferred.current) handleRef.current?.stop();
    };
  }, []);

  async function request() {
    setStatus("requesting");
    try {
      const handle = await requestCameraStream();
      handleRef.current = handle;
      if (videoRef.current) {
        videoRef.current.srcObject = handle.stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus("ready");
      ownershipTransferred.current = true;
      onReady(handle);
    } catch (error) {
      setErrorReason(error instanceof CameraUnavailableError ? error.reason : "unknown");
      setStatus("error");
    }
  }

  return (
    <section className={styles.cameraPreflight} aria-labelledby="camera-preflight-title">
      <h2 id="camera-preflight-title">{t("proctoring.preflight.title")}</h2>
      <p>{t("proctoring.preflight.body")}</p>
      <ul className={styles.preflightChecklist}>
        <li>{t("proctoring.preflight.faceCamera")}</li>
        <li>{t("proctoring.preflight.keepVisible")}</li>
        <li>{t("proctoring.preflight.lighting")}</li>
        <li>{t("proctoring.preflight.noCoverings")}</li>
      </ul>

      <div className={styles.cameraPreview}>
        <video autoPlay muted playsInline ref={videoRef} className={styles.cameraPreviewVideo} />
        {status !== "ready" ? (
          <div className={styles.cameraPreviewPlaceholder}>
            {status === "requesting"
              ? t("proctoring.preflight.requesting")
              : t("proctoring.preflight.notStarted")}
          </div>
        ) : null}
      </div>

      {status === "error" ? (
        <p className={styles.inlineError} role="alert">
          {t(`proctoring.preflight.errors.${errorReason}`)}
        </p>
      ) : null}

      {status === "ready" ? (
        <p className={styles.preflightConfirmed} role="status">
          {t("proctoring.preflight.confirmed")}
        </p>
      ) : (
        <button
          className={styles.secondaryButton}
          disabled={status === "requesting"}
          onClick={() => void request()}
          type="button"
        >
          {status === "requesting"
            ? t("proctoring.preflight.requesting")
            : t("proctoring.preflight.request")}
        </button>
      )}
    </section>
  );
}
