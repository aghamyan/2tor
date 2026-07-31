/**
 * Pure cancellation/no-show charge policy (spec §5.4). No I/O, no DB — this is the single source
 * of truth `cancelLesson`/`recordNoShow` (services.ts, at write time) and
 * `getChargeableLessonEvents` (chargeable-events.ts, at read time, recomputed for Payments) both
 * call, so the two can never drift apart.
 *
 * The `cancellations` table (packages/db/src/schema/scheduling.ts) only stores a boolean
 * `charge_applied`, not a percentage — recomputing the percentage here from stored facts (instead
 * of persisting it) is deliberate: it avoids a schema change this module isn't allowed to make,
 * and it means a future policy-config change can be reflected by re-running this function over
 * historical rows rather than requiring a backfill.
 */

export type CancellationCategory =
  "parent_request" | "tutor_request" | "admin_action" | "no_show" | "technical_issue" | "other";

export type CancellationInitiator = "parent" | "student" | "tutor" | "admin" | "system";

export type LessonKind = "individual" | "group" | "trial";

export interface CancellationPolicyConfig {
  /** Hours of notice at/above which an individual-lesson cancellation is free. Spec default: 8. */
  freeWindowHours: number;
  /** Charge percentage for a late (<freeWindowHours) individual-lesson cancellation. Spec default: 50. */
  lateCancelPercent: number;
  /** Charge percentage for a group-lesson absence, regardless of notice. Spec default: 100. */
  groupAbsencePercent: number;
}

/** Spec §5.4 defaults. Override at the call site for an admin-configurable policy (see services.ts). */
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyConfig = {
  freeWindowHours: 8,
  lateCancelPercent: 50,
  groupAbsencePercent: 100,
};

export interface CancellationChargeInput {
  category: CancellationCategory;
  initiatedBy: CancellationInitiator;
  lessonKind: LessonKind;
  /**
   * Hours of notice between the cancellation/no-show being recorded and the lesson's scheduled
   * start. Negative or zero for a no-show (recorded at or after the lesson started).
   */
  hoursBeforeLesson: number;
}

export type CancellationReasonCode =
  | "advance_cancellation_no_charge"
  | "late_cancellation_individual"
  | "late_cancellation_trial_no_charge"
  | "group_absence_full_charge"
  | "tutor_initiated_no_charge"
  | "technical_issue_no_charge";

export interface CancellationChargeResult {
  chargeable: boolean;
  /** 0 when not chargeable; otherwise the percentage of the lesson price owed (e.g. 50, 100). */
  percentage: number;
  reasonCode: CancellationReasonCode;
}

const noCharge = (reasonCode: CancellationReasonCode): CancellationChargeResult => ({
  chargeable: false,
  percentage: 0,
  reasonCode,
});

/**
 * Computes whether — and how much of — a lesson is chargeable given who cancelled/no-showed, why,
 * what kind of lesson it was, and how much notice was given. Deliberately stateless: every input
 * is a plain value derived from stored rows, never a live lookup, so this stays trivially unit
 * testable and safe to re-run for historical recomputation.
 *
 * Precedence (spec §5.4, applied in this order):
 * 1. Tutor-initiated (cancellation or no-show): never chargeable to the student — "no student
 *    charge; replacement lesson or credit." Credit/replacement issuance is Payments' (D14)
 *    concern, not this module's.
 * 2. A platform-caused technical issue: never chargeable — not the family's fault.
 * 3. Trial lessons: never chargeable — spec §2.3 offers the trial free.
 * 4. Group lessons: a student absence (cancellation or no-show) is a full charge regardless of
 *    notice, because the class runs for the other students either way — there's no "the tutor's
 *    slot went unused" harm the notice window is meant to price in.
 * 5. Individual lessons: a no-show is "treated as late cancellation" (spec §5.4) regardless of the
 *    computed notice window. Otherwise, notice at/above `freeWindowHours` is free; below it is a
 *    `lateCancelPercent` charge.
 */
export function computeCancellationCharge(
  input: CancellationChargeInput,
  config: CancellationPolicyConfig = DEFAULT_CANCELLATION_POLICY,
): CancellationChargeResult {
  if (input.initiatedBy === "tutor") {
    return noCharge("tutor_initiated_no_charge");
  }
  if (input.category === "technical_issue") {
    return noCharge("technical_issue_no_charge");
  }
  if (input.lessonKind === "trial") {
    return noCharge("late_cancellation_trial_no_charge");
  }
  if (input.lessonKind === "group") {
    return {
      chargeable: true,
      percentage: config.groupAbsencePercent,
      reasonCode: "group_absence_full_charge",
    };
  }

  // Individual lesson: a no-show is always treated as a late cancellation, independent of the
  // computed notice window (a no-show inherently means the tutor's slot could not be reused).
  const isLate = input.category === "no_show" || input.hoursBeforeLesson < config.freeWindowHours;
  if (!isLate) {
    return noCharge("advance_cancellation_no_charge");
  }
  return {
    chargeable: true,
    percentage: config.lateCancelPercent,
    reasonCode: "late_cancellation_individual",
  };
}

/** Hours between `canceledAt` and `scheduledStartAt` (can be negative for a no-show recorded late). */
export function hoursBeforeLesson(scheduledStartAt: Date, canceledAt: Date): number {
  return (scheduledStartAt.getTime() - canceledAt.getTime()) / (60 * 60 * 1000);
}

/** Derives lesson kind from stored facts — there is no dedicated column, per the module docstring in chargeable-events.ts. */
export function lessonKindFrom(input: {
  isTrial: boolean;
  studentParticipantCount: number;
}): LessonKind {
  if (input.isTrial) return "trial";
  return input.studentParticipantCount > 1 ? "group" : "individual";
}

/** Maps a cancellation's category to the initiator the policy needs. `no_show` defers to which party the lesson status blames. */
export function initiatorFromCategory(
  category: CancellationCategory,
  noShowParty: "student" | "tutor" | null,
): CancellationInitiator {
  switch (category) {
    case "tutor_request":
      return "tutor";
    case "parent_request":
      return "parent";
    case "admin_action":
      return "admin";
    case "no_show":
      return noShowParty === "tutor" ? "tutor" : "student";
    case "technical_issue":
    case "other":
      return "system";
  }
}
