import type { ReactNode } from "react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

// Deep imports (not the `@app/i18n` barrel): `packages/i18n/src/index.ts` also re-exports
// `provider.tsx`, which has a pre-existing type error (documented in docs/INFRA.md — missing
// react types) unrelated to this task and out of scope to fix (`packages/*` is locked). Pulling
// in only `./config` and `./getMessages` avoids tsc ever needing to check that file. This relies
// on `tsconfig.base.json`'s existing `"@app/i18n/*"` path mapping, which resolves straight to the
// package's source files, independent of its package.json `exports` map.
import { defaultLocale, resolveLocale } from "@app/i18n/config";
import { getMessages } from "@app/i18n/getMessages";

import { Providers, type Theme } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "2tor",
    template: "%s | 2tor",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const requestCookies = await cookies();

  // Set by proxy.ts after stripping the locale prefix from the URL; falls back to the default
  // locale for any render path the proxy didn't run in front of (e.g. Vitest).
  const locale = resolveLocale(requestHeaders.get("x-locale") ?? defaultLocale);
  const messages = await getMessages(locale);
  const theme: Theme = requestCookies.get("theme")?.value === "dark" ? "dark" : "light";

  return (
    <html lang={locale} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <body>
        <Providers locale={locale} messages={messages} initialTheme={theme}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
