"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@app/ui";

import { HomeIcon, MenuIcon } from "./icons";
import { isActiveNavHref } from "./nav-path";
import type { ResolvedNavGroup } from "./sidebar-nav";
import styles from "./app-shell.module.css";

/**
 * `Drawer` is `@app/ui`'s Radix-Dialog-based sheet — using it (rather than a hand-rolled panel)
 * gets focus trap, Escape-to-close, and focus restored to the trigger on close for free, matching
 * `components/marketing/site/mobile-nav.tsx`'s precedent for the same requirement. Radix portals
 * `DrawerContent` to `document.body`, outside this tree's normal DOM inheritance, so `.scope`
 * (the local `--shell-*` CSS variables) is re-applied directly on `DrawerContent` rather than
 * relying on an ancestor — the same reason that file re-applies `.scope` on its own drawer.
 *
 * Renders the exact same role-filtered `groups`/`homeHref` data as `sidebar-nav.tsx` — a second,
 * separate client component (not shared React instance) because it's a fundamentally different
 * container (a modal sheet vs. a persistent aside), same split marketing's desktop/mobile nav use.
 */
export function MobileNav({
  openLabel,
  closeLabel,
  title,
  ariaLabel,
  homeHref,
  homeLabel,
  showHome = true,
  groups,
  emptyLabel,
}: {
  openLabel: string;
  closeLabel: string;
  title: string;
  ariaLabel: string;
  homeHref: string;
  homeLabel: string;
  showHome?: boolean;
  groups: readonly ResolvedNavGroup[];
  emptyLabel: string;
}) {
  const pathname = usePathname();
  const homeActive = isActiveNavHref(pathname, homeHref);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={openLabel}
          className={`${styles.hamburgerButton} inline-flex size-10 items-center justify-center rounded-md md:hidden`}
        >
          <MenuIcon className="size-5" />
        </button>
      </DrawerTrigger>
      <DrawerContent
        showCloseButton
        closeLabel={closeLabel}
        className={`${styles.scope} ${styles.drawerContent} fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto`}
      >
        <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
        <nav aria-label={ariaLabel} className="flex flex-col gap-0.5 pt-3">
          {showHome ? (
            <>
              <DrawerClose asChild>
                <Link
                  href={homeHref}
                  aria-current={homeActive ? "page" : undefined}
                  className={`${styles.drawerLink} ${homeActive ? styles.drawerLinkActive : ""} flex items-center gap-2 rounded-md px-2 py-2.5 text-base font-semibold`}
                >
                  <HomeIcon className="size-4" aria-hidden="true" />
                  {homeLabel}
                </Link>
              </DrawerClose>
              <div className={`${styles.drawerDivider} my-2 h-px`} />
            </>
          ) : null}
          {groups.length === 0 ? (
            <p className="px-2 text-sm">{emptyLabel}</p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="flex flex-col">
                <p
                  className={`${styles.drawerSectionHeading} px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide`}
                >
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const active = isActiveNavHref(pathname, item.href);
                  return (
                    <DrawerClose asChild key={item.id}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`${styles.drawerLink} ${active ? styles.drawerLinkActive : ""} rounded-md px-4 py-2.5 text-base`}
                      >
                        {item.label}
                      </Link>
                    </DrawerClose>
                  );
                })}
              </div>
            ))
          )}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
