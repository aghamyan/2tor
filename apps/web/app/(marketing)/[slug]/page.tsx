import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@app/i18n/config";
import { pageKey, StandardPage } from "../../../components/marketing/marketing-site";
import { faqJsonLd, pageSlugs, type MarketingSlug } from "../../../components/marketing/seo";

export function generateStaticParams() {
  return pageSlugs.map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // The root layout (`app/layout.tsx`) already wraps this in a "%s | 2tor" template.
  if (!pageSlugs.includes(slug as MarketingSlug)) {
    return { title: slug.replaceAll("-", " ") };
  }
  const locale = resolveLocale((await headers()).get("x-locale"));
  const t = await getTranslations({ locale, namespace: "marketing" });
  return { title: t(`pages.${pageKey[slug as MarketingSlug]}.title`) };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!pageSlugs.includes(slug as MarketingSlug)) notFound();
  const locale = resolveLocale((await headers()).get("x-locale"));
  return (
    <>
      <StandardPage locale={locale} slug={slug as MarketingSlug} />
      {slug === "faq" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(locale)) }}
        />
      )}
    </>
  );
}
