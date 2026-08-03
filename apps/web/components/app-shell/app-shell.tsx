import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { SessionRecord } from "@app/auth";

import type { NavGroup } from "../../lib/nav-registry";
import { primaryRole } from "./nav-roles";
import { shellUserIdentity } from "./shell-data";
import { Sidebar } from "./sidebar";
import { StudentBottomNav } from "./student-bottom-nav";
import type { ResolvedNavGroup } from "./sidebar-nav";
import { Topbar, type TopbarLabels } from "./topbar";
import styles from "./app-shell.module.css";

/**
 * Not a registered domain module (no `packages/domain/<module>/nav.ts`), so it's pinned here rather than
 * discovered — every role redirects here from `(dashboards)/dashboard`'s own role resolution (see
 * that route group's README), making it a safe, always-authorized landing link regardless of which
 * roles a session holds. It also gives sessions a real destination independent of
 * `(app)/page.tsx`'s existing stub, which redirects to the *first* discovered nav item with no
 * regard for the actor's roles (flagged in this task's output notes; that file is outside this
 * task's allowed edits).
 */
const HOME_HREF = "/dashboard";
/** Matches `app/layout.tsx`'s existing `<title>` metadata ("2tor") — not re-translated, same as that file's own hardcoded brand string. */
const BRAND = "2tor";

/**
 * Composes the authenticated shell: collapsible sidebar, topbar (breadcrumbs, search slot,
 * notification bell, user menu), and the page content. `groups` arrives already role-filtered by
 * `(app)/layout.tsx` (via `lib/nav-registry.ts`'s `groupNavItems`) — this component only resolves
 * i18n labels and lays chrome out around it; it never adds, removes, or reorders which items are
 * visible.
 */
export async function AppShell({
  session,
  groups,
  minimalNav = false,
  children,
}: {
  session: SessionRecord;
  groups: readonly NavGroup[];
  /** Learning roles navigate from Classes/Homework rather than a duplicate overview link. */
  minimalNav?: boolean;
  children: ReactNode;
}) {
  const [t, identity] = await Promise.all([getTranslations(), shellUserIdentity(session.userId)]);

  const baseResolvedGroups: ResolvedNavGroup[] = groups.map((group) => ({
    id: group.id,
    label: t(group.labelKey as never),
    items: group.items.map((item) => ({
      id: item.id,
      label: t(item.label as never),
      href: item.href,
    })),
  }));

  const role = primaryRole(session.roles);
  const isStudent = role === "student";
  const isTutor = role === "tutor";
  const byId = new Map(
    baseResolvedGroups.flatMap((group) => group.items).map((item) => [item.id, item]),
  );
  /**
   * Re-labels and re-groups a role's items around how that role actually thinks about the
   * workspace, without changing which items exist — `byId` only draws from `baseResolvedGroups`,
   * so a role can never see a link `groupNavItems` didn't already authorize. Shared by the student
   * and tutor branches below; `namespace` selects the `appShell.<namespace>.items.*` label set.
   */
  const roleGroup = (
    namespace: "studentNav" | "tutorNav",
    id: string,
    label: string,
    itemIds: readonly string[],
  ): ResolvedNavGroup => ({
    id,
    label,
    items: itemIds.flatMap((itemId) => {
      const item = byId.get(itemId);
      if (!item) return [];
      const messageId = itemId.replaceAll(".", "_");
      return [{ ...item, label: t(`appShell.${namespace}.items.${messageId}` as never) }];
    }),
  });
  const resolvedGroups: ResolvedNavGroup[] = isStudent
    ? [
        roleGroup("studentNav", "learning", t("appShell.studentNav.groups.learning"), [
          "scheduling.overview",
          "assignments.overview",
          "assessments.overview",
          "projects.overview",
        ]),
        roleGroup("studentNav", "progress", t("appShell.studentNav.groups.progress"), [
          "academics.overview",
          "gamification.overview",
        ]),
        roleGroup("studentNav", "resources", t("appShell.studentNav.groups.resources"), [
          "content.overview",
          "discussions.overview",
        ]),
        roleGroup("studentNav", "communication", t("appShell.studentNav.groups.communication"), [
          "communication.inbox",
        ]),
        roleGroup("studentNav", "help", t("appShell.studentNav.groups.help"), ["support.queue"]),
      ].filter((group) => group.items.length > 0)
    : isTutor
      ? [
          roleGroup("tutorNav", "teaching", t("appShell.tutorNav.groups.teaching"), [
            "scheduling.overview",
            "tutors.students",
            "assignments.overview",
            "assessments.overview",
            "projects.overview",
          ]),
          roleGroup("tutorNav", "progress", t("appShell.tutorNav.groups.progress"), [
            "academics.overview",
            "gamification.overview",
          ]),
          roleGroup("tutorNav", "resources", t("appShell.tutorNav.groups.resources"), [
            "content.overview",
            "discussions.overview",
          ]),
          roleGroup("tutorNav", "communication", t("appShell.tutorNav.groups.communication"), [
            "communication.inbox",
          ]),
          roleGroup("tutorNav", "workspace", t("appShell.tutorNav.groups.workspace"), [
            "tutors.profile",
          ]),
          roleGroup("tutorNav", "finance", t("appShell.tutorNav.groups.finance"), [
            "payouts.overview",
          ]),
          roleGroup("tutorNav", "help", t("appShell.tutorNav.groups.help"), ["support.queue"]),
        ].filter((group) => group.items.length > 0)
      : baseResolvedGroups;

  const homeLabel = t("appShell.nav.home");
  const labelByHref: Record<string, string> = { [HOME_HREF]: homeLabel };
  for (const group of resolvedGroups) {
    for (const item of group.items) labelByHref[item.href] = item.label;
  }

  const roleLabel = role ? t(`appShell.userMenu.roles.${role}` as never) : "";
  const displayName = identity.email ?? identity.username ?? session.userId;

  const topbarLabels: TopbarLabels = {
    breadcrumbsAriaLabel: t("appShell.topbar.breadcrumbs.ariaLabel"),
    mobileNavAriaLabel: t("appShell.nav.ariaLabel"),
    mobileNavOpen: t("appShell.mobileNav.open"),
    mobileNavClose: t("appShell.mobileNav.close"),
    mobileNavTitle: t("appShell.mobileNav.title"),
    navEmpty: t("appShell.nav.empty"),
    searchLabel: t("appShell.topbar.search.label"),
    searchPlaceholder: t("appShell.topbar.search.placeholder"),
    messages: t("appShell.topbar.messages"),
    notificationsUnread: (count) => t("appShell.topbar.notifications.unread", { count }),
    notificationsEmpty: t("appShell.topbar.notifications.empty"),
    userMenuLabel: t("appShell.userMenu.label"),
    userMenuSettings: t("appShell.userMenu.settings"),
    userMenuLogOut: t("appShell.userMenu.logOut"),
  };

  return (
    <div className={`${styles.scope} ${styles.shell} flex min-h-screen`}>
      <a
        href="#app-shell-content"
        className={`${styles.skipLink} fixed z-50 rounded-md px-3 py-2 text-sm font-semibold`}
      >
        {t("appShell.skipToContent")}
      </a>
      <Sidebar
        brand={BRAND}
        brandCaption={t("appShell.sidebar.brandCaption")}
        ariaLabel={t("appShell.nav.ariaLabel")}
        homeHref={HOME_HREF}
        homeLabel={homeLabel}
        showHome={!minimalNav}
        groups={resolvedGroups}
        emptyLabel={t("appShell.nav.empty")}
        expandLabel={t("appShell.sidebar.expand")}
        collapseLabel={t("appShell.sidebar.collapse")}
        displayName={displayName}
        roleLabel={isStudent ? t("appShell.sidebar.studentLevel") : roleLabel}
      />
      <div className={`${styles.mainColumn} flex min-w-0 flex-1 flex-col`}>
        <Topbar
          userId={session.userId}
          displayName={displayName}
          roleLabel={roleLabel}
          homeHref={HOME_HREF}
          homeLabel={homeLabel}
          showHome={!minimalNav}
          groups={resolvedGroups}
          labelByHref={labelByHref}
          labels={topbarLabels}
          showMessages={isStudent}
        />
        <main id="app-shell-content" className={`${styles.content} flex-1`}>
          {children}
        </main>
        {isStudent ? <StudentBottomNav /> : null}
      </div>
    </div>
  );
}
