import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import type { MarketingLeadSummary } from "../../../../../../packages/domain/administration/models";
import { listMarketingLeads } from "../../../../../../packages/domain/administration/services";
import { authorizeAdminWorkspace } from "../authorization";
import { currentAdministrationContext } from "../context";

async function loadLeads(): Promise<MarketingLeadSummary[]> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);
  return listMarketingLeads(context.database, context.actor);
}

/** "learningGoals" -> "Learning goals". Internal staff view only — not localized (see i18n note below). */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    const parts = value.filter((item) => item !== null && item !== undefined && item !== "");
    return parts.length ? parts.map(String).join(", ") : null;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

interface DetailEntry {
  label: string;
  value: string;
}

/**
 * The consultation/group-matching wizards serialize their extra fields into `message` as JSON
 * (see apps/web/components/marketing/consultation/consultation-page.tsx and
 * .../group-lessons/group-lessons.tsx); the trial-class form and the mathematics "book a free
 * class" modal send plain text instead. Render whichever shape is actually present rather than
 * dumping the raw string.
 */
function messageDetails(message: string | null): { entries: DetailEntry[]; text: string | null } {
  if (!message) return { entries: [], text: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return { entries: [], text: message };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { entries: [], text: message };
  }
  const entries = Object.entries(parsed as Record<string, unknown>)
    .map(([key, value]) => ({ label: humanizeKey(key), value: formatValue(value) }))
    .filter((entry): entry is DetailEntry => entry.value !== null);
  return { entries, text: null };
}

export default async function AdminRequestsPage() {
  const t = await getTranslations("admin.requests");
  let leads: MarketingLeadSummary[];
  try {
    leads = await loadLeads();
  } catch (error: unknown) {
    if (error instanceof AdministrationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "FORBIDDEN") redirect("/dashboard");
    }
    throw error;
  }

  return (
    <section aria-labelledby="admin-requests-heading" className="space-y-6">
      <div>
        <h1 id="admin-requests-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>
      {leads.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {leads.map((lead) => {
            const { entries, text } = messageDetails(lead.message);
            return (
              <li key={lead.id} className="rounded border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-block rounded-full border px-2 py-0.5 text-xs font-medium">
                    {t(`kind.${lead.kind}`)}
                  </span>
                  <span className="text-xs opacity-60">{lead.createdAt.toLocaleString()}</span>
                </div>
                <p className="mt-2 font-medium">{lead.parentName}</p>
                {lead.interest ? <p className="text-sm opacity-80">{lead.interest}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <a className="underline" href={`mailto:${lead.email}`}>
                    {lead.email}
                  </a>
                  {lead.phone ? (
                    <a className="underline" href={`tel:${lead.phone}`}>
                      {lead.phone}
                    </a>
                  ) : null}
                  <span className="opacity-60">{t(`locale.${lead.locale}`)}</span>
                  {lead.learnerAgeBand ? (
                    <span className="opacity-60">{t(`ageBand.${lead.learnerAgeBand}`)}</span>
                  ) : null}
                </div>
                {entries.length > 0 ? (
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    {entries.map((entry) => (
                      <div key={entry.label} className="flex gap-1">
                        <dt className="opacity-60">{entry.label}:</dt>
                        <dd>{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {text ? <p className="mt-3 text-sm opacity-80">{text}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
