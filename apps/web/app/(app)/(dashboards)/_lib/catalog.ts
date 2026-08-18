import type { Role } from "@app/auth";

export type DashboardKind =
  "parent" | "student-younger" | "student-older" | "tutor" | "admin" | "finance";

export type DashboardModule =
  | "academics"
  | "administration"
  | "assessments"
  | "assignments"
  | "communication"
  | "consent"
  | "content"
  | "discussions"
  | "families"
  | "gamification"
  | "matching"
  | "payments"
  | "payouts"
  | "projects"
  | "reporting"
  | "scheduling"
  | "support"
  | "tutors";

export interface DashboardPanel {
  id: string;
  module: DashboardModule;
  href: string;
  roles: readonly Role[];
  titleKey: string;
  bodyKey: string;
  span: "standard" | "wide";
  tone: "quiet" | "signal" | "attention";
}

const panel = (
  value: Omit<DashboardPanel, "span" | "tone"> & Partial<Pick<DashboardPanel, "span" | "tone">>,
): DashboardPanel => ({
  span: "standard",
  tone: "quiet",
  ...value,
});

const parentRoles = ["parent"] as const;
const studentRoles = ["student"] as const;
const tutorRoles = ["tutor"] as const;
const adminRoles = ["administrator", "super_administrator"] as const;
const financeRoles = ["finance"] as const;

export const DASHBOARD_PANELS: Readonly<Record<DashboardKind, readonly DashboardPanel[]>> = {
  parent: [
    panel({
      id: "parent.schedule",
      module: "scheduling",
      href: "/scheduling",
      roles: parentRoles,
      titleKey: "panels.parent.schedule.title",
      bodyKey: "panels.parent.schedule.body",
      span: "wide",
      tone: "signal",
    }),
    panel({
      id: "parent.family",
      module: "families",
      href: "/families",
      roles: parentRoles,
      titleKey: "panels.parent.family.title",
      bodyKey: "panels.parent.family.body",
    }),
    panel({
      id: "parent.message",
      module: "communication",
      href: "/communication",
      roles: parentRoles,
      titleKey: "panels.parent.message.title",
      bodyKey: "panels.parent.message.body",
    }),
    panel({
      id: "parent.assignments",
      module: "assignments",
      href: "/assignments",
      roles: parentRoles,
      titleKey: "panels.parent.assignments.title",
      bodyKey: "panels.parent.assignments.body",
    }),
    panel({
      id: "parent.progress",
      module: "academics",
      href: "/academics",
      roles: parentRoles,
      titleKey: "panels.parent.progress.title",
      bodyKey: "panels.parent.progress.body",
      span: "wide",
    }),
    panel({
      id: "parent.projects",
      module: "projects",
      href: "/projects",
      roles: parentRoles,
      titleKey: "panels.parent.projects.title",
      bodyKey: "panels.parent.projects.body",
    }),
    panel({
      id: "parent.assessments",
      module: "assessments",
      href: "/assessments",
      roles: parentRoles,
      titleKey: "panels.parent.assessments.title",
      bodyKey: "panels.parent.assessments.body",
    }),
    panel({
      id: "parent.discussions",
      module: "discussions",
      href: "/discussions",
      roles: parentRoles,
      titleKey: "panels.parent.discussions.title",
      bodyKey: "panels.parent.discussions.body",
    }),
    panel({
      id: "parent.payments",
      module: "payments",
      href: "/payments",
      roles: parentRoles,
      titleKey: "panels.parent.payments.title",
      bodyKey: "panels.parent.payments.body",
      tone: "attention",
    }),
    panel({
      id: "parent.consent",
      module: "consent",
      href: "/consent",
      roles: parentRoles,
      titleKey: "panels.parent.consent.title",
      bodyKey: "panels.parent.consent.body",
    }),
    panel({
      id: "parent.tutor-change",
      module: "support",
      href: "/support",
      roles: parentRoles,
      titleKey: "panels.parent.tutorChange.title",
      bodyKey: "panels.parent.tutorChange.body",
    }),
    panel({
      id: "parent.support",
      module: "support",
      href: "/support",
      roles: parentRoles,
      titleKey: "panels.parent.support.title",
      bodyKey: "panels.parent.support.body",
    }),
  ],
  "student-younger": [
    panel({
      id: "student-younger.next-lesson",
      module: "scheduling",
      href: "/scheduling",
      roles: studentRoles,
      titleKey: "panels.studentYounger.nextLesson.title",
      bodyKey: "panels.studentYounger.nextLesson.body",
      span: "wide",
      tone: "signal",
    }),
    panel({
      id: "student-younger.tasks",
      module: "assignments",
      href: "/assignments",
      roles: studentRoles,
      titleKey: "panels.studentYounger.tasks.title",
      bodyKey: "panels.studentYounger.tasks.body",
      tone: "attention",
    }),
    panel({
      id: "student-younger.progress",
      module: "academics",
      href: "/academics",
      roles: studentRoles,
      titleKey: "panels.studentYounger.progress.title",
      bodyKey: "panels.studentYounger.progress.body",
      span: "wide",
    }),
    panel({
      id: "student-younger.rewards",
      module: "academics",
      href: "/academics",
      roles: studentRoles,
      titleKey: "panels.studentYounger.rewards.title",
      bodyKey: "panels.studentYounger.rewards.body",
    }),
    panel({
      id: "student-younger.message",
      module: "communication",
      href: "/communication",
      roles: studentRoles,
      titleKey: "panels.studentYounger.message.title",
      bodyKey: "panels.studentYounger.message.body",
    }),
    panel({
      id: "student-younger.resources",
      module: "content",
      href: "/content",
      roles: studentRoles,
      titleKey: "panels.studentYounger.resources.title",
      bodyKey: "panels.studentYounger.resources.body",
    }),
  ],
  "student-older": [
    panel({
      id: "student-older.calendar",
      module: "scheduling",
      href: "/scheduling",
      roles: studentRoles,
      titleKey: "panels.studentOlder.calendar.title",
      bodyKey: "panels.studentOlder.calendar.body",
      span: "wide",
      tone: "signal",
    }),
    panel({
      id: "student-older.tasks",
      module: "assignments",
      href: "/assignments",
      roles: studentRoles,
      titleKey: "panels.studentOlder.tasks.title",
      bodyKey: "panels.studentOlder.tasks.body",
      tone: "attention",
    }),
    panel({
      id: "student-older.plan",
      module: "academics",
      href: "/academics",
      roles: studentRoles,
      titleKey: "panels.studentOlder.plan.title",
      bodyKey: "panels.studentOlder.plan.body",
    }),
    panel({
      id: "student-older.assessments",
      module: "assessments",
      href: "/assessments",
      roles: studentRoles,
      titleKey: "panels.studentOlder.assessments.title",
      bodyKey: "panels.studentOlder.assessments.body",
    }),
    panel({
      id: "student-older.feedback",
      module: "academics",
      href: "/academics",
      roles: studentRoles,
      titleKey: "panels.studentOlder.feedback.title",
      bodyKey: "panels.studentOlder.feedback.body",
      span: "wide",
    }),
    panel({
      id: "student-older.projects",
      module: "projects",
      href: "/projects",
      roles: studentRoles,
      titleKey: "panels.studentOlder.projects.title",
      bodyKey: "panels.studentOlder.projects.body",
    }),
    panel({
      id: "student-older.notes",
      module: "academics",
      href: "/academics",
      roles: studentRoles,
      titleKey: "panels.studentOlder.notes.title",
      bodyKey: "panels.studentOlder.notes.body",
    }),
    panel({
      id: "student-older.formulas",
      module: "content",
      href: "/content",
      roles: studentRoles,
      titleKey: "panels.studentOlder.formulas.title",
      bodyKey: "panels.studentOlder.formulas.body",
    }),
    panel({
      id: "student-older.discussions",
      module: "discussions",
      href: "/discussions",
      roles: studentRoles,
      titleKey: "panels.studentOlder.discussions.title",
      bodyKey: "panels.studentOlder.discussions.body",
    }),
    panel({
      id: "student-older.resources",
      module: "content",
      href: "/content",
      roles: studentRoles,
      titleKey: "panels.studentOlder.resources.title",
      bodyKey: "panels.studentOlder.resources.body",
    }),
    panel({
      id: "student-older.analytics",
      module: "academics",
      href: "/academics",
      roles: studentRoles,
      titleKey: "panels.studentOlder.analytics.title",
      bodyKey: "panels.studentOlder.analytics.body",
      span: "wide",
    }),
  ],
  tutor: [
    panel({
      id: "tutor.calendar",
      module: "scheduling",
      href: "/scheduling",
      roles: tutorRoles,
      titleKey: "panels.tutor.calendar.title",
      bodyKey: "panels.tutor.calendar.body",
      span: "wide",
      tone: "signal",
    }),
    panel({
      id: "tutor.students",
      module: "academics",
      href: "/academics",
      roles: tutorRoles,
      titleKey: "panels.tutor.students.title",
      bodyKey: "panels.tutor.students.body",
    }),
    panel({
      id: "tutor.action-queue",
      module: "assignments",
      href: "/assignments",
      roles: tutorRoles,
      titleKey: "panels.tutor.actionQueue.title",
      bodyKey: "panels.tutor.actionQueue.body",
      span: "wide",
      tone: "attention",
    }),
    panel({
      id: "tutor.messages",
      module: "communication",
      href: "/communication",
      roles: tutorRoles,
      titleKey: "panels.tutor.messages.title",
      bodyKey: "panels.tutor.messages.body",
    }),
    panel({
      id: "tutor.plans",
      module: "academics",
      href: "/academics",
      roles: tutorRoles,
      titleKey: "panels.tutor.plans.title",
      bodyKey: "panels.tutor.plans.body",
    }),
    panel({
      id: "tutor.availability",
      module: "tutors",
      href: "/tutors",
      roles: tutorRoles,
      titleKey: "panels.tutor.availability.title",
      bodyKey: "panels.tutor.availability.body",
    }),
    panel({
      id: "tutor.resources",
      module: "content",
      href: "/content",
      roles: tutorRoles,
      titleKey: "panels.tutor.resources.title",
      bodyKey: "panels.tutor.resources.body",
    }),
    panel({
      id: "tutor.earnings",
      module: "payouts",
      href: "/payouts",
      roles: tutorRoles,
      titleKey: "panels.tutor.earnings.title",
      bodyKey: "panels.tutor.earnings.body",
    }),
    panel({
      id: "tutor.development",
      module: "tutors",
      href: "/tutors",
      roles: tutorRoles,
      titleKey: "panels.tutor.development.title",
      bodyKey: "panels.tutor.development.body",
      span: "wide",
    }),
  ],
  admin: [
    panel({
      id: "admin.enrollment",
      module: "administration",
      href: "/admin/users",
      roles: adminRoles,
      titleKey: "panels.admin.enrollment.title",
      bodyKey: "panels.admin.enrollment.body",
      span: "wide",
      tone: "signal",
    }),
    panel({
      id: "admin.delivery",
      module: "reporting",
      href: "/reporting",
      roles: adminRoles,
      titleKey: "panels.admin.delivery.title",
      bodyKey: "panels.admin.delivery.body",
      span: "wide",
    }),
    panel({
      id: "admin.finance-health",
      module: "payments",
      href: "/payments",
      roles: adminRoles,
      titleKey: "panels.admin.financeHealth.title",
      bodyKey: "panels.admin.financeHealth.body",
      span: "wide",
      tone: "attention",
    }),
    panel({
      id: "admin.capacity",
      module: "reporting",
      href: "/reporting",
      roles: adminRoles,
      titleKey: "panels.admin.capacity.title",
      bodyKey: "panels.admin.capacity.body",
      span: "wide",
    }),
    panel({
      id: "admin.family-queue",
      module: "administration",
      href: "/admin/users",
      roles: adminRoles,
      titleKey: "panels.admin.familyQueue.title",
      bodyKey: "panels.admin.familyQueue.body",
      tone: "attention",
    }),
    panel({
      id: "admin.tutor-queue",
      module: "administration",
      href: "/admin/verifications",
      roles: adminRoles,
      titleKey: "panels.admin.tutorQueue.title",
      bodyKey: "panels.admin.tutorQueue.body",
    }),
    panel({
      id: "admin.matching-queue",
      module: "matching",
      href: "/matching",
      roles: adminRoles,
      titleKey: "panels.admin.matchingQueue.title",
      bodyKey: "panels.admin.matchingQueue.body",
    }),
    panel({
      id: "admin.learning-safety",
      module: "administration",
      href: "/admin/moderation",
      roles: adminRoles,
      titleKey: "panels.admin.learningSafety.title",
      bodyKey: "panels.admin.learningSafety.body",
      span: "wide",
      tone: "attention",
    }),
    panel({
      id: "admin.refunds",
      module: "payments",
      href: "/payments",
      roles: adminRoles,
      titleKey: "panels.admin.refunds.title",
      bodyKey: "panels.admin.refunds.body",
    }),
    panel({
      id: "admin.data-requests",
      module: "administration",
      href: "/admin/deletions",
      roles: adminRoles,
      titleKey: "panels.admin.dataRequests.title",
      bodyKey: "panels.admin.dataRequests.body",
    }),
    panel({
      id: "admin.high-risk",
      module: "administration",
      href: "/admin/security",
      roles: adminRoles,
      titleKey: "panels.admin.highRisk.title",
      bodyKey: "panels.admin.highRisk.body",
      span: "wide",
    }),
  ],
  finance: [
    panel({
      id: "finance.settlement",
      module: "payments",
      href: "/payments",
      roles: financeRoles,
      titleKey: "panels.finance.settlement.title",
      bodyKey: "panels.finance.settlement.body",
      span: "wide",
      tone: "signal",
    }),
    panel({
      id: "finance.invoices",
      module: "payments",
      href: "/payments",
      roles: financeRoles,
      titleKey: "panels.finance.invoices.title",
      bodyKey: "panels.finance.invoices.body",
    }),
    panel({
      id: "finance.failures",
      module: "payments",
      href: "/payments",
      roles: financeRoles,
      titleKey: "panels.finance.failures.title",
      bodyKey: "panels.finance.failures.body",
      tone: "attention",
    }),
    panel({
      id: "finance.refunds",
      module: "payments",
      href: "/payments",
      roles: financeRoles,
      titleKey: "panels.finance.refunds.title",
      bodyKey: "panels.finance.refunds.body",
    }),
    panel({
      id: "finance.liability",
      module: "payouts",
      href: "/payouts",
      roles: financeRoles,
      titleKey: "panels.finance.liability.title",
      bodyKey: "panels.finance.liability.body",
      span: "wide",
    }),
    panel({
      id: "finance.batches",
      module: "payouts",
      href: "/payouts",
      roles: financeRoles,
      titleKey: "panels.finance.batches.title",
      bodyKey: "panels.finance.batches.body",
    }),
    panel({
      id: "finance.reconciliation",
      module: "payouts",
      href: "/payouts",
      roles: financeRoles,
      titleKey: "panels.finance.reconciliation.title",
      bodyKey: "panels.finance.reconciliation.body",
      tone: "attention",
    }),
  ],
};

export function panelsForDashboard(kind: DashboardKind): readonly DashboardPanel[] {
  return DASHBOARD_PANELS[kind];
}
