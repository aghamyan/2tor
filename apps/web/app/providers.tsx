"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";

// Deep, type-only import (not the `@app/i18n` barrel): the barrel's `index.ts` also re-exports
// `provider.tsx`, which has a pre-existing type error unrelated to this task (see
// docs/INFRA.md and apps/web/README.md, "Known constraints"). Importing straight from `./config`
// avoids tsc ever needing to check that file, and being type-only means it carries no runtime
// dependency on the barrel either way (see the note below on `NextIntlClientProvider`).
import type { Locale } from "@app/i18n/config";

export type Theme = "light" | "dark";

const THEME_COOKIE_NAME = "theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads/toggles the shell's theme. Must be used within `<Providers>`. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within <Providers>");
  return context;
}

function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Keeps the `.dark` class (see packages/ui/src/theme/tokens.css) in sync with state; the
  // server already rendered the correct class from the `theme` cookie, so this only matters
  // once the user actually toggles.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      document.cookie = `${THEME_COOKIE_NAME}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export interface ProvidersProps {
  locale: Locale;
  messages: AbstractIntlMessages;
  initialTheme: Theme;
  children: ReactNode;
}

/**
 * Composes the shell's client-side providers: i18n messages and theme.
 *
 * Uses `NextIntlClientProvider` directly rather than `@app/i18n`'s `I18nProvider` (a thin wrapper
 * around the same component). `@app/i18n`'s package.json only exposes a single `"."` entry point,
 * so importing anything from it at runtime — even just `I18nProvider` — pulls its whole barrel
 * into this "use client" file's bundle, including the fs-dependent `getMessages.ts`. Turbopack
 * hard-errors on `node:fs/promises` in a client chunk, so this file re-implements the ~2-line
 * wrapper instead of importing it.
 *
 * There is deliberately no data-fetching/query provider (e.g. TanStack Query) here: no such
 * library is among `apps/web`'s dependencies, and adding one means editing
 * `apps/web/package.json`, which is out of scope for this shell task (see README, "Known
 * constraints"). A pass-through placeholder provider would be an empty abstraction with nothing
 * to compose, so it's omitted rather than stubbed.
 */
export function Providers({ locale, messages, initialTheme, children }: ProvidersProps) {
  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={messages} timeZone="UTC">
      <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
    </NextIntlClientProvider>
  );
}
