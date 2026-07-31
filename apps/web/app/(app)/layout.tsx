import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { currentSession } from "../../lib/current-session";
import { discoverNavItems } from "../../lib/nav-registry";
import { filterNavByRole } from "../../lib/role-guard";

/**
 * Shell for every authenticated route. `proxy.ts` already guarantees a session cookie is
 * present before a request reaches here (see its "coarse, cookie-presence gate" comment); the
 * authoritative `authorize()` check for a specific page/action still belongs to that page, via
 * `../../lib/role-guard.ts`.
 *
 * The session is resolved through Redis before navigation is rendered, and every item is filtered
 * against the actor's roles. Page/action authorization remains authoritative deeper in the tree.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [navItems, session, t] = await Promise.all([
    discoverNavItems(),
    currentSession(),
    getTranslations(),
  ]);
  const visibleNavItems = session ? filterNavByRole(navItems, session.roles) : [];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b p-4 md:w-56 md:border-b-0 md:border-r">
        <nav aria-label="Primary">
          {visibleNavItems.length === 0 ? (
            <p className="text-sm opacity-70">No modules registered yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleNavItems.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>{t(item.label as never)}</Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
