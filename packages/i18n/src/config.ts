/** Interface language only. Keep this separate from a user's content language. */
export const locales = ["en", "hy"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export type UserLocales = {
  /** Language used for buttons, navigation, validation messages, and other UI. */
  interfaceLocale: Locale;
  /** Language of user-created or filtered content. This does not change the UI locale. */
  contentLocale: string;
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value !== undefined && value !== null && (locales as readonly string[]).includes(value);
}

/**
 * Resolves an interface locale from an Accept-Language header or navigator.languages.
 * Regional variants such as `hy-AM` resolve to `hy`.
 */
export function detectLocale(
  acceptLanguage?: string | null,
  browserLanguages: readonly string[] = [],
): Locale {
  const candidates = [
    ...(acceptLanguage
      ? acceptLanguage
          .split(",")
          .map((part) => {
            const [language, quality] = part.trim().split(";");
            return {
              language: language?.trim() ?? "",
              quality: Number(quality?.match(/q=([\d.]+)/)?.[1] ?? 1),
            };
          })
          .sort((a, b) => b.quality - a.quality)
          .map(({ language }) => language)
      : []),
    ...browserLanguages,
  ];

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase().split("-")[0];
    if (isLocale(normalized)) return normalized;
  }

  return defaultLocale;
}

/** Safely narrows untrusted stored/requested locale values before switching. */
export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}
