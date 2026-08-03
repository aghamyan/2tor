"use client";

import { useState, type ReactNode } from "react";

import { ChevronsLeftIcon, ChevronsRightIcon } from "./icons";
import { SIDEBAR_COLLAPSED_COOKIE, SIDEBAR_COLLAPSED_COOKIE_MAX_AGE } from "./sidebar-cookie";
import styles from "./app-shell.module.css";

/**
 * Collapse state persists in a cookie (not `localStorage`), read server-side by
 * `sidebar.tsx` before first paint — the same approach `app/providers.tsx` uses for the theme
 * toggle. `localStorage` can only be read client-side, which would render the wrong width on
 * first paint and then snap, which is exactly the flicker the perf requirement rules out.
 *
 * Only this frame (the collapse affordance) is a client island; the nav content passed as
 * `children` is server-rendered markup from `sidebar.tsx`, unaffected by this component's state.
 */
export function SidebarFrame({
  initialCollapsed,
  expandLabel,
  collapseLabel,
  children,
}: {
  initialCollapsed: boolean;
  expandLabel: string;
  collapseLabel: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${SIDEBAR_COLLAPSED_COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={`${styles.sidebar} hidden shrink-0 flex-col md:sticky md:top-0 md:flex md:h-screen ${collapsed ? "md:w-[5.25rem]" : "md:w-[17.5rem]"}`}
    >
      {children}
      <div className={`${styles.sidebarFooter} mt-auto border-t p-2`}>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? expandLabel : collapseLabel}
          className={`${styles.collapseButton} flex w-full items-center gap-3 px-3 py-2 text-sm font-medium`}
        >
          {collapsed ? (
            <ChevronsRightIcon className="size-4 shrink-0" />
          ) : (
            <ChevronsLeftIcon className="size-4 shrink-0" />
          )}
          <span className={styles.sidebarLabel}>{collapsed ? expandLabel : collapseLabel}</span>
        </button>
      </div>
    </aside>
  );
}
