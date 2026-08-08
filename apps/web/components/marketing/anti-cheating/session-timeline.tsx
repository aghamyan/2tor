"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MonitoringEvent } from "./types";
import { eventIcon } from "./monitoring-meta";
import styles from "./anti-cheating-page.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

export interface SessionTimelineProps {
  events: MonitoringEvent[];
  severityLabels: Record<MonitoringEvent["severity"], string>;
  emptyLabel?: string;
  ariaLabel: string;
}

/**
 * Severity is never color-only (project brief §19): every row carries an icon plus a text badge
 * (`severityLabel`) alongside the color token, so the distinction survives grayscale/high-contrast
 * viewing and doesn't rely on hue perception.
 */
export function SessionTimeline({
  events,
  severityLabels,
  emptyLabel,
  ariaLabel,
}: SessionTimelineProps) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className={styles.timeline} aria-label={ariaLabel}>
      {events.length === 0 && emptyLabel && <li className={styles.timelineEmpty}>{emptyLabel}</li>}
      <AnimatePresence initial={false}>
        {events.map((event) => {
          const Icon = eventIcon[event.type];
          return (
            <motion.li
              key={event.id}
              className={styles.timelineRow}
              data-severity={event.severity}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease }}
            >
              <span className={styles.timelineTime}>{event.time}</span>
              <span className={styles.timelineIcon} aria-hidden="true">
                <Icon size={15} />
              </span>
              <span className={styles.timelineDescription}>{event.description}</span>
              <span className={styles.timelineSeverity}>{severityLabels[event.severity]}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
