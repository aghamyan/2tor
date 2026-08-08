"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { eventSeverity } from "./monitoring-meta";
import type { MonitoringEvent, MonitoringEventType } from "./types";

export interface RealMonitoringLabels {
  "tab-switch": string;
  "window-blur": string;
  "copy-paste": string;
  "fullscreen-exit": string;
}

/**
 * Grace period after install: entering the student-mode demo itself triggers a `blur`/
 * `visibilitychange` pair (the setup wizard's "Begin Homework" click hands off focus), which would
 * otherwise be misread as the very first monitored action. Mirrors the same guard in
 * `apps/web/components/assessments/proctoring/focus-guard.ts`.
 */
const GRACE_MS = 1_200;
/** Copy and blur/visibilitychange can fire in the same tick; keep one entry per real action. */
const DEDUPE_MS = 400;

function formatClockTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

/**
 * Real, browser-observable signals only (project brief §22): tab visibility, window focus,
 * fullscreen exit, and copy/paste inside the homework textarea this hook is scoped to. There is no
 * network, camera, or cross-tab access here — everything below is the Page Visibility API, the
 * `blur`/`fullscreenchange` window events, and `copy`/`paste` on one element.
 */
export function useRealMonitoringSignals(
  active: boolean,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  labels: RealMonitoringLabels,
): MonitoringEvent[] {
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const installedAt = useRef(0);
  const lastEmittedAt = useRef<Partial<Record<MonitoringEventType, number>>>({});
  const counter = useRef(0);
  // A ticking countdown re-renders the mode this hook lives in every second; reading labels from
  // a ref (rather than the effect's dependency array) keeps the listeners installed exactly once
  // per session instead of tearing down and resetting the grace period on every tick.
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  });

  useEffect(() => {
    if (!active) return;
    installedAt.current = Date.now();
    lastEmittedAt.current = {};

    function withinGrace() {
      return Date.now() - installedAt.current < GRACE_MS;
    }

    function push(type: MonitoringEventType, description: string) {
      const now = Date.now();
      const last = lastEmittedAt.current[type] ?? 0;
      if (now - last < DEDUPE_MS) return;
      lastEmittedAt.current[type] = now;
      counter.current += 1;
      setEvents((current) => [
        ...current,
        {
          id: `real-${counter.current}`,
          type,
          time: formatClockTime(new Date(now)),
          description,
          severity: eventSeverity[type],
          confidence: "observed",
        },
      ]);
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden" && !withinGrace()) {
        push("tab-switch", labelsRef.current["tab-switch"]);
      }
    }
    function handleBlur() {
      if (document.visibilityState !== "hidden" && !withinGrace()) {
        push("window-blur", labelsRef.current["window-blur"]);
      }
    }
    function handleFullscreenChange() {
      if (!document.fullscreenElement && !withinGrace()) {
        push("fullscreen-exit", labelsRef.current["fullscreen-exit"]);
      }
    }
    function handleCopyOrPaste() {
      if (!withinGrace()) push("copy-paste", labelsRef.current["copy-paste"]);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    const textarea = textareaRef.current;
    textarea?.addEventListener("copy", handleCopyOrPaste);
    textarea?.addEventListener("paste", handleCopyOrPaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      textarea?.removeEventListener("copy", handleCopyOrPaste);
      textarea?.removeEventListener("paste", handleCopyOrPaste);
    };
  }, [active, textareaRef]);

  return events;
}
