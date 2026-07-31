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
import type { LessonRecord } from "../../../../../../packages/domain/scheduling/index";
import { loadConsentOverview } from "../../consent/queries";
import { loadFamilyOverview } from "../../families/queries";
import { loadPaymentDashboard } from "../../payments/queries";
import { loadPayoutDashboard } from "../../payouts/queries";
import { loadUpcomingLessons } from "../../scheduling/queries";

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
  studentCount: number;
  actionCount: number;
  openInvoiceCount: number;
}

export async function loadParentDashboardSummary(
  now = new Date(),
): Promise<ParentDashboardSummary> {
  // Public, independently authorized module queries run in parallel, keeping this request
  // bounded by the slowest module rather than the sum of their response times.
  const [lessons, family, consent, payment] = await Promise.all([
    loadUpcomingLessons(),
    loadFamilyOverview(),
    loadConsentOverview(),
    loadPaymentDashboard(),
  ]);
  const nextLesson = futureLessons(lessons, now)[0] ?? null;
  const overdueInvoices = payment.invoices.filter(
    (invoice) =>
      invoice.status === "open" &&
      invoice.dueAt !== null &&
      invoice.dueAt.getTime() < now.getTime(),
  );
  const incompleteConsent = consent.items.filter((student) => !student.hasValidConsent);

  return {
    nextLesson,
    studentCount: family.students.length,
    actionCount: overdueInvoices.length + incompleteConsent.length,
    openInvoiceCount: payment.invoices.filter((invoice) => invoice.status === "open").length,
  };
}

export interface StudentDashboardSummary {
  nextLesson: LessonRecord | null;
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
    todayLessonCount,
    weekLessonCount: lessons.filter((lesson) => lesson.scheduledStartAt < weekEnd).length,
  };
}

export interface TutorDashboardSummary {
  nextLesson: LessonRecord | null;
  todayLessonCount: number;
  weekLessonCount: number;
  expectedTotals: Array<{ amountMinor: number; currency: "USD" | "AMD" }>;
}

export async function loadTutorDashboardSummary(now = new Date()): Promise<TutorDashboardSummary> {
  const [lessonRows, payout] = await Promise.all([loadUpcomingLessons(), loadPayoutDashboard()]);
  const lessons = futureLessons(lessonRows, now);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  return {
    nextLesson: lessons[0] ?? null,
    todayLessonCount: lessons.filter(
      (lesson) =>
        dateKey(lesson.scheduledStartAt, lesson.timezoneAtBooking) ===
        dateKey(now, lesson.timezoneAtBooking),
    ).length,
    weekLessonCount: lessons.filter((lesson) => lesson.scheduledStartAt < weekEnd).length,
    expectedTotals: payout.kind === "tutor" ? payout.summary.expectedTotals : [],
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
