/**
 * Event vocabulary is deliberately named to match `AssessmentEventType`
 * (`packages/domain/assessments/models.ts`) wherever the concepts overlap — tab/window/focus,
 * copy-paste, phone/person detection. That slice already runs a real, camera-aware proctoring
 * pipeline for tutor-authored assessments; this marketing module doesn't call into it (a
 * parent-initiated ad hoc homework session isn't part of its tutor/version authorization model),
 * but keeping the vocabulary consistent means the two can converge later without a rename.
 *
 * `status` is the honest capability boundary from the project brief: a browser tab can genuinely
 * observe `real` signals today with no extra hardware; `camera` signals need on-device computer
 * vision and explicit permission; `future` signals (an external site, an AI assistant) are not
 * observable from inside a browser tab at all and would need a server- or extension-level
 * integration that does not exist yet. Nothing in this module claims a `future` signal is live.
 */
export type MonitoringSignalStatus = "real" | "camera" | "future";

export type MonitoringEventType =
  | "session-started"
  | "student-present"
  | "focus-resumed"
  | "focus-maintained"
  | "tab-switch"
  | "window-blur"
  | "copy-paste"
  | "fullscreen-exit"
  | "phone-detected"
  | "student-absent"
  | "multiple-persons"
  | "external-resource"
  | "ai-resource";

export type MonitoringSeverity = "info" | "notice" | "warning";

export interface MonitoringEvent {
  id: string;
  type: MonitoringEventType;
  /** Human-readable clock label, e.g. "4:37 PM". Demo data only — real captures use `Date.now()`. */
  time: string;
  description: string;
  severity: MonitoringSeverity;
  /** Milliseconds after session start this event should render in the scripted demo timeline. */
  revealAtMs?: number;
  /** Present only on real, browser-captured events (never on scripted demo events). */
  confidence?: "observed";
}

export interface IntegrityCategoryScore {
  key: string;
  label: string;
  value: number;
}
