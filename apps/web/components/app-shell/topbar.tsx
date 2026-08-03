import { Suspense } from "react";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";

import { Breadcrumbs } from "./breadcrumbs";
import { MobileNav } from "./mobile-nav";
import { NotificationBell, NotificationBellFallback } from "./notification-bell";
import { SearchSlot } from "./search-slot";
import type { ResolvedNavGroup } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import styles from "./app-shell.module.css";

export interface TopbarLabels {
  breadcrumbsAriaLabel: string;
  mobileNavAriaLabel: string;
  mobileNavOpen: string;
  mobileNavClose: string;
  mobileNavTitle: string;
  navEmpty: string;
  searchLabel: string;
  searchPlaceholder: string;
  messages: string;
  notificationsUnread: (count: number) => string;
  notificationsEmpty: string;
  userMenuLabel: string;
  userMenuSettings: string;
  userMenuLogOut: string;
}

/**
 * Server component. The only work it hands to the client is inside its children (`MobileNav`'s
 * drawer state, `Breadcrumbs`'/`SidebarNav`'s active-path lookup, `UserMenu`'s open state) — the
 * breadcrumb label map, role label, and display name are all resolved once here and passed down
 * as plain strings.
 */
export function Topbar({
  userId,
  displayName,
  roleLabel,
  homeHref,
  homeLabel,
  showHome,
  groups,
  labelByHref,
  labels,
  showMessages = false,
}: {
  userId: string;
  displayName: string;
  roleLabel: string;
  homeHref: string;
  homeLabel: string;
  showHome?: boolean;
  groups: readonly ResolvedNavGroup[];
  labelByHref: Readonly<Record<string, string>>;
  labels: TopbarLabels;
  showMessages?: boolean;
}) {
  return (
    <header
      className={`${styles.scope} ${styles.topbar} sticky top-0 z-20 flex items-center gap-3 px-4 py-3 md:px-6`}
    >
      <MobileNav
        openLabel={labels.mobileNavOpen}
        closeLabel={labels.mobileNavClose}
        title={labels.mobileNavTitle}
        ariaLabel={labels.mobileNavAriaLabel}
        homeHref={homeHref}
        homeLabel={homeLabel}
        showHome={showHome}
        groups={groups}
        emptyLabel={labels.navEmpty}
      />
      <Breadcrumbs
        ariaLabel={labels.breadcrumbsAriaLabel}
        homeHref={homeHref}
        homeLabel={homeLabel}
        labelByHref={labelByHref}
      />
      <span className={`${styles.topbarRole} hidden lg:inline-flex`}>{roleLabel}</span>
      <div className={styles.topbarActions}>
        <SearchSlot label={labels.searchLabel} placeholder={labels.searchPlaceholder} />
        {showMessages ? (
          <Link
            href="/communication"
            className={styles.iconButton}
            aria-label={labels.messages}
            title={labels.messages}
          >
            <MessageSquareText aria-hidden="true" />
          </Link>
        ) : null}
        <Suspense fallback={<NotificationBellFallback emptyLabel={labels.notificationsEmpty} />}>
          <NotificationBell
            userId={userId}
            label={labels.notificationsUnread}
            emptyLabel={labels.notificationsEmpty}
          />
        </Suspense>
        <UserMenu
          displayName={displayName}
          roleLabel={roleLabel}
          menuLabel={labels.userMenuLabel}
          settingsLabel={labels.userMenuSettings}
          logOutLabel={labels.userMenuLogOut}
        />
      </div>
    </header>
  );
}
