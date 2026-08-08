import { SESSION_COOKIE_NAME, authorize } from "@app/auth";
import { cookies } from "next/headers";

import {
  administrationRequestContext,
  listModerationQueue,
  listOpenDisputes,
  listOpenSupportTickets,
  listPendingTutorVerifications,
  listPendingUserApprovals,
  listPrivacyRequests,
} from "../../../../../../packages/domain/administration/index";
import {
  SchedulingError,
  type LessonRecord,
} from "../../../../../../packages/domain/scheduling/index";
import { loadConsentOverview } from "../../consent/queries";
import { currentAcademicContext } from "../../academics/context";
import { loadFamilyOverview } from "../../families/queries";
import { currentFamilyContext } from "../../families/context";
import { loadPaymentDashboard } from "../../payments/queries";
import { loadPayoutDashboard } from "../../payouts/queries";
import { currentSchedulingContext } from "../../scheduling/context";
import { loadLessonDetail, loadRecentLessons, loadUpcomingLessons } from "../../scheduling/queries";
import type { ParentVisibleFeedback } from "../../../../../../packages/domain/academics/models";

function futureLessons(lessons: readonly LessonRecord[], now: Date): LessonRecord[] {
  return lessons
    .filter(
      (lesson) =>
        lesson.scheduledStartAt >= now &&
        lesson.status !== "canceled" &&
        lesson.status !== "rescheduled",
    )
    .sort((left, right) => left.scheduledStartAt.getTime() - right.scheduledStartAt.getTime());
}

/**
 * `loadUpcomingLessons()` returns list rows without the join link (the meeting record is a
 * separate one-to-one join in the scheduling domain). This re-reads the single next lesson
 * through the module's own per-record export rather than a list-shaped one, bounded to exactly
 * the one row the dashboard actually needs. `listLessonsForActor` (behind `loadUpcomingLessons`)
 * and `getLessonDetail` (behind `loadLessonDetail`) run different authorization checks — a scope
 * resolution versus a per-record access check — so they are not guaranteed to agree on every row.
 * A `FORBIDDEN` disagreement here costs the join button, mirroring how `loadUpcomingLessons`
 * itself treats `FORBIDDEN` as "nothing to show" rather than an error; `UNAUTHENTICATED` still
 * reaches `redirect("/login")` inside `loadLessonDetail`, which this does not swallow.
 */
async function resolveNextLessonJoinUrl(lesson: LessonRecord | null): Promise<string | null> {
  if (!lesson) return null;
  try {
    const detail = await loadLessonDetail(lesson.id);
    return detail.zoom?.joinUrl ?? null;
  } catch (error: unknown) {
    if (error instanceof SchedulingError) return null;
    throw error;
  }
}

function dateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export interface ParentDashboardSummary {
  nextLesson: LessonRecord | null;
  nextLessonJoinUrl: string | null;
  studentCount: number;
  actionCount: number;
  openInvoiceCount: number;
  completedLessonCount: number;
  children: Array<{
    id: string;
    preferredName: string;
    gradeLevel: string | null;
    completedLessonCount: number;
    feedback: ParentVisibleFeedback[];
  }>;
}

export async function loadParentDashboardSummary(
  now = new Date(),
): Promise<ParentDashboardSummary> {
  // Public, independently authorized module queries run in parallel, keeping this request
  // bounded by the slowest module rather than the sum of their response times.
  const [lessons, recentLessons, family, consent, payment, academicContext, schedulingContext] =
    await Promise.all([
      loadUpcomingLessons(),
      loadRecentLessons(),
      loadFamilyOverview(),
      loadConsentOverview(),
      loadPaymentDashboard(),
      currentAcademicContext(),
      currentSchedulingContext(),
    ]);
  const nextLesson = futureLessons(lessons, now)[0] ?? null;
  const overdueInvoices = payment.invoices.filter(
    (invoice) =>
      invoice.status === "open" &&
      invoice.dueAt !== null &&
      invoice.dueAt.getTime() < now.getTime(),
  );
  const incompleteConsent = consent.items.filter((student) => !student.hasValidConsent);
  const completedLessons = recentLessons.filter((lesson) => lesson.status === "completed");
  const assignments = await Promise.all(
    completedLessons.map((lesson) =>
      schedulingContext.database.findAssignmentById(lesson.tutorStudentAssignmentId),
    ),
  );
  const completedByStudent = new Map<string, number>();
  for (const assignment of assignments) {
    if (!assignment) continue;
    completedByStudent.set(
      assignment.studentProfileId,
      (completedByStudent.get(assignment.studentProfileId) ?? 0) + 1,
    );
  }
  const children = await Promise.all(
    family.students.map(async (student) => {
      const records = await academicContext.database.listFeedbackForStudent(student.id);
      const feedback = records
        .filter(
          (record) =>
            (record.status === "published" || record.status === "revised") &&
            record.visibleToParent,
        )
        .map(({ staffOnlyNote, ...visible }) => {
          void staffOnlyNote;
          return visible;
        })
        .slice(0, 6);
      return {
        id: student.id,
        preferredName: student.preferredName,
        gradeLevel: student.gradeLevel,
        completedLessonCount: completedByStudent.get(student.id) ?? feedback.length,
        feedback,
      };
    }),
  );
  const knownCompletedLessonCount = Math.max(
    completedLessons.length,
    children.reduce((count, child) => count + child.feedback.length, 0),
  );

  return {
    nextLesson,
    nextLessonJoinUrl: await resolveNextLessonJoinUrl(nextLesson),
    studentCount: family.students.length,
    actionCount: overdueInvoices.length + incompleteConsent.length,
    openInvoiceCount: payment.invoices.filter((invoice) => invoice.status === "open").length,
    completedLessonCount: knownCompletedLessonCount,
    children,
  };
}

export interface StudentDashboardSummary {
  nextLesson: LessonRecord | null;
  nextLessonJoinUrl: string | null;
  todayLessonCount: number;
  weekLessonCount: number;
}

export async function loadStudentDashboardSummary(
  now = new Date(),
): Promise<StudentDashboardSummary> {
  const lessons = futureLessons(await loadUpcomingLessons(), now);
  const nextLesson = lessons[0] ?? null;
  const todayLessonCount = lessons.filter(
    (lesson) =>
      dateKey(lesson.scheduledStartAt, lesson.timezoneAtBooking) ===
      dateKey(now, lesson.timezoneAtBooking),
  ).length;
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  return {
    nextLesson,
    nextLessonJoinUrl: await resolveNextLessonJoinUrl(nextLesson),
    todayLessonCount,
    weekLessonCount: lessons.filter((lesson) => lesson.scheduledStartAt < weekEnd).length,
  };
}

export interface TutorDashboardSummary {
  nextLesson: LessonRecord | null;
  nextLessonJoinUrl: string | null;
  todayLessonCount: number;
  weekLessonCount: number;
  expectedTotals: Array<{ amountMinor: number; currency: "USD" | "AMD" }>;
  feedbackQueue: Array<{
    lessonId: string;
    studentProfileId: string;
    studentName: string;
    scheduledStartAt: Date;
    timezoneAtBooking: string;
  }>;
  publishedFeedbackCount: number;
}

export async function loadTutorDashboardSummary(now = new Date()): Promise<TutorDashboardSummary> {
  const [lessonRows, recentLessonRows, payout, academicContext, schedulingContext, familyContext] =
    await Promise.all([
      loadUpcomingLessons(),
      loadRecentLessons(60),
      loadPayoutDashboard(),
      currentAcademicContext(),
      currentSchedulingContext(),
      currentFamilyContext(),
    ]);
  const lessons = futureLessons(lessonRows, now);
  const nextLesson = lessons[0] ?? null;
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const completedLessons = recentLessonRows
    .filter((lesson) => lesson.status === "completed")
    .sort((left, right) => right.scheduledStartAt.getTime() - left.scheduledStartAt.getTime());
  const queueRows = await Promise.all(
    completedLessons.map(async (lesson) => {
      const assignment = await schedulingContext.database.findAssignmentById(
        lesson.tutorStudentAssignmentId,
      );
      if (!assignment) return null;
      const [student, feedback] = await Promise.all([
        familyContext.database.findStudentById(assignment.studentProfileId),
        academicContext.database.listFeedbackForStudent(assignment.studentProfileId),
      ]);
      return {
        lesson,
        assignment,
        student,
        hasFeedback: feedback.some(
          (record) => record.lessonId === lesson.id && record.status !== "draft",
        ),
      };
    }),
  );
  const publishedFeedbackCount = queueRows.filter((row) => row?.hasFeedback).length;
  const feedbackQueue = queueRows
    .flatMap((row) => {
      if (!row || row.hasFeedback) return [];
      return [
        {
          lessonId: row.lesson.id,
          studentProfileId: row.assignment.studentProfileId,
          studentName: row.student?.preferredName ?? "Student",
          scheduledStartAt: row.lesson.scheduledStartAt,
          timezoneAtBooking: row.lesson.timezoneAtBooking,
        },
      ];
    })
    .slice(0, 4);
  return {
    nextLesson,
    nextLessonJoinUrl: await resolveNextLessonJoinUrl(nextLesson),
    todayLessonCount: lessons.filter(
      (lesson) =>
        dateKey(lesson.scheduledStartAt, lesson.timezoneAtBooking) ===
        dateKey(now, lesson.timezoneAtBooking),
    ).length,
    weekLessonCount: lessons.filter((lesson) => lesson.scheduledStartAt < weekEnd).length,
    expectedTotals: payout.kind === "tutor" ? payout.summary.expectedTotals : [],
    feedbackQueue,
    publishedFeedbackCount,
  };
}

export interface FinanceDashboardSummary {
  revenue: Array<{ amountMinor: number; currency: "USD" | "AMD" }>;
  failedPaymentCount: number;
  pendingPayoutCount: number;
  unreconciledBatchCount: number;
}

export async function loadFinanceDashboardSummary(): Promise<FinanceDashboardSummary> {
  const [payment, payout] = await Promise.all([loadPaymentDashboard(), loadPayoutDashboard()]);
  return {
    revenue: payment.reports.map((report) => ({
      amountMinor: report.revenueMinor,
      currency: report.currency,
    })),
    failedPaymentCount: payment.transactions.filter(
      (transaction) => transaction.status === "failed",
    ).length,
    pendingPayoutCount:
      payout.kind === "finance"
        ? payout.ledger.filter((entry) => entry.status === "pending").length
        : 0,
    unreconciledBatchCount:
      payout.kind === "finance"
        ? payout.batches.filter((batch) => !batch.reconciliation.reconciled).length
        : 0,
  };
}

export interface AdminDashboardSummary {
  pendingFamilyCount: number;
  pendingTutorCount: number;
  learningSafetyCount: number;
  supportAndPrivacyCount: number;
}

export async function loadAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const id = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const context = await administrationRequestContext(id);
  const decision = authorize(context.actor, "admin.approve_user", { kind: "admin_action" });
  if (!decision.allowed) {
    return {
      pendingFamilyCount: 0,
      pendingTutorCount: 0,
      learningSafetyCount: 0,
      supportAndPrivacyCount: 0,
    };
  }
  const [families, tutors, disputes, moderation, support, privacy] = await Promise.all([
    listPendingUserApprovals(context.database, context.actor),
    listPendingTutorVerifications(context.database, context.actor),
    listOpenDisputes(context.database, context.actor),
    listModerationQueue(context.database, context.actor),
    listOpenSupportTickets(context.database, context.actor),
    listPrivacyRequests(context.database, context.actor),
  ]);
  return {
    pendingFamilyCount: families.length,
    pendingTutorCount: tutors.length,
    learningSafetyCount: disputes.length + moderation.length,
    supportAndPrivacyCount: support.length + privacy.length,
  };
}
