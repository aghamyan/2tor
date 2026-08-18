import { Camera, CameraOff } from "lucide-react";
import styles from "./anti-cheating-page.module.css";

export interface MonitoringIndicatorProps {
  activeLabel: string;
  cameraOnLabel: string;
  cameraOffLabel: string;
  cameraEnabled: boolean;
}

/**
 * Pure presentational — no client-side state. The pulse is CSS-only and disabled under
 * `prefers-reduced-motion` in the stylesheet, so this stays a server component and can be reused
 * inside both a static preview (privacy section) and the client-rendered student mode top bar.
 */
export function MonitoringIndicator({
  activeLabel,
  cameraOnLabel,
  cameraOffLabel,
  cameraEnabled,
}: MonitoringIndicatorProps) {
  return (
    <div className={styles.monitorIndicator} role="status">
      <span className={styles.monitorDot} aria-hidden="true" />
      <span>{activeLabel}</span>
      <span className={styles.monitorDivider} aria-hidden="true" />
      <span className={styles.monitorCamera}>
        {cameraEnabled ? (
          <Camera size={14} aria-hidden="true" />
        ) : (
          <CameraOff size={14} aria-hidden="true" />
        )}
        {cameraEnabled ? cameraOnLabel : cameraOffLabel}
      </span>
    </div>
  );
}
