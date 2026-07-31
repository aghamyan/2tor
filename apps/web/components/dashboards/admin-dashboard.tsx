import type { ReactNode } from "react";

import type { DashboardPanel } from "../../app/(app)/(dashboards)/_lib/catalog";
import { loadAdminDashboardSummary } from "../../app/(app)/(dashboards)/_lib/summaries";
import { DashboardShell } from "./dashboard-shell";
import { LocalizedDashboardSummary } from "./dashboard-summary";

export function AdminDashboard({
  panels,
  summary,
}: {
  panels: readonly DashboardPanel[];
  summary: ReactNode;
}) {
  return <DashboardShell kind="admin" panels={panels} summary={summary} />;
}

export async function AdminDashboardSignals() {
  const summary = await loadAdminDashboardSummary();
  return (
    <LocalizedDashboardSummary
      items={[
        {
          labelKey: "summary.admin.pendingFamilies",
          value: String(summary.pendingFamilyCount),
          detailKey: "summary.admin.pendingFamiliesDetail",
          href: "/admin/users",
          emphasis: summary.pendingFamilyCount > 0 ? "attention" : "default",
        },
        {
          labelKey: "summary.admin.tutorVerification",
          value: String(summary.pendingTutorCount),
          detailKey: "summary.admin.tutorVerificationDetail",
          href: "/admin/verifications",
          emphasis: summary.pendingTutorCount > 0 ? "attention" : "default",
        },
        {
          labelKey: "summary.admin.learningSafety",
          value: String(summary.learningSafetyCount),
          detailKey: "summary.admin.learningSafetyDetail",
          href: "/admin/moderation",
          emphasis: summary.learningSafetyCount > 0 ? "attention" : "default",
        },
        {
          labelKey: "summary.admin.supportPrivacy",
          value: String(summary.supportAndPrivacyCount),
          detailKey: "summary.admin.supportPrivacyDetail",
          href: "/admin/support",
          emphasis: summary.supportAndPrivacyCount > 0 ? "attention" : "default",
        },
      ]}
    />
  );
}
