import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@app/i18n/config";
import { LeadForm } from "./lead-form";
import styles from "./marketing.module.css";
import { Testimonial } from "./testimonial";
import type { MarketingSlug } from "./seo";
import { isSubjectCurriculumSlug, SubjectCurriculumPage } from "./subjects/subject-curriculum-page";
export { pageSlugs, faqJsonLd, type MarketingSlug } from "./seo";

export const pageKey: Record<MarketingSlug, string> = {
  "how-it-works": "howItWorks",
  mathematics: "mathematics",
  programming: "programming",
  "armenian-language-heritage": "armenianHeritage",
  sat: "sat",
  toefl: "toefl",
  "group-lessons": "groupLessons",
  "project-based-learning": "projectLearning",
  parents: "parents",
  tutors: "tutors",
  pricing: "pricing",
  consultation: "consultation",
  "free-assessment": "assessment",
  safety: "safety",
  privacy: "privacy",
  faq: "faq",
  contact: "contact",
  terms: "terms",
  "tutor-application": "tutorApplication",
};

function local(locale: Locale, path: string) {
  return `/${locale}${path === "/" ? "" : path}`;
}
function isFormPage(slug: MarketingSlug) {
  return ["consultation", "free-assessment", "contact", "tutor-application"].includes(slug);
}
function formKind(
  slug: MarketingSlug,
): "consultation" | "assessment" | "contact" | "tutor_application" {
  return slug === "free-assessment"
    ? "assessment"
    : slug === "contact"
      ? "contact"
      : slug === "tutor-application"
        ? "tutor_application"
        : "consultation";
}

/**
 * This used to render its own header, nav, and footer elements — the "bare page" chrome the
 * site-chrome task (`apps/web/components/marketing/site/**`) was written to replace. That chrome
 * now lives in `apps/web/app/(marketing)/layout.tsx` (`SiteHeader` + `Footer`), which wraps every
 * page that renders this component, so keeping the old header/nav/footer markup here would
 * double up every one of those landmarks on every marketing page. `locale` stays in the prop
 * type even though it's unused below so the three existing call sites don't need to change.
 * The `.site` wrapper itself is NOT dead: it defines the CSS custom properties (`--ink`, `--muted`,
 * `--sea`, …), global `box-sizing`, and focus-visible styling every homepage/standard-page section
 * still depends on via `var(--ink)` etc., so it stays — only the header/nav/footer markup is gone.
 */
export function MarketingChrome({
  children,
  fullBleed = false,
}: {
  locale: Locale;
  children: ReactNode;
  fullBleed?: boolean;
}) {
  return (
    <div className={styles.site}>
      <main className={fullBleed ? styles.mainFull : styles.main}>{children}</main>
    </div>
  );
}

export function HomePage({ locale }: { locale: Locale }) {
  const t = useTranslations("marketing");
  return (
    <MarketingChrome locale={locale}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{t("home.eyebrow")}</p>
          <h1>{t("home.title")}</h1>
          <p className={styles.lede}>{t("home.description")}</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={local(locale, "/consultation")}>
              {t("cta.consultation")}
            </Link>
            <Link className={styles.secondary} href={local(locale, "/free-assessment")}>
              {t("cta.assessment")}
            </Link>
          </div>
        </div>
        <aside className={styles.learningMap} aria-label={t("home.mapLabel")}>
          <p className={styles.mapLabel}>{t("home.mapLabel")}</p>
          <div className={styles.mapPath} />
          <span className={styles.mapNode}>01</span>
          <span className={styles.mapNode}>02</span>
          <span className={styles.mapNode}>03</span>
          <p className={styles.mapText}>{t("home.mapOne")}</p>
          <p className={styles.mapText}>{t("home.mapTwo")}</p>
          <p className={styles.mapText}>{t("home.mapThree")}</p>
          <p className={styles.mapNote}>{t("home.mapNote")}</p>
        </aside>
      </section>
      <section className={styles.section}>
        <h2>{t("home.whatTitle")}</h2>
        <p className={styles.sectionIntro}>{t("home.whatDescription")}</p>
        <div className={styles.cards}>
          {["math", "code", "heritage"].map((key) => (
            <article className={styles.card} key={key}>
              <h3>{t(`home.cards.${key}.title`)}</h3>
              <p>{t(`home.cards.${key}.body`)}</p>
            </article>
          ))}
        </div>
        <Testimonial
          value={{
            quote: t("testimonial.quote"),
            attribution: t("testimonial.attribution"),
            relationshipVerified: true,
            parentalConsent: true,
            studentIdentifiable: false,
          }}
        />
      </section>
    </MarketingChrome>
  );
}

export function StandardPage({ locale, slug }: { locale: Locale; slug: MarketingSlug }) {
  const t = useTranslations("marketing");
  const key = pageKey[slug];
  const faq = slug === "faq";
  if (isSubjectCurriculumSlug(slug)) {
    return (
      <MarketingChrome locale={locale} fullBleed={slug === "mathematics"}>
        <SubjectCurriculumPage slug={slug} />
      </MarketingChrome>
    );
  }
  return (
    <MarketingChrome locale={locale}>
      <section className={styles.pageHero}>
        <p className={styles.eyebrow}>{t(`pages.${key}.eyebrow`)}</p>
        <h1 className={styles.pageHeading}>{t(`pages.${key}.title`)}</h1>
        <p className={styles.lede}>{t(`pages.${key}.description`)}</p>
      </section>
      <section className={styles.pageBody}>
        <div>
          {faq ? <FaqContent /> : <p className={styles.copy}>{t(`pages.${key}.body`)}</p>}
          {isFormPage(slug) && (
            <div className={styles.formShell}>
              <LeadForm kind={formKind(slug)} />
            </div>
          )}
        </div>
        <aside className={styles.aside}>
          <strong>{t("aside.title")}</strong>
          <p>{t("aside.body")}</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={local(locale, "/consultation")}>
              {t("cta.consultation")}
            </Link>
          </div>
        </aside>
      </section>
    </MarketingChrome>
  );
}

function FaqContent() {
  const t = useTranslations("marketing.faq");
  return (
    <div className={styles.faqList}>
      {["one", "two", "three", "four"].map((key) => (
        <details key={key}>
          <summary>{t(`${key}.question`)}</summary>
          <p>{t(`${key}.answer`)}</p>
        </details>
      ))}
    </div>
  );
}
