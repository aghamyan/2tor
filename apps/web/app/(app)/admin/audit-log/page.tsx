import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import type { AuditEventSummary } from "../../../../../../packages/domain/administration/models";
import { queryAdminAuditLog } from "../../../../../../packages/domain/administration/services";
import { authorizeAuditView } from "../authorization";
import { currentAdministrationContext } from "../context";

type LoadResult = { kind: "ok"; items: AuditEventSummary[] } | { kind: "step_up_required" };

async function loadAuditLog(): Promise<LoadResult> {
  const context = await currentAdministrationContext();
  authorizeAuditView(context.actor);
  try {
    const page = await queryAdminAuditLog(context.audit, context.actor, { limit: 50 });
    return { kind: "ok", items: page.items };
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "STEP_UP_REQUIRED") {
      return { kind: "step_up_required" };
    }
    throw error;
  }
}

export default async function AdminAuditLogPage() {
  const t = await getTranslations("admin.auditLog");
  let result: LoadResult;
  try {
    result = await loadAuditLog();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-audit-log-heading" className="space-y-6">
      <div>
        <h1 id="admin-audit-log-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>

      {result.kind === "step_up_required" ? (
        <p className="rounded border p-4 text-sm">{t("stepUpRequired")}</p>
      ) : result.items.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {result.items.map((event) => (
            <li key={event.id} className="rounded border p-3">
              <p className="font-mono text-xs opacity-70">{event.createdAt.toLocaleString()}</p>
              <p className="font-medium">{event.action}</p>
              <p className="opacity-70">
                {event.resourceType}
                {event.resourceId ? ` · ${event.resourceId}` : ""} ·{" "}
                {event.actorUserId ?? t("systemActor")}
              </p>
              {event.reason ? <p className="opacity-60">{event.reason}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
