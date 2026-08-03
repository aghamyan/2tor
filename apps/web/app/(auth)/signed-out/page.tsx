import { resolveLocale } from "@app/i18n/config";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import styles from "./signed-out.module.css";

export const metadata: Metadata = {
  title: "Signed out | 2tor",
};

// Reading `headers()` below already forces dynamic rendering; this just makes that intent explicit
// (same convention as `(app)/assignments/page.tsx`). It does not, by itself, set an HTTP
// `Cache-Control` response header — see this task's output notes on that gap.
export const dynamic = "force-dynamic";

/**
 * The post-logout landing page (task requirement #4/#12): a calm confirmation that the session
 * ended, a way back in, and nothing else — no name, no student data, nothing that would make this
 * page worth caching or sensitive to land on. Deliberately bare (no `AppShell`, no marketing
 * `SiteHeader`) — this route group has no layout of its own, so it only inherits the root
 * `app/layout.tsx` (html/body/providers), not `(app)/layout.tsx` or `(marketing)/layout.tsx`.
 */
export default async function SignedOutPage() {
  const locale = resolveLocale((await headers()).get("x-locale"));
  const t = await getTranslations("auth.signedOut");

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.description}>{t("description")}</p>
        <div className={styles.actions}>
          <Link href={`/${locale}/login`} className={styles.primaryLink}>
            {t("logInAgain")}
          </Link>
          <Link href={`/${locale}/home`} className={styles.secondaryLink}>
            {t("home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
