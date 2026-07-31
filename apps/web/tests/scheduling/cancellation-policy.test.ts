import { describe, expect, it } from "vitest";

import {
  computeCancellationCharge,
  hoursBeforeLesson,
  initiatorFromCategory,
  lessonKindFrom,
  type CancellationChargeInput,
} from "../../../../packages/domain/scheduling/cancellation-policy";

function individualLesson(
  overrides: Partial<CancellationChargeInput> = {},
): CancellationChargeInput {
  return {
    category: "parent_request",
    initiatedBy: "parent",
    lessonKind: "individual",
    hoursBeforeLesson: 24,
    ...overrides,
  };
}

describe("computeCancellationCharge — spec §5.4 defaults", () => {
  it("charges 50% for an individual lesson cancelled less than 8 hours before start", () => {
    const result = computeCancellationCharge(individualLesson({ hoursBeforeLesson: 3 }));
    expect(result).toEqual({
      chargeable: true,
      percentage: 50,
      reasonCode: "late_cancellation_individual",
    });
  });

  it("produces no chargeable event for a tutor-initiated cancellation, regardless of notice", () => {
    const lateCancel = computeCancellationCharge(
      individualLesson({ category: "tutor_request", initiatedBy: "tutor", hoursBeforeLesson: 0.5 }),
    );
    const advanceCancel = computeCancellationCharge(
      individualLesson({ category: "tutor_request", initiatedBy: "tutor", hoursBeforeLesson: 72 }),
    );
    expect(lateCancel).toEqual({
      chargeable: false,
      percentage: 0,
      reasonCode: "tutor_initiated_no_charge",
    });
    expect(advanceCancel).toEqual({
      chargeable: false,
      percentage: 0,
      reasonCode: "tutor_initiated_no_charge",
    });
  });

  it("charges nothing when cancelled 8 or more hours in advance", () => {
    expect(computeCancellationCharge(individualLesson({ hoursBeforeLesson: 8 }))).toEqual({
      chargeable: false,
      percentage: 0,
      reasonCode: "advance_cancellation_no_charge",
    });
    expect(computeCancellationCharge(individualLesson({ hoursBeforeLesson: 48 }))).toEqual({
      chargeable: false,
      percentage: 0,
      reasonCode: "advance_cancellation_no_charge",
    });
  });

  it("treats a student no-show as a late cancellation even with a large nominal notice window", () => {
    // hoursBeforeLesson can be negative for a no-show recorded after the lesson started, but the
    // rule must apply even if some caller passes a stale/positive value for a no_show category.
    const result = computeCancellationCharge(
      individualLesson({ category: "no_show", initiatedBy: "student", hoursBeforeLesson: -0.25 }),
    );
    expect(result).toEqual({
      chargeable: true,
      percentage: 50,
      reasonCode: "late_cancellation_individual",
    });
  });

  it("charges a group lesson absence in full regardless of notice", () => {
    const earlyNotice = computeCancellationCharge(
      individualLesson({ lessonKind: "group", hoursBeforeLesson: 72 }),
    );
    const noShow = computeCancellationCharge(
      individualLesson({
        lessonKind: "group",
        category: "no_show",
        initiatedBy: "student",
        hoursBeforeLesson: -1,
      }),
    );
    expect(earlyNotice).toEqual({
      chargeable: true,
      percentage: 100,
      reasonCode: "group_absence_full_charge",
    });
    expect(noShow).toEqual({
      chargeable: true,
      percentage: 100,
      reasonCode: "group_absence_full_charge",
    });
  });

  it("never charges a trial lesson", () => {
    const result = computeCancellationCharge(
      individualLesson({ lessonKind: "trial", hoursBeforeLesson: 0.1 }),
    );
    expect(result).toEqual({
      chargeable: false,
      percentage: 0,
      reasonCode: "late_cancellation_trial_no_charge",
    });
  });

  it("never charges a platform-caused technical issue", () => {
    const result = computeCancellationCharge(
      individualLesson({ category: "technical_issue", hoursBeforeLesson: 0.1 }),
    );
    expect(result).toEqual({
      chargeable: false,
      percentage: 0,
      reasonCode: "technical_issue_no_charge",
    });
  });

  it("honors a configured policy override", () => {
    const result = computeCancellationCharge(individualLesson({ hoursBeforeLesson: 5 }), {
      freeWindowHours: 4,
      lateCancelPercent: 25,
      groupAbsencePercent: 100,
    });
    expect(result).toEqual({
      chargeable: false,
      percentage: 0,
      reasonCode: "advance_cancellation_no_charge",
    });
    const lateResult = computeCancellationCharge(individualLesson({ hoursBeforeLesson: 3 }), {
      freeWindowHours: 4,
      lateCancelPercent: 25,
      groupAbsencePercent: 100,
    });
    expect(lateResult).toMatchObject({ chargeable: true, percentage: 25 });
  });
});

describe("hoursBeforeLesson", () => {
  it("computes positive hours for an on-time cancellation and negative for a no-show", () => {
    const scheduledStartAt = new Date("2026-07-29T18:00:00.000Z");
    expect(hoursBeforeLesson(scheduledStartAt, new Date("2026-07-29T10:00:00.000Z"))).toBe(8);
    expect(hoursBeforeLesson(scheduledStartAt, new Date("2026-07-29T18:30:00.000Z"))).toBe(-0.5);
  });
});

describe("lessonKindFrom", () => {
  it("derives trial, group, and individual from stored facts", () => {
    expect(lessonKindFrom({ isTrial: true, studentParticipantCount: 1 })).toBe("trial");
    expect(lessonKindFrom({ isTrial: false, studentParticipantCount: 1 })).toBe("individual");
    expect(lessonKindFrom({ isTrial: false, studentParticipantCount: 3 })).toBe("group");
  });
});

describe("initiatorFromCategory", () => {
  it("maps categories to initiators, resolving no_show via the lesson status party", () => {
    expect(initiatorFromCategory("tutor_request", null)).toBe("tutor");
    expect(initiatorFromCategory("parent_request", null)).toBe("parent");
    expect(initiatorFromCategory("admin_action", null)).toBe("admin");
    expect(initiatorFromCategory("no_show", "student")).toBe("student");
    expect(initiatorFromCategory("no_show", "tutor")).toBe("tutor");
    expect(initiatorFromCategory("technical_issue", null)).toBe("system");
    expect(initiatorFromCategory("other", null)).toBe("system");
  });
});
