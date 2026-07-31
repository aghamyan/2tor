import type { Locale } from "@app/i18n/config";

const LEADING_LOCALE_SEGMENT = /^\/(en|hy)(?=\/|$)/;

/**
 * Builds the same-page href for the other locale. Written to be correct regardless of whether
 * `usePathname()` reports the browser's visible URL (`/hy/pricing`) or the post-`proxy.ts`-rewrite
 * internal path (`/pricing`) — Next's behavior here isn't the same across versions, and this repo's
 * `proxy.ts` rewrites a locale-prefixed request to its locale-stripped internal path, so the caller
 * cannot assume which form it receives. Stripping any leading `/en`/`/hy` segment before
 * re-prefixing makes both inputs converge on the same, correct output.
 */
export function buildLocaleSwitchHref(pathname: string, targetLocale: Locale): string {
  const stripped = pathname.replace(LEADING_LOCALE_SEGMENT, "");
  const rest = stripped === "" || stripped === "/" ? "" : stripped;
  return `/${targetLocale}${rest}`;
}
