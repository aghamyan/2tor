import { defaultLocale, resolveLocale, type Locale } from "@app/i18n/config";
import { headers } from "next/headers";

/** Mirrors the root layout without requiring next-intl's optional server request config. */
export async function currentDashboardLocale(): Promise<Locale> {
  return resolveLocale((await headers()).get("x-locale") ?? defaultLocale);
}
