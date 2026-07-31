import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import { listModerationQueue } from "../../../../../../packages/domain/administration/services";
import type { ContentReportSummary } from "../../../../../../packages/domain/administration/models";
import { decideModerationActionHandler } from "../actions";
import { authorizeAdminWorkspace } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadModerationQueue(): Promise<ContentReportSummary[]> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);
  return listModerationQueue(context.database, context.actor);
}

export default async function AdminModerationPage() {
  const t = await getTranslations("admin.moderation");
  let reports: ContentReportSummary[];
  try {
    reports = await loadModerationQueue();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-moderation-heading" className="space-y-6">
      <div>
        <h1 id="admin-moderation-heading" className="text-2xl font-semibold">
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
              <p className="font-medium">{report.reason}</p>
              <p className="text-xs opacity-60">
                {report.resourceId ?? "—"} · {report.createdAt.toLocaleString()}
              </p>
              <div className="mt-3 flex gap-3">
                <AdminActionForm
                  action={decideModerationActionHandler}
                  hiddenFields={{ reportId: report.id, status: "resolved" }}
                  submitLabel={t("resolve")}
                  pendingLabel={t("deciding")}
                />
                <AdminActionForm
                  action={decideModerationActionHandler}
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
