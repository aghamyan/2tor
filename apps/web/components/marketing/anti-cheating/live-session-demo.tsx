"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { AntiCheatingCopy } from "./anti-cheating-content";
import { buildScriptedTimeline, DEMO_INTEGRITY_CATEGORIES, DEMO_INTEGRITY_SCORE } from "./demo-data";
import { IntegrityScore } from "./integrity-score";
import { SessionTimeline } from "./session-timeline";
import styles from "./anti-cheating-page.module.css";

const ease = [0.22, 1, 0.36, 1] as const;
/** Coarse timer — a live feed doesn't need 60fps, and this keeps the marketing page CPU-idle. */
const TICK_MS = 200;
const TAIL_MS = 1600;

export interface LiveSessionDemoProps {
  copy: AntiCheatingCopy["liveDemo"];
  severityLabels: AntiCheatingCopy["severity"];
  integrityCopy: AntiCheatingCopy["integrityScore"];
}

export function LiveSessionDemo({ copy, severityLabels, integrityCopy }: LiveSessionDemoProps) {
  const reduceMotion = useReducedMotion();
  const timeline = useMemo(() => buildScriptedTimeline(copy.events), [copy.events]);
  const totalMs = (timeline.at(-1)?.revealAtMs ?? 0) + TAIL_MS;

  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    function onVisibility() {
      setPaused(document.visibilityState === "hidden" ? true : paused);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused || elapsedMs >= totalMs) return;
    const id = window.setInterval(() => {
      setElapsedMs((current) => {
        if (current >= totalMs) {
          window.clearInterval(id);
          return current;
        }
        return Math.min(totalMs, current + TICK_MS);
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [paused, elapsedMs, totalMs]);

  const visibleEvents = timeline.filter((event) => (event.revealAtMs ?? 0) <= elapsedMs);
  const done = elapsedMs >= totalMs;

  function restart() {
    setElapsedMs(0);
    setPaused(false);
  }

  return (
    <div className={styles.liveDemoCard}>
      <div className={styles.liveDemoHead}>
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h3>{copy.title}</h3>
        </div>
        <span className={styles.demoTag}>{copy.demoTag}</span>
      </div>

      <div className={styles.liveDemoMeta}>
        <div>
          <span>{copy.studentLabel}</span>
          <strong>{copy.studentName}</strong>
        </div>
        <div>
          <span>{copy.assignmentLabel}</span>
          <strong>{copy.assignmentName}</strong>
        </div>
        <div>
          <span>{copy.startedLabel}</span>
          <strong>{copy.startedValue}</strong>
        </div>
        <div>
          <span>{copy.statusLabel}</span>
          <strong className={styles.liveStatusValue}>
            <i data-active={!paused} aria-hidden="true" />
            {paused ? copy.statusPaused : copy.statusActive}
          </strong>
        </div>
      </div>

      <div className={styles.liveDemoBody}>
        <div className={styles.liveDemoTimelinePane}>
          <div className={styles.liveDemoTimelineHead}>
            <h4>{copy.activityHeading}</h4>
            <div className={styles.demoControls}>
              <button type="button" onClick={() => setPaused((current) => !current)}>
                {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
                {paused ? copy.resumeLabel : copy.pauseLabel}
              </button>
              <button type="button" onClick={restart}>
                <RotateCcw size={14} aria-hidden="true" />
                {copy.restartLabel}
              </button>
            </div>
          </div>
          <SessionTimeline
            events={visibleEvents}
            severityLabels={severityLabels}
            ariaLabel={copy.activityHeading}
          />
        </div>

        <div className={styles.liveDemoSidePane}>
          <IntegrityScore
            heading={copy.integrityLabel}
            score={DEMO_INTEGRITY_SCORE}
            ratingLabel={copy.integrityRating}
            categories={DEMO_INTEGRITY_CATEGORIES.map((c) => ({
              ...c,
              label: integrityCopy.categories[c.key],
            }))}
            tooltip={integrityCopy.tooltip}
          />
          <motion.div
            className={styles.parentStatusCard}
            initial={{ opacity: 0 }}
            animate={{ opacity: done ? 1 : 0.6 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease }}
          >
            <h4>{copy.parentStatusHeading}</h4>
            <p className={styles.parentStatusStudent}>{copy.parentStatusStudent}</p>
            <p>{copy.parentStatusStarted.replace("{minutes}", "26")}</p>
            <dl>
              <div>
                <dt>{copy.parentStatusCurrent}</dt>
                <dd>{copy.parentStatusFocused}</dd>
              </div>
              <div>
                <dt>{copy.parentStatusRecentEvent}</dt>
                <dd>{visibleEvents.at(-1)?.description ?? "—"}</dd>
              </div>
            </dl>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
