import { resolveLocale } from "@app/i18n/config";
import { formatDateTime } from "@app/i18n/formats";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { summarizeDevice } from "./device-summary";
import { loadSessionsList } from "./queries";
import { SessionList, type SessionRowViewModel } from "./session-list";
import styles from "./sessions.module.css";

export const dynamic = "force-dynamic";

/**
 * "Manage devices" (task requirement #10). Sessions come straight from `@app/auth`'s
 * `listSessionsForUser` (Redis is the source of truth for what's actually still live) — there is
 * no IP-to-location resolution anywhere in this codebase yet (verified: `SessionRecord` only ever
 * stores the raw `ipAddress`), so the row shows the IP address itself, not a derived city/region.
 */
export default async function SessionsSettingsPage() {
  const locale = resolveLocale((await headers()).get("x-locale"));
  const t = await getTranslations("auth.sessions");
  const { sessions, currentSessionId } = await loadSessionsList();

  const rows: SessionRowViewModel[] = sessions.map((session) => {
    const { browser, os } = summarizeDevice(session.userAgent);
    const deviceLabel =
      browser && os ? `${browser} · ${os}` : (browser ?? os ?? t("unknownDevice"));
    return {
      id: session.id,
      isCurrentDevice: session.id === currentSessionId,
      deviceLabel,
      ipAddress: session.ipAddress,
      lastActiveDisplay: formatDateTime(session.lastSeenAt, locale, "UTC"),
    };
  });

  return (
    <main className={styles.shell}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.description}>{t("description")}</p>
      <SessionList sessions={rows} />
    </main>
  );
}
