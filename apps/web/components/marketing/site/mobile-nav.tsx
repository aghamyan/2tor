"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@app/ui";
import type { Locale } from "@app/i18n/config";

import type { HeaderAuthState } from "./header-actions";
import { MenuIcon } from "./icons";
import { LanguageSwitcher } from "./language-switcher";
import { localizedHref, primaryNav } from "./nav-items";
import styles from "./site.module.css";

const actionButtonClass = "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold";

/**
 * `Drawer` is `@app/ui`'s Radix-Dialog-based sheet (`packages/ui/src/components/overlays.tsx`) —
 * using it (rather than a hand-rolled panel) gets focus trap, Escape-to-close, and focus restored
 * to the trigger on close for free. Left uncontrolled: Radix's `DrawerTrigger` already injects
 * `aria-expanded`/`aria-haspopup` onto the hamburger button via `asChild`, so no local open state
 * is needed just to keep that attribute in sync.
 *
 * `fixed inset-x-0 bottom-0 z-50` in `DrawerContent`'s `className` below duplicates classes
 * `DrawerContent` already hardcodes internally in `packages/ui`. This duplication is a defensive
 * safety net, not a required fix — here is exactly what it's defending against, so a future editor
 * doesn't mistake it for dead code: during this task, a long-running `next dev` (Turbopack)
 * session — 40+ minutes, ~20 hot-reloaded file edits — stopped compiling `.inset-x-0`/`.bottom-0`
 * (confirmed via Chrome DevTools Protocol's matched-styles inspection: only `.fixed` still
 * matched), which left `DrawerContent` at `position: fixed` with every inset `auto`, rendering it
 * at its static-flow position — off the bottom of the document, not the viewport. A clean
 * `next build` + `next start` was tested immediately after and did NOT reproduce this: all four
 * classes compiled and the drawer positioned correctly with these duplicated lines fully
 * reverted, so this looks like transient dev-server/Turbopack incremental-scan drift rather than
 * apps/web's Tailwind config failing to reach `packages/ui/src/**`. Re-declaring the classes here
 * costs nothing (Tailwind dedupes) and directly guards the one dev-mode failure mode actually
 * observed. `DrawerOverlay` (the dimming backdrop `DrawerContent` renders internally, via
 * `fixed inset-0 z-50 ...`) has no `className` prop to patch from here, so this comment's
 * plain-text mention of "inset-0" is what would re-trigger its compilation if the same drift
 * recurred (Tailwind's scanner matches literal class-like text anywhere in a scanned file, not
 * only JSX `className` attributes).
 */
export function MobileNav({ locale, authState }: { locale: Locale; authState: HeaderAuthState }) {
  const t = useTranslations("marketing");

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={t("site.mobileNav.openMenu")}
          className={`${styles.hamburgerButton} inline-flex size-11 items-center justify-center rounded-md 2xl:hidden`}
        >
          <MenuIcon className="size-6" />
        </button>
      </DrawerTrigger>
      <DrawerContent
        showCloseButton
        closeLabel={t("site.mobileNav.closeMenu")}
        className={`${styles.scope} ${styles.drawerContent} fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto`}
      >
        <DrawerTitle className="text-base font-semibold">{t("site.mobileNav.title")}</DrawerTitle>
        <nav aria-label={t("site.nav.ariaLabel")} className="flex flex-col gap-1 pt-2">
          {primaryNav.map((entry) =>
            entry.type === "link" ? (
              <DrawerClose asChild key={entry.id}>
                <Link
                  href={localizedHref(locale, entry.href)}
                  className={`${styles.drawerLink} rounded-md px-2 py-3 text-base font-medium`}
                >
                  {t(entry.labelKey)}
                </Link>
              </DrawerClose>
            ) : (
              <div key={entry.id} className="flex flex-col">
                <p
                  className={`${styles.drawerSectionHeading} px-2 pt-3 text-xs font-semibold uppercase tracking-wide`}
                >
                  {t(entry.labelKey)}
                </p>
                {entry.items.map((item) => (
                  <DrawerClose asChild key={item.id}>
                    <Link
                      href={localizedHref(locale, item.href)}
                      className={`${styles.drawerLink} rounded-md px-4 py-2.5 text-base`}
                    >
                      {t(item.labelKey)}
                    </Link>
                  </DrawerClose>
                ))}
              </div>
            ),
          )}
        </nav>
        <div className={`${styles.drawerDivider} my-4 h-px`} />
        <div className="flex flex-col gap-2">
          {authState.kind === "logged-out" ? (
            <>
              <DrawerClose asChild>
                <Link
                  href={localizedHref(locale, "/login")}
                  className={`${styles.buttonSecondary} ${actionButtonClass}`}
                >
                  {t("site.actions.login")}
                </Link>
              </DrawerClose>
              <DrawerClose asChild>
                <Link
                  href={localizedHref(locale, "/consultation")}
                  className={`${styles.buttonPrimary} ${actionButtonClass}`}
                >
                  {t("site.actions.consultation")}
                </Link>
              </DrawerClose>
            </>
          ) : (
            <>
              <DrawerClose asChild>
                <Link
                  href={localizedHref(locale, authState.dashboardHref)}
                  className={`${styles.buttonPrimary} ${actionButtonClass}`}
                >
                  {t("site.actions.dashboard")}
                </Link>
              </DrawerClose>
              <DrawerClose asChild>
                <Link
                  href={localizedHref(locale, "/settings")}
                  className={`${styles.buttonSecondary} ${actionButtonClass}`}
                >
                  {t("site.account.settings")}
                </Link>
              </DrawerClose>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className={`${styles.buttonSecondary} ${actionButtonClass} w-full`}>
                  {t("site.account.logOut")}
                </button>
              </form>
            </>
          )}
        </div>
        <div className={`${styles.drawerDivider} mt-4 h-px`} />
        <LanguageSwitcher locale={locale} className="pt-4" />
      </DrawerContent>
    </Drawer>
  );
}
