import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import {
  listModerationQueue,
  listPendingTutorContentUploads,
} from "../../../../../../packages/domain/administration/services";
import type {
  ContentReportSummary,
  TutorContentUploadSummary,
} from "../../../../../../packages/domain/administration/models";
import { decideContentUploadActionHandler, decideModerationActionHandler } from "../actions";
import { authorizeAdminWorkspace } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadModerationQueue(): Promise<{
  reports: ContentReportSummary[];
  uploads: TutorContentUploadSummary[];
}> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);
  const [reports, uploads] = await Promise.all([
    listModerationQueue(context.database, context.actor),
    listPendingTutorContentUploads(context.database, context.actor),
  ]);
  return { reports, uploads };
}

function formatBytes(sizeBytes: number | null): string {
  if (!sizeBytes) return "";
  if (sizeBytes < 1_024 * 1_024) return `${Math.round(sizeBytes / 1_024)} KB`;
  return `${(sizeBytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

export default async function AdminModerationPage() {
  const t = await getTranslations("admin.moderation");
  let reports: ContentReportSummary[];
  let uploads: TutorContentUploadSummary[];
  try {
    ({ reports, uploads } = await loadModerationQueue());
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

      <div>
        <h2 className="text-lg font-semibold">{t("uploads.title")}</h2>
        <p className="text-sm opacity-70">{t("uploads.intro")}</p>
      </div>
      {uploads.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("uploads.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {uploads.map((upload) => (
            <li key={upload.id} className="rounded border p-4">
              <p className="font-medium">{upload.fileName ?? t("uploads.unnamed")}</p>
              <p className="text-xs opacity-60">
                {upload.mimeType ?? "—"} · {formatBytes(upload.sizeBytes)} ·{" "}
                {upload.createdAt.toLocaleString()}
              </p>
              <div className="mt-3 flex gap-3">
                <AdminActionForm
                  action={decideContentUploadActionHandler}
                  hiddenFields={{ uploadId: upload.id, status: "approved" }}
                  submitLabel={t("uploads.approve")}
                  pendingLabel={t("deciding")}
                />
                <AdminActionForm
                  action={decideContentUploadActionHandler}
                  hiddenFields={{ uploadId: upload.id, status: "rejected" }}
                  submitLabel={t("uploads.reject")}
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
