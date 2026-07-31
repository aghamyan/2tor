import { redirect } from "next/navigation";

import { discoverNavItems } from "../../lib/nav-registry";

/**
 * Role-based redirect stub for the authenticated root ("/"). This is deliberately a stub: real
 * role-based routing needs the current actor's roles, which needs a session lookup against
 * Redis — unavailable to `apps/web` today (see README, "Known constraints"). Once a domain
 * module can resolve the actor, replace the "first discovered item" choice below with one that
 * accounts for `actor.roles` (see `../../lib/role-guard.ts`'s `filterNavByRole`).
 */
export default async function AppHomePage() {
  const navItems = await discoverNavItems();
  const firstItem = navItems[0];

  if (firstItem) redirect(firstItem.href);

  return (
    <div>
      <h1>Welcome</h1>
      <p>No modules are registered yet.</p>
    </div>
  );
}
