import { headers } from "next/headers";
import type { ReactNode } from "react";
import { resolveLocale } from "@app/i18n/config";

import { marketingFontVariables } from "../../components/marketing/fonts";
import { Footer } from "../../components/marketing/site/footer";
import { SiteHeader } from "../../components/marketing/site/site-header";
import styles from "./surface.module.css";

/**
 * Shell for public routes (marketing pages, login/signup) — no nav registry, no auth gate.
 * `proxy.ts` treats everything outside its `PUBLIC_PATHS` allowlist as protected by
 * default, so a page rendered under this group must have its path added there to be reachable
 * without a session.
 *
 * `x-locale` is set by `proxy.ts` on every request that reaches here (see that file's
 * `LOCALE_HEADER` comment) — the same header every page in this route group already reads via
 * `resolveLocale((await headers()).get("x-locale"))` for its own metadata/content, so this adds
 * no new request dependency. `SiteHeader` resolves the session itself (server-side, via
 * `currentSession()`) so the logged-in/out state is correct on first paint with no client flicker.
 *
 * `data-surface="vz"` scopes the Varzharan design system defined in `app/globals.css`. Every
 * `--vz-*` token is declared against that attribute, so setting it here — and nowhere under
 * `(app)/*` — is what keeps the public palette off the authenticated dashboards. Marketing CSS
 * modules alias their own local tokens onto `--vz-*`; custom properties cascade through the DOM
 * regardless of which stylesheet declared them, so module-scoped rules resolve against it
 * normally. `/login` renders inside this layout and is covered by the same attribute.
 */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const locale = resolveLocale((await headers()).get("x-locale"));

  return (
    <div data-surface="vz" className={`${marketingFontVariables} ${styles.surface}`}>
      <SiteHeader locale={locale} />
      <div className="flex-1">{children}</div>
      <Footer locale={locale} />
    </div>
  );
}
