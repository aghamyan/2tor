import { describe, expect, it } from "vitest";

import {
  computeChargeableLessonEvents,
  type CancellationWithLessonRow,
} from "../../../../packages/domain/scheduling/chargeable-events";

function row(overrides: Partial<CancellationWithLessonRow> = {}): CancellationWithLessonRow {
  return {
    cancellationId: "cancellation-1",
    lessonId: "lesson-1",
    category: "parent_request",
    canceledAt: new Date("2026-07-29T10:00:00.000Z"),
    canceledByUserId: "parent-user-1",
    scheduledStartAt: new Date("2026-07-29T18:00:00.000Z"), // 8h after canceledAt
    isTrial: false,
    status: "canceled",
    tutorStudentAssignmentId: "assignment-1",
    ...overrides,
  };
}

describe("computeChargeableLessonEvents — the Payments/D14 read contract", () => {
  it("emits a 50% chargeable event for an individual lesson cancelled under 8 hours' notice", () => {
    const events = computeChargeableLessonEvents(
      [row({ canceledAt: new Date("2026-07-29T15:00:00.000Z") })], // 3h notice
      new Map([["lesson-1", 1]]),
    );
    expect(events).toEqual([
      expect.objectContaining({
        lessonId: "lesson-1",
        cancellationId: "cancellation-1",
        chargePercentage: 50,
        reasonCode: "late_cancellation_individual",
      }),
    ]);
  });

  it("emits no event at all for a tutor-initiated cancellation", () => {
    const events = computeChargeableLessonEvents(
      [
        row({
          category: "tutor_request",
          canceledAt: new Date("2026-07-29T17:55:00.000Z"), // 5 minutes' notice
        }),
      ],
      new Map([["lesson-1", 1]]),
    );
    expect(events).toEqual([]);
  });

  it("emits no event for a cancellation with at least 8 hours' notice", () => {
    const events = computeChargeableLessonEvents(
      [row({ canceledAt: new Date("2026-07-29T10:00:00.000Z") })], // exactly 8h notice
      new Map([["lesson-1", 1]]),
    );
    expect(events).toEqual([]);
  });

  it("emits a 50% event for a student no-show on an individual lesson", () => {
    const events = computeChargeableLessonEvents(
      [
        row({
          category: "no_show",
          status: "no_show_student",
          canceledAt: new Date("2026-07-29T18:10:00.000Z"), // recorded after lesson start
        }),
      ],
      new Map([["lesson-1", 1]]),
    );
    expect(events).toEqual([
      expect.objectContaining({ chargePercentage: 50, category: "no_show" }),
    ]);
  });

  it("emits no event for a tutor no-show", () => {
    const events = computeChargeableLessonEvents(
      [
        row({
          category: "no_show",
          status: "no_show_tutor",
          canceledAt: new Date("2026-07-29T18:10:00.000Z"),
        }),
      ],
      new Map([["lesson-1", 1]]),
    );
    expect(events).toEqual([]);
  });

  it("emits a 100% event for a group-lesson absence even with advance notice", () => {
    const events = computeChargeableLessonEvents(
      [
        row({
          lessonId: "lesson-group",
          canceledAt: new Date("2026-07-27T18:00:00.000Z"), // 48h notice
        }),
      ],
      new Map([["lesson-group", 3]]), // 3 student participants -> group
    );
    expect(events).toEqual([
      expect.objectContaining({
        lessonId: "lesson-group",
        lessonKind: "group",
        chargePercentage: 100,
        reasonCode: "group_absence_full_charge",
      }),
    ]);
  });

  it("emits no event for a trial lesson regardless of notice", () => {
    const events = computeChargeableLessonEvents(
      [row({ isTrial: true, canceledAt: new Date("2026-07-29T17:59:00.000Z") })],
      new Map([["lesson-1", 1]]),
    );
    expect(events).toEqual([]);
  });

  it("filters a mixed batch, keeping only chargeable rows and preserving their fields", () => {
    const rows: CancellationWithLessonRow[] = [
      row({
        cancellationId: "c-late",
        lessonId: "l-late",
        canceledAt: new Date("2026-07-29T16:00:00.000Z"),
      }),
      row({ cancellationId: "c-tutor", lessonId: "l-tutor", category: "tutor_request" }),
      row({
        cancellationId: "c-advance",
        lessonId: "l-advance",
        canceledAt: new Date("2026-07-20T00:00:00.000Z"),
      }),
    ];
    const events = computeChargeableLessonEvents(
      rows,
      new Map([
        ["l-late", 1],
        ["l-tutor", 1],
        ["l-advance", 1],
      ]),
    );
    expect(events.map((event) => event.lessonId)).toEqual(["l-late"]);
    expect(events[0]).toMatchObject({
      cancellationId: "c-late",
      tutorStudentAssignmentId: "assignment-1",
      canceledByUserId: "parent-user-1",
      chargePercentage: 50,
    });
  });

  it("treats a lesson missing from the participant-count map as individual (defensive default)", () => {
    const events = computeChargeableLessonEvents(
      [row({ canceledAt: new Date("2026-07-29T15:00:00.000Z") })],
      new Map(), // no entry for "lesson-1"
    );
    expect(events).toEqual([
      expect.objectContaining({ lessonKind: "individual", chargePercentage: 50 }),
    ]);
  });
});
