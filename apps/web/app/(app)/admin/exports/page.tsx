import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import { listExports } from "../../../../../../packages/domain/administration/services";
import type {
  ExportRecord,
  PendingApprovalSummary,
} from "../../../../../../packages/domain/administration/models";
import { decideBulkExportActionHandler, requestBulkExportActionHandler } from "../actions";
import { authorizeExportRequest } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

interface ExportRow {
  record: ExportRecord;
  pendingApproval: PendingApprovalSummary | null;
}

async function loadExports(): Promise<{ rows: ExportRow[]; actorUserId: string }> {
  const context = await currentAdministrationContext();
  authorizeExportRequest(context.actor);
  const records = await listExports(context.database, context.actor);
  const rows = await Promise.all(
    records.map(async (record) => ({
      record,
      pendingApproval:
        record.status === "pending"
          ? await context.audit.findPendingApproval("exports", record.id)
          : null,
    })),
  );
  return { rows, actorUserId: context.actor.userId };
}

export default async function AdminExportsPage() {
  const t = await getTranslations("admin.exports");
  let data: { rows: ExportRow[]; actorUserId: string };
  try {
    data = await loadExports();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-exports-heading" className="space-y-6">
      <div>
        <h1 id="admin-exports-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="font-medium">{t("requestTitle")}</h2>
        <AdminActionForm
          action={requestBulkExportActionHandler}
          submitLabel={t("requestSubmit")}
          pendingLabel={t("requesting")}
          className="mt-2 space-y-2"
        >
          <label className="block text-sm">
            {t("typeLabel")}
            <input
              name="type"
              required
              className="mt-1 block w-full rounded border px-2 py-1"
              placeholder="users"
            />
          </label>
          <label className="block text-sm">
            {t("reasonLabel")}
            <textarea
              name="reason"
              required
              className="mt-1 block w-full rounded border px-2 py-1"
            />
          </label>
        </AdminActionForm>
      </div>

      {data.rows.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {data.rows.map(({ record, pendingApproval }) => {
            const isSelfRequester = record.requestedByUserId === data.actorUserId;
            return (
              <li key={record.id} className="rounded border p-4">
                <p className="font-medium">
                  {record.type} — {t(`status.${record.status}`)}
                </p>
                <p className="text-xs opacity-60">
                  {t("requestedBy")}: {record.requestedByUserId} ·{" "}
                  {record.createdAt.toLocaleString()}
                </p>
                {record.status === "pending" && pendingApproval ? (
                  isSelfRequester ? (
                    <p className="mt-2 text-sm opacity-70">{t("cannotSelfApprove")}</p>
                  ) : (
                    <div className="mt-3 flex gap-3">
                      <AdminActionForm
                        action={decideBulkExportActionHandler}
                        hiddenFields={{
                          exportId: record.id,
                          approvalRequestId: pendingApproval.approvalRequestId,
                          decision: "approved",
                          reason: "Reviewed and approved.",
                        }}
                        submitLabel={t("approve")}
                        pendingLabel={t("deciding")}
                      />
                      <AdminActionForm
                        action={decideBulkExportActionHandler}
                        hiddenFields={{
                          exportId: record.id,
                          approvalRequestId: pendingApproval.approvalRequestId,
                          decision: "rejected",
                          reason: "Not justified.",
                        }}
                        submitLabel={t("reject")}
                        pendingLabel={t("deciding")}
                      />
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
