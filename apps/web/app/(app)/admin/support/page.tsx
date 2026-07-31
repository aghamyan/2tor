import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import { listOpenSupportTickets } from "../../../../../../packages/domain/administration/services";
import type { SupportTicketSummary } from "../../../../../../packages/domain/administration/models";
import { resolveSupportTicketActionHandler } from "../actions";
import { authorizeAdminWorkspace } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadTickets(): Promise<SupportTicketSummary[]> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);
  return listOpenSupportTickets(context.database, context.actor);
}

export default async function AdminSupportPage() {
  const t = await getTranslations("admin.support");
  let tickets: SupportTicketSummary[];
  try {
    tickets = await loadTickets();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-support-heading" className="space-y-6">
      <div>
        <h1 id="admin-support-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>
      {tickets.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded border p-4">
              <p className="font-medium">{ticket.subject}</p>
              <p className="text-xs opacity-60">
                {t(`status.${ticket.status}`)} · {t(`priority.${ticket.priority}`)}
              </p>
              <div className="mt-3">
                <AdminActionForm
                  action={resolveSupportTicketActionHandler}
                  hiddenFields={{ ticketId: ticket.id, reason: "Resolved by staff." }}
                  submitLabel={t("resolve")}
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
