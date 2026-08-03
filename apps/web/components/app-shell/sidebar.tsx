import { cookies } from "next/headers";

import { SIDEBAR_COLLAPSED_COOKIE } from "./sidebar-cookie";
import { SidebarFrame } from "./sidebar-frame";
import { SidebarNav, type ResolvedNavGroup } from "./sidebar-nav";
import styles from "./app-shell.module.css";

/**
 * Server component: reads the collapse cookie so the correct width renders on first paint (no
 * flicker), and renders the nav content as plain server markup. `SidebarFrame` (client) only owns
 * the collapse toggle's interactivity; `SidebarNav` (client) only owns active-item highlighting.
 * Neither can add or remove a link — both receive `groups`, already role-filtered server-side.
 */
export async function Sidebar({
  brand,
  brandCaption,
  ariaLabel,
  homeHref,
  homeLabel,
  showHome,
  groups,
  emptyLabel,
  expandLabel,
  collapseLabel,
  displayName,
  roleLabel,
}: {
  brand: string;
  brandCaption: string;
  ariaLabel: string;
  homeHref: string;
  homeLabel: string;
  showHome?: boolean;
  groups: readonly ResolvedNavGroup[];
  emptyLabel: string;
  expandLabel: string;
  collapseLabel: string;
  displayName: string;
  roleLabel: string;
}) {
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";

  return (
    <SidebarFrame
      initialCollapsed={initialCollapsed}
      expandLabel={expandLabel}
      collapseLabel={collapseLabel}
    >
      <div className={`${styles.sidebarHeader} flex items-center gap-3`}>
        <span
          aria-hidden="true"
          className={`${styles.brandMark} flex shrink-0 items-center justify-center text-sm font-bold`}
        >
          2
        </span>
        <span className={`${styles.brand} ${styles.brandLabel}`}>
          <strong>{brand}</strong>
          <small>{brandCaption}</small>
        </span>
      </div>
      <SidebarNav
        ariaLabel={ariaLabel}
        homeHref={homeHref}
        homeLabel={homeLabel}
        showHome={showHome}
        groups={groups}
        emptyLabel={emptyLabel}
      />
      <div className={styles.sidebarProfile}>
        <span aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
        <div className={styles.sidebarLabel}>
          <strong>{displayName}</strong>
          <small>{roleLabel}</small>
        </div>
      </div>
    </SidebarFrame>
  );
}
