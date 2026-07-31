import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../packages/domain/administration/errors";
import {
  listDeletionJobs,
  listExports,
  listOpenDisputes,
  listOpenSupportTickets,
  listModerationQueue,
  listPendingTutorVerifications,
  listPendingUserApprovals,
  listPrivacyRequests,
} from "../../../../../packages/domain/administration/services";
import { authorizeAdminWorkspace } from "./authorization";
import { currentAdministrationContext } from "./context";

interface DashboardCard {
  href: string;
  labelKey: string;
  count: number;
}

async function loadDashboard(): Promise<DashboardCard[]> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);

  const [
    users,
    verifications,
    disputes,
    moderation,
    support,
    exportsList,
    deletions,
    privacyRequests,
  ] = await Promise.all([
    listPendingUserApprovals(context.database, context.actor),
    listPendingTutorVerifications(context.database, context.actor),
    listOpenDisputes(context.database, context.actor),
    listModerationQueue(context.database, context.actor),
    listOpenSupportTickets(context.database, context.actor),
    listExports(context.database, context.actor),
    listDeletionJobs(context.database, context.actor),
    listPrivacyRequests(context.database, context.actor),
  ]);

  return [
    { href: "/admin/users", labelKey: "cards.users", count: users.length },
    { href: "/admin/verifications", labelKey: "cards.verifications", count: verifications.length },
    { href: "/admin/disputes", labelKey: "cards.disputes", count: disputes.length },
    { href: "/admin/moderation", labelKey: "cards.moderation", count: moderation.length },
    { href: "/admin/support", labelKey: "cards.support", count: support.length },
    {
      href: "/admin/exports",
      labelKey: "cards.exports",
      count: exportsList.filter((e) => e.status === "pending").length,
    },
    {
      href: "/admin/deletions",
      labelKey: "cards.deletions",
      count: deletions.filter((d) => d.blockReason === "pending_approval").length,
    },
    {
      href: "/admin/deletions",
      labelKey: "cards.privacyRequests",
      count: privacyRequests.filter((r) => r.status === "received" || r.status === "in_review")
        .length,
    },
  ];
}

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  let cards: DashboardCard[];
  try {
    cards = await loadDashboard();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-dashboard-heading" className="space-y-6">
      <div>
        <h1 id="admin-dashboard-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.href + card.labelKey}>
            <Link href={card.href} className="block rounded border p-4 hover:bg-black/5">
              <p className="text-2xl font-semibold">{card.count}</p>
              <p className="text-sm opacity-70">{t(card.labelKey)}</p>
            </Link>
          </li>
        ))}
      </ul>
      <nav aria-label={t("moreLinks")} className="flex flex-wrap gap-3 text-sm underline">
        <Link href="/matching">{t("links.matchingQueue")}</Link>
        <Link href="/admin/suspensions">{t("links.suspensions")}</Link>
        <Link href="/admin/discounts">{t("links.discounts")}</Link>
        <Link href="/admin/roles">{t("links.roles")}</Link>
        <Link href="/admin/security">{t("links.security")}</Link>
        <Link href="/admin/audit-log">{t("links.auditLog")}</Link>
      </nav>
    </section>
  );
}
