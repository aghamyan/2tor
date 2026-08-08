import { eventSeverity } from "./monitoring-meta";
import type { MonitoringEvent, MonitoringEventType } from "./types";

export interface ScriptedEventCopy {
  id: string;
  type: string;
  time: string;
  description: string;
}

/**
 * Reveal offsets for the Live Session Demo panel. Deterministic on purpose (project brief §21:
 * "use deterministic demo data rather than messy random logic") — every visitor sees the same
 * six-beat story, spaced for easy reading rather than mirroring the real minute gaps in the copy.
 */
const REVEAL_SCHEDULE_MS = [600, 3200, 6400, 9600, 12800, 16000];

/** Builds the scripted timeline from translated copy, keeping display strings out of this module. */
export function buildScriptedTimeline(events: readonly ScriptedEventCopy[]): MonitoringEvent[] {
  return events.map((event, index) => {
    const type = event.type as MonitoringEventType;
    return {
      id: event.id,
      type,
      time: event.time,
      description: event.description,
      severity: eventSeverity[type] ?? "info",
      revealAtMs: REVEAL_SCHEDULE_MS[index] ?? REVEAL_SCHEDULE_MS[REVEAL_SCHEDULE_MS.length - 1],
    };
  });
}

export const DEMO_INTEGRITY_SCORE = 96;
export const DEMO_INTEGRITY_CATEGORIES = [
  { key: "focus", value: 98 },
  { key: "device", value: 92 },
  { key: "resources", value: 100 },
  { key: "consistency", value: 94 },
] as const;

export const REPORT_INTEGRITY_SCORE = 92;
export const REPORT_INTEGRITY_CATEGORIES = [
  { key: "focus", value: 94 },
  { key: "device", value: 88 },
  { key: "resources", value: 100 },
  { key: "consistency", value: 90 },
] as const;
