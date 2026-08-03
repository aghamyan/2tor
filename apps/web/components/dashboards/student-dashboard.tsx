import type { ReactNode } from "react";

import { getTranslations } from "next-intl/server";

import type { DashboardPanel } from "../../app/(app)/(dashboards)/_lib/catalog";
import { currentDashboardLocale } from "../../app/(app)/(dashboards)/_lib/locale";
import { loadStudentDashboardSummary } from "../../app/(app)/(dashboards)/_lib/summaries";
import { DashboardShell } from "./dashboard-shell";
import { LocalizedDashboardSummary } from "./dashboard-summary";
import { LessonCountdown } from "./lesson-countdown";

export function YoungerStudentDashboard({
  panels,
  preferredName,
  summary,
}: {
  panels: readonly DashboardPanel[];
  preferredName: string;
  summary: ReactNode;
}) {
  return (
    <DashboardShell
      kind="student-younger"
      panels={panels}
      summary={summary}
      viewerName={preferredName}
    />
  );
}

export function OlderStudentDashboard({
  panels,
  preferredName,
  summary,
}: {
  panels: readonly DashboardPanel[];
  preferredName: string;
  summary: ReactNode;
}) {
  return (
    <DashboardShell
      kind="student-older"
      panels={panels}
      summary={summary}
      viewerName={preferredName}
    />
  );
}

export async function StudentDashboardSignals() {
  const [summary, locale, t] = await Promise.all([
    loadStudentDashboardSummary(),
    currentDashboardLocale(),
    getTranslations("dashboards"),
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
          labelKey: "summary.student.nextLesson",
          ...(nextLessonValue
            ? { value: nextLessonValue }
            : { valueKey: "summary.common.noneScheduled" }),
          detailKey: "summary.student.nextLessonDetail",
          href: "/scheduling",
          extra: nextLesson ? (
            <LessonCountdown
              startAt={nextLesson.scheduledStartAt.toISOString()}
              endAt={nextLesson.scheduledEndAt.toISOString()}
              joinUrl={summary.nextLessonJoinUrl}
              joinLabel={t("summary.common.joinLesson")}
              locale={locale}
            />
          ) : undefined,
        },
        {
          labelKey: "summary.student.today",
          value: String(summary.todayLessonCount),
          detailKey: "summary.student.todayDetail",
          href: "/scheduling",
        },
        {
          labelKey: "summary.student.nextSevenDays",
          value: String(summary.weekLessonCount),
          detailKey: "summary.student.nextSevenDaysDetail",
          href: "/scheduling",
        },
        {
          labelKey: "summary.student.nextStep",
          valueKey: "summary.student.openTasks",
          detailKey: "summary.student.nextStepDetail",
          href: "/assignments",
        },
      ]}
    />
  );
}
