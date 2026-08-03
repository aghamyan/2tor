import Link from "next/link";
import type { Locale } from "@app/i18n/config";

import { currentSession } from "../../../lib/current-session";
import { DesktopNav } from "./desktop-nav";
import { resolveHeaderAuthState, type HeaderAuthState } from "./header-actions";
import { HeaderActionsPanel } from "./header-actions-panel";
import { HeaderFrame } from "./header-frame";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { localizedHref } from "./nav-items";
import styles from "./site.module.css";

/**
 * `currentSession()` (`apps/web/lib/current-session.ts`) throws if `REDIS_URL` is unset or Redis
 * is unreachable — acceptable inside `(app)/*`, where a session is already required to reach the
 * route, but this header now wraps every public marketing page too. A transient Redis outage must
 * degrade those pages to the logged-out header, not 500 them.
 */
async function resolveAuthState(): Promise<HeaderAuthState> {
  try {
    return resolveHeaderAuthState(await currentSession());
  } catch {
    return resolveHeaderAuthState(null);
  }
}

export async function SiteHeader({ locale }: { locale: Locale }) {
  const authState = await resolveAuthState();

  return (
    <header className={`${styles.scope} ${styles.header} sticky top-0 z-30`}>
      {/* The focused five-item nav fits both locales from `xl`; smaller screens use the drawer. */}
      <HeaderFrame>
        <Link
          href={localizedHref(locale, "/home")}
          className={`${styles.brand} shrink-0 whitespace-nowrap text-lg font-bold tracking-tight`}
          aria-label="2tor home"
        >
          <span className={styles.brandMark}>2</span>
          <span className={styles.brandWord}>tor</span>
        </Link>
        <DesktopNav locale={locale} />
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSwitcher locale={locale} variant="compact" className="hidden xl:flex" />
          <HeaderActionsPanel locale={locale} authState={authState} />
          <MobileNav locale={locale} authState={authState} />
        </div>
      </HeaderFrame>
    </header>
  );
}
