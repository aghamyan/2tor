import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import { listOpenDisputes } from "../../../../../../packages/domain/administration/services";
import type { AbuseReportSummary } from "../../../../../../packages/domain/administration/models";
import { decideDisputeActionHandler } from "../actions";
import { authorizeAdminWorkspace } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadDisputes(): Promise<AbuseReportSummary[]> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);
  return listOpenDisputes(context.database, context.actor);
}

export default async function AdminDisputesPage() {
  const t = await getTranslations("admin.disputes");
  let reports: AbuseReportSummary[];
  try {
    reports = await loadDisputes();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-disputes-heading" className="space-y-6">
      <div>
        <h1 id="admin-disputes-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>
      {reports.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded border p-4">
              <p className="font-medium">
                {report.targetType} — {report.reason}
              </p>
              <p className="text-xs opacity-60">{report.createdAt.toLocaleString()}</p>
              <div className="mt-3 flex gap-3">
                <AdminActionForm
                  action={decideDisputeActionHandler}
                  hiddenFields={{ reportId: report.id, status: "resolved" }}
                  submitLabel={t("resolve")}
                  pendingLabel={t("deciding")}
                />
                <AdminActionForm
                  action={decideDisputeActionHandler}
                  hiddenFields={{ reportId: report.id, status: "dismissed" }}
                  submitLabel={t("dismiss")}
                  pendingLabel={t("deciding")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
