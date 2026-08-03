/**
 * Deliberately its own file, with no `"use client"`/server directive: importing a plain constant
 * (not a component) from a `"use client"` module into a Server Component is not reliable — Next's
 * RSC bundler can replace a client module's exports with client-reference proxies for every
 * export, component or not, so a Server Component reading a client file's named constant can see
 * `undefined` at runtime even though `tsc` sees the correct string type (types are erased; nothing
 * catches the divergence). Confirmed empirically here: `sidebar.tsx` (server) importing this
 * constant from `sidebar-frame.tsx` (client) made `cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)`
 * silently return `undefined` — the collapse cookie round-tripped correctly, but the server-side
 * read of it never worked, so the sidebar always rendered expanded regardless of the cookie's
 * value. `nav-path.ts`/`nav-roles.ts` already use this same "no directive, safe from either side"
 * pattern for the same reason.
 */
export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";
export const SIDEBAR_COLLAPSED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
