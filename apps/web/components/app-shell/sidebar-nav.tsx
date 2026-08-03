"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HomeIcon, NavItemIcon } from "./icons";
import { isActiveNavHref } from "./nav-path";
import styles from "./app-shell.module.css";

export interface ResolvedNavItem {
  id: string;
  label: string;
  href: string;
}
export interface ResolvedNavGroup {
  id: string;
  label: string;
  items: ResolvedNavItem[];
}

/**
 * The only piece of the sidebar that needs to know the current route (for `aria-current`), so
 * it's the only client island here — `sidebar.tsx` resolves and role-filters `groups` server-side
 * and passes plain, already-authorized data down. Highlighting the active item client-side changes
 * nothing about *which* links exist; it cannot show a link the server didn't already include.
 */
export function SidebarNav({
  ariaLabel,
  homeHref,
  homeLabel,
  showHome = true,
  groups,
  emptyLabel,
}: {
  ariaLabel: string;
  homeHref: string;
  homeLabel: string;
  showHome?: boolean;
  groups: readonly ResolvedNavGroup[];
  emptyLabel: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className={`${styles.sidebarNav} flex flex-1 flex-col gap-1 overflow-y-auto`}
    >
      {showHome ? (
        <>
          <Link
            href={homeHref}
            title={homeLabel}
            aria-current={isActiveNavHref(pathname, homeHref) ? "page" : undefined}
            className={`${isActiveNavHref(pathname, homeHref) ? styles.navLinkActive : styles.homeLink} flex items-center gap-3 text-sm font-semibold`}
          >
            <span
              aria-hidden="true"
              className={`${styles.navGlyph} flex shrink-0 items-center justify-center`}
            >
              <HomeIcon className="size-4" />
            </span>
            <span className={styles.sidebarLabel}>{homeLabel}</span>
          </Link>
          <div className={`${styles.sidebarDivider} my-2 h-px shrink-0`} />
        </>
      ) : null}

      {groups.length === 0 ? (
        <p className={`${styles.emptyNav} ${styles.sidebarLabel} px-2.5 text-sm`}>{emptyLabel}</p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5 py-1.5">
            <p
              className={`${styles.navGroupLabel} ${styles.sidebarLabel} px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide`}
            >
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActiveNavHref(pathname, item.href);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`${active ? styles.navLinkActive : styles.navLink} flex items-center gap-3 text-sm`}
                    >
                      <span
                        aria-hidden="true"
                        className={`${styles.navGlyph} flex shrink-0 items-center justify-center`}
                      >
                        <NavItemIcon itemId={item.id} className="size-4" />
                      </span>
                      <span className={styles.sidebarLabel}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </nav>
  );
}
