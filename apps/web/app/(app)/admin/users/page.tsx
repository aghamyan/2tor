import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import { listPendingUserApprovals } from "../../../../../../packages/domain/administration/services";
import type { UserAccountSummary } from "../../../../../../packages/domain/administration/models";
import { approveUserActionHandler } from "../actions";
import { authorizeAdminWorkspace } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadPendingUsers(): Promise<UserAccountSummary[]> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);
  return listPendingUserApprovals(context.database, context.actor);
}

export default async function AdminUsersPage() {
  const t = await getTranslations("admin.users");
  let users: UserAccountSummary[];
  try {
    users = await loadPendingUsers();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-users-heading" className="space-y-6">
      <div>
        <h1 id="admin-users-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>
      {users.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.id} className="rounded border p-4">
              <p className="font-medium">{user.email ?? user.username ?? user.id}</p>
              <p className="text-xs opacity-60">{user.createdAt.toLocaleString()}</p>
              <div className="mt-3">
                <AdminActionForm
                  action={approveUserActionHandler}
                  hiddenFields={{ userId: user.id, reason: "Approved after review." }}
                  submitLabel={t("approve")}
                  pendingLabel={t("approving")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
