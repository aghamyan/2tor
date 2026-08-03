import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell/app-shell";
import { currentSession } from "../../lib/current-session";
import { discoverNavItems, groupNavItems } from "../../lib/nav-registry";

/**
 * Shell for every authenticated route. `proxy.ts` already guarantees a session cookie is
 * present before a request reaches here (see its "coarse, cookie-presence gate" comment); the
 * authoritative `authorize()` check for a specific page/action still belongs to that page.
 *
 * Nav items are discovered, then filtered *and* grouped against the actor's roles by
 * `../../lib/nav-registry.ts`'s `groupNavItems` — which itself delegates role filtering to
 * `../../lib/role-guard.ts`'s `filterNavByRole`, not reimplemented here — before `AppShell` renders
 * anything. A role never receives a link for a module it can't access, not even briefly; page and
 * action authorization remain authoritative deeper in the tree regardless of what the sidebar
 * shows.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [navItems, session] = await Promise.all([discoverNavItems(), currentSession()]);

  // Defensive only: `proxy.ts` redirects an unauthenticated request to `/login` for every
  // non-public path, so reaching this point with `session === null` means a cookie survived that
  // coarse presence check but the Redis-backed session it names has since expired or been
  // revoked. There is nothing role-appropriate to show, and the destination page underneath
  // already redirects to `/login` on the same condition (see e.g. `(app)/payouts/queries.ts`), so
  // the shell steps aside instead of rendering a nav-less version of itself.
  if (!session) return <>{children}</>;

  // The authenticated product is a management workspace, so every actor gets the complete set
  // of modules their role is authorized to open. Page and action guards remain authoritative;
  // this only makes those existing destinations discoverable from the persistent sidebar.
  const groups = groupNavItems(navItems, session.roles);

  return (
    <AppShell session={session} groups={groups}>
      {children}
    </AppShell>
  );
}
