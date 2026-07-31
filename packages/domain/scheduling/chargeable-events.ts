import { cancellations, lessonParticipants, lessons, type Database } from "@app/db";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";

import {
  computeCancellationCharge,
  DEFAULT_CANCELLATION_POLICY,
  hoursBeforeLesson,
  initiatorFromCategory,
  lessonKindFrom,
  type CancellationCategory,
  type CancellationPolicyConfig,
  type LessonKind,
} from "./cancellation-policy";

/**
 * The Payments↔Scheduling contract (see README.md "Chargeable-event contract" for the full
 * writeup). Scheduling never inserts into `lesson_charges` or any other finance table; it only
 * ever answers "does this lesson currently owe a charge, and how much of it, and why."
 */
export interface ChargeableLessonEvent {
  lessonId: string;
  cancellationId: string;
  tutorStudentAssignmentId: string;
  lessonKind: LessonKind;
  category: CancellationCategory;
  /** Percentage of the lesson's price owed, e.g. 50 or 100. Always > 0 — zero-charge outcomes are never returned. */
  chargePercentage: number;
  reasonCode: string;
  scheduledStartAt: Date;
  canceledAt: Date;
  canceledByUserId: string;
}

export interface ChargeableLessonEventsFilter {
  /** Only cancellations recorded at or after this instant. Payments uses this to poll incrementally. */
  since?: Date;
  /** Restrict to specific lessons, e.g. when Payments is reconciling one invoice. */
  lessonIds?: readonly string[];
  limit?: number;
}

/** One `cancellations` row joined with the facts of its `lessons` row — the raw shape the DB query below produces. */
export interface CancellationWithLessonRow {
  cancellationId: string;
  lessonId: string;
  category: CancellationCategory;
  canceledAt: Date;
  canceledByUserId: string;
  scheduledStartAt: Date;
  isTrial: boolean;
  status:
    "scheduled" | "completed" | "canceled" | "no_show_student" | "no_show_tutor" | "rescheduled";
  tutorStudentAssignmentId: string;
}

/**
 * The pure map-and-filter core of `getChargeableLessonEvents`, split out specifically so it's
 * testable without a live Postgres connection (unlike the DB-querying wrapper below, which needs
 * `@app/db`'s `Database` type — see apps/web/tests/scheduling/chargeable-events.test.ts). This is
 * where acceptance criterion #2 ("<8h cancellation produces a 50% chargeable event; tutor
 * cancellation produces none") is actually verified at the level the criterion is written about —
 * the emitted event list, not just the underlying percentage or the `charge_applied` boolean.
 */
export function computeChargeableLessonEvents(
  rows: readonly CancellationWithLessonRow[],
  studentParticipantCounts: ReadonlyMap<string, number>,
  policy: CancellationPolicyConfig = DEFAULT_CANCELLATION_POLICY,
): ChargeableLessonEvent[] {
  const events: ChargeableLessonEvent[] = [];
  for (const row of rows) {
    const noShowParty =
      row.status === "no_show_tutor"
        ? "tutor"
        : row.status === "no_show_student"
          ? "student"
          : null;
    const initiatedBy = initiatorFromCategory(row.category, noShowParty);
    const lessonKind = lessonKindFrom({
      isTrial: row.isTrial,
      studentParticipantCount: studentParticipantCounts.get(row.lessonId) ?? 1,
    });
    const result = computeCancellationCharge(
      {
        category: row.category,
        initiatedBy,
        lessonKind,
        hoursBeforeLesson: hoursBeforeLesson(row.scheduledStartAt, row.canceledAt),
      },
      policy,
    );
    if (!result.chargeable) continue;
    events.push({
      lessonId: row.lessonId,
      cancellationId: row.cancellationId,
      tutorStudentAssignmentId: row.tutorStudentAssignmentId,
      lessonKind,
      category: row.category,
      chargePercentage: result.percentage,
      reasonCode: result.reasonCode,
      scheduledStartAt: row.scheduledStartAt,
      canceledAt: row.canceledAt,
      canceledByUserId: row.canceledByUserId,
    });
  }
  return events;
}

async function fetchStudentParticipantCounts(
  database: Database,
  lessonIds: readonly string[],
): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(lessonIds)];
  if (uniqueIds.length === 0) return new Map();
  const rows = await database
    .select({ lessonId: lessonParticipants.lessonId, count: sql<number>`count(*)` })
    .from(lessonParticipants)
    .where(
      and(inArray(lessonParticipants.lessonId, uniqueIds), eq(lessonParticipants.role, "student")),
    )
    .groupBy(lessonParticipants.lessonId);
  return new Map(rows.map((row) => [row.lessonId, Number(row.count)]));
}

/**
 * Read-only query Payments (D14) calls to learn which cancelled/no-show lessons owe a charge.
 * Recomputes the charge (via `computeCancellationCharge`) from stored facts on every call rather
 * than trusting a persisted flag — see cancellation-policy.ts's module docstring for why. Only
 * chargeable outcomes are returned; a tutor-initiated cancellation, for example, produces no row
 * here at all (not a zero-percent one) — Payments can treat "not present" as "not chargeable"
 * without inspecting a percentage.
 */
export async function getChargeableLessonEvents(
  database: Database,
  filter: ChargeableLessonEventsFilter = {},
  policy: CancellationPolicyConfig = DEFAULT_CANCELLATION_POLICY,
): Promise<ChargeableLessonEvent[]> {
  const conditions = [];
  if (filter.since) conditions.push(gte(cancellations.canceledAt, filter.since));
  if (filter.lessonIds && filter.lessonIds.length > 0) {
    conditions.push(inArray(cancellations.lessonId, [...filter.lessonIds]));
  }

  const rows = await database
    .select({
      cancellationId: cancellations.id,
      lessonId: cancellations.lessonId,
      category: cancellations.category,
      canceledAt: cancellations.canceledAt,
      canceledByUserId: cancellations.canceledByUserId,
      scheduledStartAt: lessons.scheduledStartAt,
      isTrial: lessons.isTrial,
      status: lessons.status,
      tutorStudentAssignmentId: lessons.tutorStudentAssignmentId,
    })
    .from(cancellations)
    .innerJoin(lessons, eq(lessons.id, cancellations.lessonId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(cancellations.canceledAt))
    .limit(filter.limit ?? 500);

  if (rows.length === 0) return [];

  const studentCounts = await fetchStudentParticipantCounts(
    database,
    rows.map((row) => row.lessonId),
  );

  return computeChargeableLessonEvents(rows, studentCounts, policy);
}
