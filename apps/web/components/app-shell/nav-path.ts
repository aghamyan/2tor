const LOCALES = ["en", "hy"] as const;

/**
 * Strips a leading locale segment from a browser pathname (`usePathname()` reflects the visited
 * URL, which is locale-prefixed — e.g. `/en/payouts` — even though `proxy.ts` internally rewrites
 * the request to the unprefixed `/payouts` before it reaches a page). `NavItem.href` is always
 * unprefixed, so comparisons against it must strip the same way `proxy.ts`'s `stripLocale` does.
 */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  if (!(LOCALES as readonly string[]).includes(maybeLocale ?? "")) return pathname;
  const rest = `/${segments.slice(2).join("/")}`;
  return rest === "/" ? "/" : rest.replace(/\/$/, "");
}

/**
 * A nav item is active on its own route and any nested route beneath it (`/payouts/batches/1`
 * activates the `/payouts` item), never on an unrelated route that merely shares a prefix
 * (`/payoutsomething` must not match `/payouts`).
 */
export function isActiveNavHref(pathname: string, href: string): boolean {
  const current = stripLocalePrefix(pathname);
  if (current === href) return true;
  return current.startsWith(`${href}/`);
}
