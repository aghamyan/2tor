import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import { listActiveTutorSuspensions } from "../../../../../../packages/domain/administration/services";
import type { TutorSuspensionRecord } from "../../../../../../packages/domain/administration/models";
import { liftTutorSuspensionActionHandler, suspendTutorActionHandler } from "../actions";
import { authorizeSuspendAccount } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadSuspensions(): Promise<TutorSuspensionRecord[]> {
  const context = await currentAdministrationContext();
  authorizeSuspendAccount(context.actor, "tutor");
  return listActiveTutorSuspensions(context.database, context.actor);
}

export default async function AdminSuspensionsPage() {
  const t = await getTranslations("admin.suspensions");
  let suspensions: TutorSuspensionRecord[];
  try {
    suspensions = await loadSuspensions();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-suspensions-heading" className="space-y-6">
      <div>
        <h1 id="admin-suspensions-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="font-medium">{t("createTitle")}</h2>
        <AdminActionForm
          action={suspendTutorActionHandler}
          submitLabel={t("suspend")}
          pendingLabel={t("suspending")}
          className="mt-2 space-y-2"
        >
          <label className="block text-sm">
            {t("tutorProfileIdLabel")}
            <input
              name="tutorProfileId"
              required
              className="mt-1 block w-full rounded border px-2 py-1"
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

      {suspensions.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {suspensions.map((suspension) => (
            <li key={suspension.id} className="rounded border p-4">
              <p className="font-medium">{suspension.reason}</p>
              <p className="text-xs opacity-60">
                {t("tutorProfileIdLabel")}: {suspension.tutorProfileId} ·{" "}
                {suspension.startAt.toLocaleString()}
              </p>
              <div className="mt-3">
                <AdminActionForm
                  action={liftTutorSuspensionActionHandler}
                  hiddenFields={{
                    suspensionId: suspension.id,
                    reason: "Suspension lifted after review.",
                  }}
                  submitLabel={t("lift")}
                  pendingLabel={t("lifting")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
