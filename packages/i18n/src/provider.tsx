"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";
import { locales, type Locale } from "./config";

export type I18nProviderProps = {
  /** Current interface language. It is intentionally distinct from content language. */
  locale: Locale;
  messages: AbstractIntlMessages;
  children: ReactNode;
};

/** Re-render this provider with a new locale and its messages to switch all next-intl strings. */
export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export type LocaleSwitcherProps = {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  label?: string;
};

/** A controlled UI switcher; persist the chosen interface locale in the host application. */
export function LocaleSwitcher({
  locale,
  onLocaleChange,
  label = "Language",
}: LocaleSwitcherProps) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)}>
        {locales.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {supportedLocale === "en" ? "English" : "Հայերեն"}
          </option>
        ))}
      </select>
    </label>
  );
}
