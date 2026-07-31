import type { ReactNode } from "react";

import type { DashboardPanel } from "../../app/(app)/(dashboards)/_lib/catalog";
import { currentDashboardLocale } from "../../app/(app)/(dashboards)/_lib/locale";
import { loadParentDashboardSummary } from "../../app/(app)/(dashboards)/_lib/summaries";
import { DashboardShell } from "./dashboard-shell";
import { LocalizedDashboardSummary } from "./dashboard-summary";

export function ParentDashboard({
  panels,
  summary,
}: {
  panels: readonly DashboardPanel[];
  summary: ReactNode;
}) {
  return <DashboardShell kind="parent" panels={panels} summary={summary} />;
}

export async function ParentDashboardSignals() {
  const [summary, locale] = await Promise.all([
    loadParentDashboardSummary(),
    currentDashboardLocale(),
  ]);
  const nextLesson = summary.nextLesson;
  const nextLessonValue = nextLesson
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: nextLesson.timezoneAtBooking,
      }).format(nextLesson.scheduledStartAt)
    : null;

  return (
    <LocalizedDashboardSummary
      items={[
        {
          labelKey: "summary.parent.nextLesson",
          ...(nextLessonValue
            ? { value: nextLessonValue }
            : { valueKey: "summary.common.noneScheduled" }),
          detailKey: "summary.parent.nextLessonDetail",
          href: "/scheduling",
        },
        {
          labelKey: "summary.parent.students",
          value: String(summary.studentCount),
          detailKey: "summary.parent.studentsDetail",
          href: "/families",
        },
        {
          labelKey: "summary.parent.actionNeeded",
          value: String(summary.actionCount),
          detailKey: "summary.parent.actionNeededDetail",
          href: summary.actionCount > 0 ? "/consent" : "/families",
          emphasis: summary.actionCount > 0 ? "attention" : "default",
        },
        {
          labelKey: "summary.parent.upcomingCharges",
          value: String(summary.openInvoiceCount),
          detailKey: "summary.parent.upcomingChargesDetail",
          href: "/payments",
          emphasis: summary.openInvoiceCount > 0 ? "attention" : "default",
        },
      ]}
    />
  );
}
