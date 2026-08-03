"use client";

import { useEffect, useState } from "react";

import {
  canJoinLesson,
  formatLessonCountdown,
} from "../../app/(app)/(dashboards)/_lib/lesson-countdown";
import styles from "./dashboard.module.css";

export interface LessonCountdownProps {
  startAt: string;
  endAt: string;
  joinUrl: string | null;
  joinLabel: string;
  locale: string;
}

/**
 * Renders nothing until mounted so hydration never has to reconcile a server-computed "now"
 * against the browser's clock; the countdown only appears once a client tick establishes it,
 * then refreshes every 30s.
 */
export function LessonCountdown({
  startAt,
  endAt,
  joinUrl,
  joinLabel,
  locale,
}: LessonCountdownProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // The first tick is deferred (not called synchronously in the effect body) so it lands as
    // its own post-mount update rather than a cascading render during the effect itself.
    const initial = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  if (!now) return null;

  const start = new Date(startAt);
  const end = new Date(endAt);

  return (
    <span className={styles.summaryCountdown}>
      <span>{formatLessonCountdown(start, now, locale)}</span>
      {canJoinLesson(now, start, end, joinUrl) ? (
        <a
          className={styles.summaryJoinLink}
          href={joinUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
        >
          {joinLabel}
        </a>
      ) : null}
    </span>
  );
}
