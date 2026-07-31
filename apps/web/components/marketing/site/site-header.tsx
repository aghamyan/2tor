import Link from "next/link";
import type { Locale } from "@app/i18n/config";

import { currentSession } from "../../../lib/current-session";
import { DesktopNav } from "./desktop-nav";
import { resolveHeaderAuthState, type HeaderAuthState } from "./header-actions";
import { HeaderActionsPanel } from "./header-actions-panel";
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
      {/*
       * The desktop row packs a brand mark, 7 nav entries (one a dropdown), a language switcher,
       * and two action buttons/an account menu into a single line. Measured with a real headless
       * Chromium pass against this exact markup (not estimated): Armenian labels make this row
       * ~1499px wide at the content level (brand + nav + actions, plus their gaps) — noticeably
       * more than English's ~1107px, since several hy nav labels run longer than their English
       * counterparts. Every nav/action/language-switcher element below is `shrink-0
       * whitespace-nowrap`; without that, flexbox quietly shrinks and word-wraps them (confirmed:
       * "Ինչպես է աշխատում" and "Մուտք գործել" both wrapped to two lines at 1536px, and still did
       * at 1920px, before this was added) instead of the row overflowing — which is much harder to
       * notice than a horizontal scrollbar. `max-w-[100rem]` (not the homepage body's
       * `max-w-6xl`/`max-w-7xl`) plus the `2xl` breakpoint (not `lg`, this component's original
       * threshold) give ~37px of slack at exactly 1536px viewport width in Armenian — confirmed
       * zero horizontal overflow at 1536/1600/1920px in both locales. Below `2xl`, `MobileNav`'s
       * drawer carries the same nav + actions instead.
       */}
      <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href={localizedHref(locale, "/home")}
          className={`${styles.brand} shrink-0 whitespace-nowrap text-lg font-bold tracking-tight`}
        >
          Loom կրթություն
        </Link>
        <DesktopNav locale={locale} />
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSwitcher locale={locale} variant="compact" className="hidden 2xl:flex" />
          <HeaderActionsPanel locale={locale} authState={authState} />
          <MobileNav locale={locale} authState={authState} />
        </div>
      </div>
    </header>
  );
}
