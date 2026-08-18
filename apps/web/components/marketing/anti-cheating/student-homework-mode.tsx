"use client";

import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AntiCheatingCopy } from "./anti-cheating-content";
import { MonitoringIndicator } from "./monitoring-indicator";
import { SessionTimeline } from "./session-timeline";
import { useRealMonitoringSignals } from "./real-monitoring";
import type { SessionConfig } from "./homework-session-setup";
import styles from "./anti-cheating-page.module.css";

export interface StudentHomeworkModeProps {
  copy: AntiCheatingCopy["studentMode"];
  privacyCopy: AntiCheatingCopy["privacy"];
  severityLabels: AntiCheatingCopy["severity"];
  config: SessionConfig;
  onExit: () => void;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Focusable elements considered for the modal's Tab trap. */
function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled"));
}

export function StudentHomeworkMode({
  copy,
  privacyCopy,
  severityLabels,
  config,
  onExit,
}: StudentHomeworkModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(config.durationMinutes * 60);
  const [showInfo, setShowInfo] = useState(false);

  const events = useRealMonitoringSignals(true, textareaRef, {
    "tab-switch": copy.detectedTabSwitch,
    "window-blur": copy.detectedWindowBlur,
    "copy-paste": copy.detectedCopy,
    "fullscreen-exit": copy.detectedFullscreenExit,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Focus trap + Escape-to-exit. This is a demo dialog over the marketing page, not a real
  // homework session, so an explicit, keyboard-reachable exit is required even though a real
  // student-mode screen (project brief §13) would show no parent controls.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const focusables = focusableIn(container);
    focusables[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const items = focusableIn(container);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={styles.studentModeOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-mode-title"
      ref={containerRef}
    >
      <div className={styles.studentModeTopbar}>
        <div>
          <h2 id="student-mode-title">{copy.subjectLabel}</h2>
          <span>{copy.questionLabel.replace("{current}", "3").replace("{total}", "12")}</span>
        </div>
        <div className={styles.studentModeTopbarRight}>
          <span className={styles.countdown}>{copy.timeRemaining.replace("{time}", formatCountdown(remainingSeconds))}</span>
          <MonitoringIndicator
            activeLabel={copy.monitoringActive}
            cameraOnLabel={privacyCopy.indicator.cameraOnLabel}
            cameraOffLabel={privacyCopy.indicator.cameraOffLabel}
            cameraEnabled={false}
          />
          <span className={styles.infoWrap}>
            <button
              type="button"
              className={styles.infoButton}
              aria-expanded={showInfo}
              aria-controls="student-mode-info"
              onClick={() => setShowInfo((current) => !current)}
            >
              <Info size={16} aria-hidden="true" />
              <span className={styles.srOnly}>{copy.infoTitle}</span>
            </button>
            {showInfo && (
              <span id="student-mode-info" role="note" className={styles.infoPopover}>
                <strong>{copy.infoTitle}</strong>
                <p>{copy.infoBody}</p>
              </span>
            )}
          </span>
          <button type="button" className={styles.studentModeExit} onClick={onExit}>
            <X size={16} aria-hidden="true" />
            {copy.exitDemo}
          </button>
        </div>
      </div>

      <div className={styles.studentModeBody}>
        <div className={styles.studentModeWork}>
          <p className={styles.studentModePrompt}>{copy.questionPrompt}</p>
          <textarea
            ref={textareaRef}
            className={styles.studentModeTextarea}
            placeholder={copy.workspacePlaceholder}
            aria-label={copy.questionPrompt}
          />
          <button type="button" className={styles.studentModeEndButton} onClick={onExit}>
            {copy.endSession}
          </button>
        </div>
        <aside className={styles.studentModeSignals}>
          <h3>{copy.liveSignalsHeading}</h3>
          <SessionTimeline
            events={events}
            severityLabels={severityLabels}
            emptyLabel={copy.noEventsYet}
            ariaLabel={copy.liveSignalsHeading}
          />
        </aside>
      </div>
    </div>
  );
}
