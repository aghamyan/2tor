import type { ReactNode } from "react";

import type { DashboardPanel } from "../../app/(app)/(dashboards)/_lib/catalog";
import { currentDashboardLocale } from "../../app/(app)/(dashboards)/_lib/locale";
import { loadTutorDashboardSummary } from "../../app/(app)/(dashboards)/_lib/summaries";
import { DashboardShell } from "./dashboard-shell";
import { LocalizedDashboardSummary } from "./dashboard-summary";

function money(amountMinor: number, currency: "USD" | "AMD", locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "AMD" ? 0 : 2,
  }).format(amountMinor / 100);
}

export function TutorDashboard({
  panels,
  summary,
}: {
  panels: readonly DashboardPanel[];
  summary: ReactNode;
}) {
  return <DashboardShell kind="tutor" panels={panels} summary={summary} />;
}

export async function TutorDashboardSignals() {
  const [summary, locale] = await Promise.all([
    loadTutorDashboardSummary(),
    currentDashboardLocale(),
  ]);
  const nextLesson = summary.nextLesson;
  const expected =
    summary.expectedTotals.length > 0
      ? summary.expectedTotals
          .map((total) => money(total.amountMinor, total.currency, locale))
          .join(" · ")
      : null;
  return (
    <LocalizedDashboardSummary
      items={[
        {
          labelKey: "summary.tutor.nextLesson",
          ...(nextLesson
            ? {
                value: new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: nextLesson.timezoneAtBooking,
                }).format(nextLesson.scheduledStartAt),
              }
            : { valueKey: "summary.common.noneScheduled" }),
          detailKey: "summary.tutor.nextLessonDetail",
          href: "/scheduling",
        },
        {
          labelKey: "summary.tutor.today",
          value: String(summary.todayLessonCount),
          detailKey: "summary.tutor.todayDetail",
          href: "/scheduling",
        },
        {
          labelKey: "summary.tutor.nextSevenDays",
          value: String(summary.weekLessonCount),
          detailKey: "summary.tutor.nextSevenDaysDetail",
          href: "/scheduling",
        },
        {
          labelKey: "summary.tutor.expectedEarnings",
          ...(expected ? { value: expected } : { valueKey: "summary.common.noBalance" }),
          detailKey: "summary.tutor.expectedEarningsDetail",
          href: "/payouts",
        },
      ]}
    />
  );
}
