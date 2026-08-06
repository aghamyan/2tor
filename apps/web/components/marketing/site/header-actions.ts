import type { Role, SessionRecord } from "@app/auth";

/**
 * The structural half of a header action button: layout, hit area and type scale. The visual half
 * lives in `site.module.css` (`.buttonPrimary` / `.buttonSecondary`).
 *
 * Exported because the home hero reuses the consultation button verbatim — same classes, same
 * styles, same destination — and a second hand-copied utility string would drift from this one the
 * first time either is touched.
 */
export const headerButtonClass =
  "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold";

/**
 * Pure session -> header-state mapping, kept separate from JSX so it can be unit tested directly:
 * apps/web's Vitest config has no JSX transform (see tests/marketing/home/structure.test.ts's
 * file-level comment), so a component can't be rendered in a unit test to verify the
 * logged-in/logged-out branch. This function is what that branch actually depends on.
 */
export type HeaderAuthState =
  { kind: "logged-out" } | { kind: "logged-in"; dashboardHref: string; roleLabelKey: string };

const ROLE_LABEL_KEY: Record<Role, string> = {
  parent: "site.account.role.parent",
  student: "site.account.role.student",
  tutor: "site.account.role.tutor",
  finance: "site.account.role.finance",
  administrator: "site.account.role.administrator",
  super_administrator: "site.account.role.superAdministrator",
};

/**
 * `SessionRecord.roles` is never empty for a real session (`createSession` requires at least one
 * role), but a session record shaped by a future caller with an empty array should still degrade
 * to "logged out" rather than render an account menu with no role to label.
 */
export function resolveHeaderAuthState(
  session: Pick<SessionRecord, "roles"> | null,
): HeaderAuthState {
  const primaryRole = session?.roles[0];
  if (!primaryRole) return { kind: "logged-out" };
  return {
    kind: "logged-in",
    dashboardHref: "/dashboard",
    roleLabelKey: ROLE_LABEL_KEY[primaryRole],
  };
}
