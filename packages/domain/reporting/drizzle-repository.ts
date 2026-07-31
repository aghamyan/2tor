import {
  assessmentAttempts,
  assessments,
  assessmentVersions,
  assignmentSubmissions,
  attendance,
  auditEvents,
  availabilityExceptions,
  learningPlanItems,
  learningPlans,
  lessonCharges,
  lessonFeedback,
  lessonParticipants,
  lessons,
  milestones,
  paymentTransactions,
  projectMembers,
  refunds,
  rubricScores,
  supportTickets,
  tutorAvailability,
  tutorEarningEntries,
  type Database,
} from "@app/db";
import { and, asc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { ulid } from "ulid";
import { FUNNEL_STAGES } from "./models";
import type {
  FunnelEventFact,
  ReportingFactSet,
  ReportingRepository,
  ReportingSnapshot,
  ReportPeriod,
} from "./models";

const FUNNEL_ACTION_PREFIX = "reporting.funnel.";
const SELF_REPORT_ACTION = "reporting.academic.school_performance_self_reported";
const SNAPSHOT_ACTION = "reporting.snapshot.generated";
const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1_000;

function numeric(value: string | number | bigint | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
}

function normalizedPercent(
  value: string | number | null,
  maximum: string | number | null,
): number | null {
  const score = numeric(value);
  const max = numeric(maximum);
  return score === null || max === null || max <= 0 ? null : (score / max) * 100;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eachUtcDay(period: ReportPeriod): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(
    Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), period.start.getUTCDate()),
  );
  while (cursor < period.end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

type AvailabilityRow = typeof tutorAvailability.$inferSelect;
type ExceptionRow = typeof availabilityExceptions.$inferSelect;

function capacityFacts(
  period: ReportPeriod,
  availability: readonly AvailabilityRow[],
  exceptions: readonly ExceptionRow[],
): ReportingFactSet["capacity"] {
  return eachUtcDay(period).map((day) => {
    const dayText = dateOnly(day);
    const recurringForDay = availability.filter(
      (slot) =>
        slot.dayOfWeek === day.getUTCDay() &&
        (!slot.effectiveFrom || slot.effectiveFrom <= dayText) &&
        (!slot.effectiveTo || slot.effectiveTo >= dayText),
    );
    let availableMinutes = recurringForDay.reduce(
      (total, slot) => total + Math.max(0, slot.endMinute - slot.startMinute),
      0,
    );
    for (const exception of exceptions.filter((item) => item.date === dayText)) {
      const start = exception.startMinute;
      const end = exception.endMinute;
      if (exception.type === "extra_availability" && start !== null && end !== null) {
        availableMinutes += Math.max(0, end - start);
      } else if (exception.type === "unavailable") {
        if (start === null || end === null) {
          availableMinutes -= recurringForDay
            .filter((slot) => slot.tutorProfileId === exception.tutorProfileId)
            .reduce((total, slot) => total + Math.max(0, slot.endMinute - slot.startMinute), 0);
        } else {
          availableMinutes -= Math.max(0, end - start);
        }
      }
    }
    return { occurredAt: day, availableMinutes: Math.max(0, availableMinutes) };
  });
}

function isSnapshot(value: unknown): value is ReportingSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1
  );
}

function funnelEventFromAudit(
  row: Pick<typeof auditEvents.$inferSelect, "action" | "resourceId" | "createdAt" | "newValue">,
): FunnelEventFact | null {
  const stage = row.action.slice(FUNNEL_ACTION_PREFIX.length);
  if (!FUNNEL_STAGES.includes(stage as (typeof FUNNEL_STAGES)[number]) || !row.resourceId)
    return null;
  const storedAt =
    typeof row.newValue === "object" &&
    row.newValue !== null &&
    "occurredAt" in row.newValue &&
    typeof row.newValue.occurredAt === "string"
      ? new Date(row.newValue.occurredAt)
      : row.createdAt;
  if (Number.isNaN(storedAt.getTime())) return null;
  return {
    subjectKey: row.resourceId,
    stage: stage as FunnelEventFact["stage"],
    occurredAt: storedAt,
  };
}

export function createDrizzleReportingRepository(database: Database): ReportingRepository {
  return {
    async loadFacts(period) {
      const [
        lessonRows,
        ticketRows,
        paymentRows,
        refundRows,
        attemptRows,
        milestoneRows,
        planRows,
        rubricSubmissionRows,
        rubricProjectRows,
        availabilityRows,
        exceptionRows,
        eventRows,
        selfReportRows,
      ] = await Promise.all([
        database
          .select()
          .from(lessons)
          .where(
            and(
              gte(lessons.scheduledStartAt, period.start),
              lt(lessons.scheduledStartAt, period.end),
            ),
          ),
        database
          .select()
          .from(supportTickets)
          .where(
            and(
              gte(supportTickets.createdAt, period.start),
              lt(supportTickets.createdAt, period.end),
            ),
          ),
        database
          .select()
          .from(paymentTransactions)
          .where(
            and(
              gte(paymentTransactions.createdAt, period.start),
              lt(paymentTransactions.createdAt, period.end),
            ),
          ),
        database
          .select()
          .from(refunds)
          .where(and(gte(refunds.createdAt, period.start), lt(refunds.createdAt, period.end))),
        database
          .select({
            studentKey: assessmentAttempts.studentProfileId,
            subjectKey: assessments.subjectId,
            kind: assessments.type,
            measuredAt: assessmentAttempts.submittedAt,
            score: assessmentAttempts.score,
            maxScore: assessmentAttempts.maxScore,
          })
          .from(assessmentAttempts)
          .innerJoin(
            assessmentVersions,
            eq(assessmentVersions.id, assessmentAttempts.assessmentVersionId),
          )
          .innerJoin(assessments, eq(assessments.id, assessmentVersions.assessmentId))
          .where(
            and(
              gte(assessmentAttempts.submittedAt, period.start),
              lt(assessmentAttempts.submittedAt, period.end),
            ),
          ),
        database
          .select()
          .from(milestones)
          .where(
            and(gte(milestones.updatedAt, period.start), lt(milestones.updatedAt, period.end)),
          ),
        database.select().from(learningPlans).where(eq(learningPlans.status, "active")),
        database
          .select({
            studentKey: assignmentSubmissions.studentProfileId,
            criterionKey: rubricScores.criterionKey,
            measuredAt: rubricScores.scoredAt,
            score: rubricScores.scoreValue,
            maxScore: rubricScores.maxValue,
          })
          .from(rubricScores)
          .innerJoin(assignmentSubmissions, eq(assignmentSubmissions.id, rubricScores.submissionId))
          .where(
            and(gte(rubricScores.scoredAt, period.start), lt(rubricScores.scoredAt, period.end)),
          ),
        database
          .select({
            studentKey: projectMembers.studentProfileId,
            criterionKey: rubricScores.criterionKey,
            measuredAt: rubricScores.scoredAt,
            score: rubricScores.scoreValue,
            maxScore: rubricScores.maxValue,
          })
          .from(rubricScores)
          .innerJoin(projectMembers, eq(projectMembers.projectId, rubricScores.projectId))
          .where(
            and(gte(rubricScores.scoredAt, period.start), lt(rubricScores.scoredAt, period.end)),
          ),
        database.select().from(tutorAvailability),
        database
          .select()
          .from(availabilityExceptions)
          .where(
            and(
              gte(availabilityExceptions.date, dateOnly(period.start)),
              lt(availabilityExceptions.date, dateOnly(period.end)),
            ),
          ),
        database
          .select({
            action: auditEvents.action,
            resourceId: auditEvents.resourceId,
            createdAt: auditEvents.createdAt,
            newValue: auditEvents.newValue,
          })
          .from(auditEvents)
          .where(
            and(
              gte(auditEvents.createdAt, new Date(period.start.getTime() - LOOKBACK_MS)),
              lt(auditEvents.createdAt, period.end),
              or(
                ...FUNNEL_STAGES.map((stage) =>
                  eq(auditEvents.action, `${FUNNEL_ACTION_PREFIX}${stage}`),
                ),
              ),
            ),
          )
          .orderBy(asc(auditEvents.createdAt)),
        database
          .select({
            resourceId: auditEvents.resourceId,
            createdAt: auditEvents.createdAt,
            newValue: auditEvents.newValue,
          })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.action, SELF_REPORT_ACTION),
              gte(auditEvents.createdAt, period.start),
              lt(auditEvents.createdAt, period.end),
            ),
          ),
      ]);

      const lessonIds = lessonRows.map((lesson) => lesson.id);
      const [attendanceRows, participantRows, feedbackRows, chargeRows, earningRows] =
        lessonIds.length === 0
          ? ([[], [], [], [], []] as const)
          : await Promise.all([
              database.select().from(attendance).where(inArray(attendance.lessonId, lessonIds)),
              database
                .select()
                .from(lessonParticipants)
                .where(inArray(lessonParticipants.lessonId, lessonIds)),
              database
                .select()
                .from(lessonFeedback)
                .where(inArray(lessonFeedback.lessonId, lessonIds)),
              database
                .select()
                .from(lessonCharges)
                .where(inArray(lessonCharges.lessonId, lessonIds)),
              database
                .select()
                .from(tutorEarningEntries)
                .where(inArray(tutorEarningEntries.lessonId, lessonIds)),
            ]);
      const planIds = planRows.map((plan) => plan.id);
      const planItemRows =
        planIds.length === 0
          ? []
          : await database
              .select()
              .from(learningPlanItems)
              .where(inArray(learningPlanItems.learningPlanId, planIds));

      const lessonFacts = lessonRows.map((lesson) => {
        const studentAttendance = attendanceRows.filter((row) => row.lessonId === lesson.id);
        const tutorParticipants = participantRows.filter(
          (row) => row.lessonId === lesson.id && row.role === "tutor",
        );
        const publishedFeedback = feedbackRows.some(
          (row) =>
            row.lessonId === lesson.id && (row.status === "published" || row.status === "revised"),
        );
        const charge = chargeRows.find(
          (row) => row.lessonId === lesson.id && row.status === "captured",
        );
        const earnings = earningRows.filter(
          (row) => row.lessonId === lesson.id && row.status !== "voided",
        );
        const costCurrencies = new Set(earnings.map((row) => row.currency));
        const tutorCost =
          charge &&
          costCurrencies.size <= 1 &&
          (!costCurrencies.size || costCurrencies.has(charge.currency))
            ? earnings.reduce((total, row) => total + Number(row.amountMinor), 0)
            : null;
        return {
          lessonKey: lesson.id,
          occurredAt: lesson.scheduledStartAt,
          status: lesson.status,
          scheduledMinutes: Math.max(
            0,
            (lesson.scheduledEndAt.getTime() - lesson.scheduledStartAt.getTime()) / 60_000,
          ),
          expectedStudentCount: Math.max(1, studentAttendance.length),
          attendedStudentCount: studentAttendance.filter(
            (row) => row.status === "present" || row.status === "late",
          ).length,
          tutorExpected: tutorParticipants.length > 0,
          tutorAttended: tutorParticipants.some((row) => row.joinedAt !== null),
          hasPublishedFeedback: publishedFeedback,
          revenueMinor: charge ? Number(charge.amountMinor) : null,
          tutorCostMinor: tutorCost,
          currency: charge?.currency ?? null,
        };
      });

      const planProgress = planRows.map((plan) => {
        const items = planItemRows.filter((item) => item.learningPlanId === plan.id);
        return {
          studentKey: plan.studentProfileId,
          occurredAt: new Date(period.end.getTime() - 1),
          completedItems: items.filter((item) => item.status === "completed").length,
          totalItems: items.length,
        };
      });

      const rubricMeasurements = [...rubricSubmissionRows, ...rubricProjectRows].flatMap((row) => {
        const value = normalizedPercent(row.score, row.maxScore);
        return value === null
          ? []
          : [
              {
                studentKey: row.studentKey,
                criterionKey: row.criterionKey,
                measuredAt: row.measuredAt,
                percent: value,
              },
            ];
      });

      return {
        funnelEvents: eventRows.flatMap((row) => {
          const event = funnelEventFromAudit(row);
          return event ? [event] : [];
        }),
        lessons: lessonFacts,
        capacity: capacityFacts(period, availabilityRows, exceptionRows),
        supportTickets: ticketRows.map((ticket) => ({
          openedAt: ticket.createdAt,
          resolvedAt:
            ticket.status === "resolved" || ticket.status === "closed" ? ticket.updatedAt : null,
        })),
        paymentAttempts: paymentRows
          .filter((payment) => payment.type === "charge")
          .map((payment) => ({
            occurredAt: payment.processedAt ?? payment.createdAt,
            status: payment.status,
          })),
        refunds: refundRows.map((refund) => ({
          occurredAt: refund.processedAt ?? refund.createdAt,
          status: refund.status,
        })),
        academicMeasurements: attemptRows.flatMap((attempt) => {
          const value = normalizedPercent(attempt.score, attempt.maxScore);
          return value === null || attempt.measuredAt === null
            ? []
            : [
                {
                  studentKey: attempt.studentKey,
                  subjectKey: attempt.subjectKey,
                  measuredAt: attempt.measuredAt,
                  percent: value,
                  kind:
                    attempt.kind === "diagnostic"
                      ? ("diagnostic" as const)
                      : ("assessment" as const),
                },
              ];
        }),
        milestones: milestoneRows.map((milestone) => ({
          studentKey: milestone.studentProfileId,
          occurredAt: milestone.updatedAt,
          completed: milestone.status === "completed",
        })),
        planProgress,
        rubricMeasurements,
        schoolPerformance: selfReportRows.flatMap((row) => {
          if (
            !row.resourceId ||
            typeof row.newValue !== "object" ||
            row.newValue === null ||
            !("percent" in row.newValue) ||
            typeof row.newValue.percent !== "number" ||
            row.newValue.percent < 0 ||
            row.newValue.percent > 100
          ) {
            return [];
          }
          return [
            {
              studentKey: row.resourceId,
              measuredAt: row.createdAt,
              percent: row.newValue.percent,
            },
          ];
        }),
      } satisfies ReportingFactSet;
    },

    async getStoredReport(reportKey) {
      const [row] = await database
        .select({ newValue: auditEvents.newValue })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.action, SNAPSHOT_ACTION),
            eq(auditEvents.resourceType, "reporting_snapshot"),
            eq(auditEvents.resourceId, reportKey),
          ),
        )
        .limit(1);
      return row && isSnapshot(row.newValue) ? row.newValue : null;
    },

    async saveReport(reportKey, snapshot) {
      if (await this.getStoredReport(reportKey)) return;
      await database.insert(auditEvents).values({
        id: ulid(),
        actorUserId: null,
        action: SNAPSHOT_ACTION,
        resourceType: "reporting_snapshot",
        resourceId: reportKey,
        reason: "Scheduled privacy-preserving aggregate report generation.",
        newValue: snapshot,
      });
    },

    async recordFunnelEvent(event) {
      await database.insert(auditEvents).values({
        id: ulid(),
        actorUserId: null,
        action: `${FUNNEL_ACTION_PREFIX}${event.stage}`,
        resourceType: "reporting_funnel_subject",
        resourceId: event.subjectKey,
        reason: "First-party product funnel measurement.",
        newValue: {
          schemaVersion: 1,
          occurredAt: event.occurredAt.toISOString(),
          firstPartyOnly: true,
        },
      });
    },
  };
}
