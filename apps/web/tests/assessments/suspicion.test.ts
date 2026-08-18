import { describe, expect, it } from "vitest";
import type { AssessmentEventRecord, AssessmentEventType } from "../../../../packages/domain/assessments/models";
import { computeSuspicionSummary } from "../../../../packages/domain/assessments/suspicion";

let sequence = 0;
function makeEvent(
  eventType: AssessmentEventType,
  occurredAt: Date,
  metadata: Record<string, unknown> | null = null,
): AssessmentEventRecord {
  sequence += 1;
  return {
    id: `event-${sequence}`,
    attemptId: "attempt-1",
    eventType,
    occurredAt,
    metadata,
    createdAt: occurredAt,
  };
}

const base = new Date("2026-08-04T10:00:00.000Z");
function at(offsetSeconds: number) {
  return new Date(base.getTime() + offsetSeconds * 1_000);
}

describe("computeSuspicionSummary", () => {
  it("returns a zero, low-severity summary for an empty event log", () => {
    const summary = computeSuspicionSummary([]);
    expect(summary.score).toBe(0);
    expect(summary.severity).toBe("low");
    expect(summary.breakdown).toEqual([]);
    expect(summary.stats.faceVisiblePercent).toBeNull();
    expect(summary.stats.totalDurationSeconds).toBeNull();
  });

  it("is a signal breakdown, never a verdict or guilt label", () => {
    const summary = computeSuspicionSummary([makeEvent("face_missing", at(5))]);
    expect(summary).not.toHaveProperty("verdict");
    expect(summary).not.toHaveProperty("cheated");
    expect(summary).not.toHaveProperty("disqualified");
    expect(Object.keys(summary).sort()).toEqual(["breakdown", "score", "severity", "stats"]);
  });

  it("weights a single face-missing event at its base point value", () => {
    const summary = computeSuspicionSummary([makeEvent("face_missing", at(5))]);
    expect(summary.score).toBe(10);
    expect(summary.severity).toBe("low");
    expect(summary.breakdown).toEqual([{ eventType: "face_missing", count: 1, points: 10 }]);
  });

  it("dampens repeated identical signals instead of scaling them linearly", () => {
    const events = Array.from({ length: 10 }, (_, index) => makeEvent("tab_switch", at(index)));
    const summary = computeSuspicionSummary(events);
    // effectiveCount = min(10,5) + 0.2*(10-5) = 6; weight 6 -> 36, well under a naive 10*6=60.
    expect(summary.score).toBe(36);
    expect(summary.severity).toBe("medium");
  });

  it("weights gaze_away by its recorded direction, not a flat rate", () => {
    const summary = computeSuspicionSummary([
      makeEvent("gaze_away", at(1), { direction: "right" }),
      makeEvent("gaze_away", at(2), { direction: "left" }),
    ]);
    const entry = summary.breakdown.find((item) => item.eventType === "gaze_away");
    expect(entry?.points).toBe(9); // 5 (right) + 4 (left), both under the damping cap
  });

  it("accumulates points across distinct signal types without any pass/fail field", () => {
    const summary = computeSuspicionSummary([
      makeEvent("multiple_faces", at(1)),
      makeEvent("copy_attempt", at(2)),
      makeEvent("paste_attempt", at(3)),
    ]);
    expect(summary.score).toBe(38); // 8 + 15 + 15
    expect(summary.severity).toBe("medium");
    expect(summary).not.toHaveProperty("passed");
  });

  it("computes face-visible percent from face_missing/face_returned intervals within the attempt window", () => {
    const events = [
      makeEvent("start", at(0)),
      makeEvent("face_missing", at(30)),
      makeEvent("face_returned", at(60)),
      makeEvent("end", at(300)),
    ];
    const summary = computeSuspicionSummary(events);
    // 30s missing out of 300s total => 90% visible.
    expect(summary.stats.faceVisiblePercent).toBe(90);
    expect(summary.stats.totalDurationSeconds).toBe(300);
  });

  it("treats an unreturned face-missing state as missing through the end of the window", () => {
    const events = [
      makeEvent("start", at(0)),
      makeEvent("face_missing", at(90)),
      makeEvent("end", at(100)),
    ];
    const summary = computeSuspicionSummary(events);
    expect(summary.stats.faceVisiblePercent).toBe(90);
  });

  it("keeps an unclosed face-missing interval counting as missing for an in-progress attempt viewed live", () => {
    const events = [makeEvent("start", at(0)), makeEvent("face_missing", at(60))];
    // Viewed live 120s after start, 60s after the face went missing with no face_returned yet.
    const summary = computeSuspicionSummary(events, { now: at(120) });
    // 60s missing out of 120s total => 50% visible, not the ~100% a "freeze at last event" bug would show.
    expect(summary.stats.faceVisiblePercent).toBe(50);
    expect(summary.stats.totalDurationSeconds).toBe(120);
  });

  it("reports null face-visible percent when no presence signals were ever recorded", () => {
    const summary = computeSuspicionSummary([
      makeEvent("start", at(0)),
      makeEvent("tab_switch", at(10)),
      makeEvent("end", at(20)),
    ]);
    expect(summary.stats.faceVisiblePercent).toBeNull();
  });

  it("crosses into high severity once accumulated points pass the high threshold", () => {
    const events = [
      ...Array.from({ length: 5 }, (_, index) => makeEvent("browser_minimized", at(index))),
    ];
    const summary = computeSuspicionSummary(events);
    expect(summary.score).toBe(100); // 20 * 5 occurrences, all within the full-weight window
    expect(summary.severity).toBe("high");
  });

  it("never lets a logged evidence photo change the score — evidence_captured carries no weight", () => {
    // recordAssessmentEvidence in services.ts always appends an "evidence_captured" row (never
    // reusing the triggering type) precisely so this stays true — see README "Camera boundary".
    const withoutEvidence = computeSuspicionSummary([makeEvent("multiple_faces", at(1))]);
    const withEvidence = computeSuspicionSummary([
      makeEvent("multiple_faces", at(1)),
      makeEvent("evidence_captured", at(1), {
        evidenceEventType: "multiple_faces",
        evidenceFileKey: "assessments/evidence/attempt-1/evidence-1.jpg",
      }),
    ]);
    expect(withEvidence.score).toBe(withoutEvidence.score);
    expect(withEvidence.breakdown).toEqual(withoutEvidence.breakdown);
    expect(withEvidence.stats.multipleFacesCount).toBe(withoutEvidence.stats.multipleFacesCount);
  });

  it("weights a phone detection more heavily than a generic unusual item", () => {
    const phone = computeSuspicionSummary([makeEvent("phone_detected", at(1))]);
    const unusualItem = computeSuspicionSummary([makeEvent("unusual_item_detected", at(1))]);
    expect(phone.score).toBeGreaterThan(unusualItem.score);
  });

  it("never scores eyes_closed — untuned against real footage, so it stays a zero-weight signal", () => {
    // See README "Camera boundary": eyeBlinkLeft/Right also spike on a normal blink or an angled
    // face, so this is deliberately excluded from the score until proven reliable — it's still
    // logged and still shown to the tutor (breakdown just never includes it while rawSum is 0).
    const summary = computeSuspicionSummary([
      makeEvent("eyes_closed", at(1)),
      makeEvent("eyes_closed", at(2)),
      makeEvent("eyes_closed", at(3)),
    ]);
    expect(summary.score).toBe(0);
    expect(summary.breakdown).toEqual([]);
  });

  it("respects custom weights and thresholds", () => {
    const summary = computeSuspicionSummary([makeEvent("tab_switch", at(1))], {
      weights: { tab_switch: 1 },
      thresholds: { medium: 0.5, high: 5 },
    });
    expect(summary.score).toBe(1);
    expect(summary.severity).toBe("medium");
  });
});
