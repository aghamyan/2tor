import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@app/i18n/config";
import { MarketingChrome } from "../../../components/marketing/marketing-site";
import { HomePageContent } from "../../../components/marketing/home";

/**
 * D19: this is the marketing "front door" homepage. It renders at `/home`, not `/` — the
 * authenticated shell's `apps/web/app/(app)/page.tsx` already owns `/`, and Next.js hard-errors
 * on two route groups resolving the same path (confirmed by a throwaway `(marketing)/page.tsx`
 * probe during this task; see this task's output notes). `/home` is also the exact path the
 * pre-existing Playwright a11y suite audits as "public home" (`apps/web/tests/a11y/
 * wcag-22-aa.a11y.ts`), so this is the established, tested location, not a new convention.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await headers()).get("x-locale"));
  const t = await getTranslations({ locale, namespace: "marketing" });
  const title = t("home.meta.title");
  const description = t("home.meta.description");
  return {
    title,
    description,
    alternates: {
      languages: { en: "/en/home", hy: "/hy/home" },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale,
      siteName: "2tor",
    },
  };
}

/**
 * No absolute `url` field: the canonical site URL isn't available to a page-scoped module
 * without importing `@app/config`'s `serverEnv`, which validates the entire app's server
 * environment (database, Redis, Stripe, …) at import time — too wide a blast radius for one
 * optional JSON-LD field. `url` is optional on `EducationalOrganization`; add it once a
 * request-derived or `@app/config`-sourced origin is available for a marketing-only concern.
 */
function organizationJsonLd(locale: "en" | "hy", description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "2tor",
    description,
    inLanguage: locale,
  };
}

export default async function Page() {
  const locale = resolveLocale((await headers()).get("x-locale"));
  const t = await getTranslations({ locale, namespace: "marketing" });
  return (
    <MarketingChrome locale={locale} fullBleed>
      <HomePageContent locale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd(locale, t("home.meta.description"))),
        }}
      />
    </MarketingChrome>
  );
}
