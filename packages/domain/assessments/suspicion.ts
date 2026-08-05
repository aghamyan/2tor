import type {
  AssessmentEventRecord,
  AssessmentEventType,
  SuspicionBreakdownEntry,
  SuspicionSeverity,
  SuspicionSummary,
} from "./models";

/**
 * Point values a tutor can tune later. These are signal weights for the review dashboard, never
 * an auto-fail threshold — see README "Signals are not proof". Values follow the spec's own
 * examples (face disappeared +10, second face +8, tab switch +6, browser minimized +20, copy/paste
 * +15, devtools +20) with reasonable defaults filled in for the rest of the detectable signals.
 */
export const DEFAULT_SUSPICION_WEIGHTS: Partial<Record<AssessmentEventType, number>> = {
  face_missing: 10,
  multiple_faces: 8,
  tab_switch: 6,
  focus_loss: 5,
  fullscreen_exit: 10,
  connectivity_interruption: 2,
  browser_minimized: 20,
  copy_attempt: 15,
  paste_attempt: 15,
  cut_attempt: 10,
  select_all_attempt: 3,
  print_attempt: 5,
  save_attempt: 5,
  view_source_attempt: 10,
  context_menu_attempt: 2,
  drag_attempt: 3,
  devtools_shortcut: 20,
  external_device_suspected: 20,
  camera_disconnected: 12,
};

/** `gaze_away` carries its point value in metadata.direction rather than a flat per-type weight. */
const GAZE_DIRECTION_WEIGHTS: Record<string, number> = { left: 4, right: 5, up: 4 };
const DEFAULT_GAZE_WEIGHT = 4;

export const DEFAULT_SUSPICION_THRESHOLDS: { medium: number; high: number } = {
  medium: 30,
  high: 60,
};

/** Repeated identical signals matter, but shouldn't spiral a jittery detector into a runaway score. */
const FULL_WEIGHT_OCCURRENCES = 5;
const REPEAT_DAMPING_FACTOR = 0.2;

function eventWeight(
  event: AssessmentEventRecord,
  weights: Partial<Record<AssessmentEventType, number>>,
): number {
  if (event.eventType === "gaze_away") {
    const direction = event.metadata?.direction;
    return typeof direction === "string"
      ? (GAZE_DIRECTION_WEIGHTS[direction] ?? DEFAULT_GAZE_WEIGHT)
      : DEFAULT_GAZE_WEIGHT;
  }
  return weights[event.eventType] ?? 0;
}

function severityFor(
  score: number,
  thresholds: { medium: number; high: number },
): SuspicionSeverity {
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}

function faceVisiblePercent(
  events: AssessmentEventRecord[],
  windowStart: Date | null,
  windowEnd: Date | null,
): number | null {
  const presenceEvents = events.filter(
    (event) => event.eventType === "face_missing" || event.eventType === "face_returned",
  );
  if (presenceEvents.length === 0 || !windowStart || !windowEnd) return null;
  const totalMs = windowEnd.getTime() - windowStart.getTime();
  if (totalMs <= 0) return null;

  let missingMs = 0;
  let missingSince: Date | null = null;
  for (const event of presenceEvents) {
    if (event.eventType === "face_missing") {
      missingSince ??= event.occurredAt;
    } else if (missingSince) {
      missingMs += event.occurredAt.getTime() - missingSince.getTime();
      missingSince = null;
    }
  }
  if (missingSince) missingMs += windowEnd.getTime() - missingSince.getTime();

  const visiblePercent = 100 * (1 - missingMs / totalMs);
  return Math.max(0, Math.min(100, Math.round(visiblePercent * 10) / 10));
}

function countOf(events: AssessmentEventRecord[], type: AssessmentEventType): number {
  return events.filter((event) => event.eventType === type).length;
}

export interface ComputeSuspicionSummaryOptions {
  weights?: Partial<Record<AssessmentEventType, number>>;
  thresholds?: { medium: number; high: number };
  /**
   * End of the measurement window when the attempt has no `end` event yet (still in progress —
   * a tutor can open the review mid-exam). Defaults to the real current time so an open
   * `face_missing` interval keeps counting as missing instead of freezing at the last logged
   * event, which would understate exactly the case a live reviewer most needs accurate.
   */
  now?: Date;
}

/** Pure function over the append-only event log — never a stored column, always derived fresh. */
export function computeSuspicionSummary(
  events: AssessmentEventRecord[],
  options: ComputeSuspicionSummaryOptions = {},
): SuspicionSummary {
  const weights = { ...DEFAULT_SUSPICION_WEIGHTS, ...options.weights };
  const thresholds = options.thresholds ?? DEFAULT_SUSPICION_THRESHOLDS;

  const byType = new Map<AssessmentEventType, AssessmentEventRecord[]>();
  for (const event of events) {
    const bucket = byType.get(event.eventType);
    if (bucket) bucket.push(event);
    else byType.set(event.eventType, [event]);
  }

  const breakdown: SuspicionBreakdownEntry[] = [];
  let score = 0;
  for (const [eventType, group] of byType) {
    const rawSum = group.reduce((sum, event) => sum + eventWeight(event, weights), 0);
    if (rawSum === 0) continue;
    const averageWeight = rawSum / group.length;
    const effectiveCount =
      Math.min(group.length, FULL_WEIGHT_OCCURRENCES) +
      REPEAT_DAMPING_FACTOR * Math.max(0, group.length - FULL_WEIGHT_OCCURRENCES);
    const points = Math.round(averageWeight * effectiveCount * 10) / 10;
    if (points <= 0) continue;
    score += points;
    breakdown.push({ eventType, count: group.length, points });
  }
  breakdown.sort((left, right) => right.points - left.points);
  score = Math.round(score * 10) / 10;

  const start = events.find((event) => event.eventType === "start")?.occurredAt ?? null;
  const end = events.find((event) => event.eventType === "end")?.occurredAt ?? null;
  const windowEnd = end ?? options.now ?? new Date();
  const totalDurationSeconds = start
    ? Math.max(0, Math.round((windowEnd.getTime() - start.getTime()) / 1_000))
    : null;

  return {
    score,
    severity: severityFor(score, thresholds),
    breakdown,
    stats: {
      faceVisiblePercent: faceVisiblePercent(events, start, windowEnd),
      tabSwitchCount: countOf(events, "tab_switch"),
      fullscreenExitCount: countOf(events, "fullscreen_exit"),
      copyAttemptCount: countOf(events, "copy_attempt"),
      pasteAttemptCount: countOf(events, "paste_attempt"),
      cameraDisconnectCount: countOf(events, "camera_disconnected"),
      multipleFacesCount: countOf(events, "multiple_faces"),
      warningCount: countOf(events, "warning_shown"),
      totalDurationSeconds,
    },
  };
}
