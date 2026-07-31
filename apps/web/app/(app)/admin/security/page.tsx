import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import type { PendingApprovalSummary } from "../../../../../../packages/domain/administration/models";
import {
  decideSecuritySettingChangeActionHandler,
  requestSecuritySettingChangeActionHandler,
} from "../actions";
import { authorizeSecuritySetting } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadPendingSecurityChanges(): Promise<{
  items: PendingApprovalSummary[];
  actorUserId: string;
}> {
  const context = await currentAdministrationContext();
  authorizeSecuritySetting(context.actor);
  const items = await context.audit.listPendingApprovals("disable_security_control");
  return { items, actorUserId: context.actor.userId };
}

export default async function AdminSecurityPage() {
  const t = await getTranslations("admin.security");
  let data: { items: PendingApprovalSummary[]; actorUserId: string };
  try {
    data = await loadPendingSecurityChanges();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-security-heading" className="space-y-6">
      <div>
        <h1 id="admin-security-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="font-medium">{t("requestTitle")}</h2>
        <AdminActionForm
          action={requestSecuritySettingChangeActionHandler}
          submitLabel={t("requestSubmit")}
          pendingLabel={t("requesting")}
          className="mt-2 space-y-2"
        >
          <label className="block text-sm">
            {t("keyLabel")}
            <input
              name="key"
              required
              placeholder="security.require_mfa_for_admins"
              className="mt-1 block w-full rounded border px-2 py-1"
            />
          </label>
          <label className="block text-sm">
            {t("valueLabel")}
            <input name="value" required className="mt-1 block w-full rounded border px-2 py-1" />
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

      {data.items.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((item) => {
            const payload = item.payload as { key: string; value: unknown };
            const isSelfRequester = item.requestedByUserId === data.actorUserId;
            return (
              <li key={item.approvalRequestId} className="rounded border p-4">
                <p className="font-medium">
                  {payload.key} = {String(payload.value)}
                </p>
                <p className="text-xs opacity-60">{item.reason}</p>
                {isSelfRequester ? (
                  <p className="mt-2 text-sm opacity-70">{t("cannotSelfApprove")}</p>
                ) : (
                  <div className="mt-3 flex gap-3">
                    <AdminActionForm
                      action={decideSecuritySettingChangeActionHandler}
                      hiddenFields={{
                        approvalRequestId: item.approvalRequestId,
                        decision: "approved",
                        reason: "Reviewed and approved.",
                      }}
                      submitLabel={t("approve")}
                      pendingLabel={t("deciding")}
                    />
                    <AdminActionForm
                      action={decideSecuritySettingChangeActionHandler}
                      hiddenFields={{
                        approvalRequestId: item.approvalRequestId,
                        decision: "rejected",
                        reason: "Not justified.",
                      }}
                      submitLabel={t("reject")}
                      pendingLabel={t("deciding")}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
