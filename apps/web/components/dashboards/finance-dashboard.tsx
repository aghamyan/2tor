import type { ReactNode } from "react";

import type { DashboardPanel } from "../../app/(app)/(dashboards)/_lib/catalog";
import { currentDashboardLocale } from "../../app/(app)/(dashboards)/_lib/locale";
import { loadFinanceDashboardSummary } from "../../app/(app)/(dashboards)/_lib/summaries";
import { DashboardShell } from "./dashboard-shell";
import { LocalizedDashboardSummary } from "./dashboard-summary";

function money(amountMinor: number, currency: "USD" | "AMD", locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "AMD" ? 0 : 2,
  }).format(amountMinor / 100);
}

export function FinanceDashboard({
  panels,
  summary,
}: {
  panels: readonly DashboardPanel[];
  summary: ReactNode;
}) {
  return <DashboardShell kind="finance" panels={panels} summary={summary} />;
}

export async function FinanceDashboardSignals() {
  const [summary, locale] = await Promise.all([
    loadFinanceDashboardSummary(),
    currentDashboardLocale(),
  ]);
  const revenue =
    summary.revenue.length > 0
      ? summary.revenue.map((item) => money(item.amountMinor, item.currency, locale)).join(" · ")
      : null;
  return (
    <LocalizedDashboardSummary
      items={[
        {
          labelKey: "summary.finance.revenue",
          ...(revenue ? { value: revenue } : { valueKey: "summary.common.noBalance" }),
          detailKey: "summary.finance.revenueDetail",
          href: "/payments",
        },
        {
          labelKey: "summary.finance.paymentFailures",
          value: String(summary.failedPaymentCount),
          detailKey: "summary.finance.paymentFailuresDetail",
          href: "/payments",
          emphasis: summary.failedPaymentCount > 0 ? "attention" : "default",
        },
        {
          labelKey: "summary.finance.pendingPayouts",
          value: String(summary.pendingPayoutCount),
          detailKey: "summary.finance.pendingPayoutsDetail",
          href: "/payouts",
          emphasis: summary.pendingPayoutCount > 0 ? "attention" : "default",
        },
        {
          labelKey: "summary.finance.reconciliation",
          value: String(summary.unreconciledBatchCount),
          detailKey: "summary.finance.reconciliationDetail",
          href: "/payouts",
          emphasis: summary.unreconciledBatchCount > 0 ? "attention" : "default",
        },
      ]}
    />
  );
}
