import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import {
  listDeletionJobs,
  listPrivacyRequests,
} from "../../../../../../packages/domain/administration/services";
import type {
  DeletionJobRecord,
  PendingApprovalSummary,
  PrivacyRequestRecord,
} from "../../../../../../packages/domain/administration/models";
import {
  decideMassDeletionActionHandler,
  requestMassDeletionActionHandler,
  resolvePrivacyRequestActionHandler,
} from "../actions";
import { authorizeMassDeletion } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

interface DeletionRow {
  job: DeletionJobRecord;
  pendingApproval: PendingApprovalSummary | null;
}

async function loadDeletions(): Promise<{
  rows: DeletionRow[];
  privacyRequests: PrivacyRequestRecord[];
  actorUserId: string;
}> {
  const context = await currentAdministrationContext();
  authorizeMassDeletion(context.actor);
  const [jobs, privacyRequests] = await Promise.all([
    listDeletionJobs(context.database, context.actor),
    listPrivacyRequests(context.database, context.actor),
  ]);
  const rows = await Promise.all(
    jobs.map(async (job) => ({
      job,
      pendingApproval:
        job.blockReason === "pending_approval"
          ? await context.audit.findPendingApproval("deletion_jobs", job.id)
          : null,
    })),
  );
  return { rows, privacyRequests, actorUserId: context.actor.userId };
}

export default async function AdminDeletionsPage() {
  const t = await getTranslations("admin.deletions");
  let data: { rows: DeletionRow[]; privacyRequests: PrivacyRequestRecord[]; actorUserId: string };
  try {
    data = await loadDeletions();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-deletions-heading" className="space-y-8">
      <div>
        <h1 id="admin-deletions-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="font-medium">{t("requestTitle")}</h2>
        <AdminActionForm
          action={requestMassDeletionActionHandler}
          submitLabel={t("requestSubmit")}
          pendingLabel={t("requesting")}
          className="mt-2 space-y-2"
        >
          <label className="block text-sm">
            {t("targetEntityTypeLabel")}
            <input
              name="targetEntityType"
              required
              placeholder="bookmarks"
              className="mt-1 block w-full rounded border px-2 py-1"
            />
          </label>
          <label className="block text-sm">
            {t("targetEntityIdLabel")}
            <input
              name="targetEntityId"
              required
              className="mt-1 block w-full rounded border px-2 py-1"
            />
          </label>
          <label className="block text-sm">
            {t("scopeLabel")}
            <select name="scope" className="mt-1 block w-full rounded border px-2 py-1">
              <option value="full_erase">{t("scopeFullErase")}</option>
              <option value="anonymize">{t("scopeAnonymize")}</option>
            </select>
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

      <div>
        <h2 className="font-medium">{t("jobsTitle")}</h2>
        {data.rows.length === 0 ? (
          <p className="mt-2 rounded border p-4 text-sm">{t("empty")}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {data.rows.map(({ job, pendingApproval }) => {
              const isSelfRequester = job.createdByUserId === data.actorUserId;
              return (
                <li key={job.id} className="rounded border p-4">
                  <p className="font-medium">
                    {job.targetEntityType} — {t(`status.${job.status}`)}
                  </p>
                  <p className="text-xs opacity-60">
                    {job.targetEntityId} · {job.scope} · {job.blockReason ?? "—"}
                  </p>
                  {pendingApproval ? (
                    isSelfRequester ? (
                      <p className="mt-2 text-sm opacity-70">{t("cannotSelfApprove")}</p>
                    ) : (
                      <div className="mt-3 flex gap-3">
                        <AdminActionForm
                          action={decideMassDeletionActionHandler}
                          hiddenFields={{
                            deletionJobId: job.id,
                            approvalRequestId: pendingApproval.approvalRequestId,
                            decision: "approved",
                            reason: "Reviewed and approved.",
                          }}
                          submitLabel={t("approve")}
                          pendingLabel={t("deciding")}
                        />
                        <AdminActionForm
                          action={decideMassDeletionActionHandler}
                          hiddenFields={{
                            deletionJobId: job.id,
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
      </div>

      <div>
        <h2 className="font-medium">{t("privacyRequestsTitle")}</h2>
        {data.privacyRequests.length === 0 ? (
          <p className="mt-2 rounded border p-4 text-sm">{t("empty")}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {data.privacyRequests.map((request) => (
              <li key={request.id} className="rounded border p-4">
                <p className="font-medium">
                  {request.type} — {t(`privacyStatus.${request.status}`)}
                </p>
                <p className="text-xs opacity-60">{request.createdAt.toLocaleString()}</p>
                {request.status !== "completed" && request.status !== "rejected" ? (
                  <div className="mt-3">
                    <AdminActionForm
                      action={resolvePrivacyRequestActionHandler}
                      hiddenFields={{ requestId: request.id, status: "completed" }}
                      submitLabel={t("markCompleted")}
                      pendingLabel={t("deciding")}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
