import { Noto_Sans_Armenian, Noto_Serif_Armenian } from "next/font/google";
import { useTranslations } from "next-intl";
import type { Locale } from "@app/i18n/config";
import {
  FOR_PARENTS_POINT_KEYS,
  HOW_IT_WORKS_STEP_KEYS,
  PROJECT_KEYS,
  SUBJECT_HREFS,
  SUBJECT_KEYS,
  TESTIMONIAL_KEYS,
  WHY_US_POINT_KEYS,
  localHref,
  type SafeHomeTestimonial,
} from "./content";
import { Hero } from "./hero";
import { TrustBar } from "./trust-bar";
import { HowItWorks } from "./how-it-works";
import { Subjects, type SubjectCard } from "./subjects";
import { WhyChooseUs } from "./why-choose-us";
import { ProjectBasedLearning } from "./project-based-learning";
import { ForParents, type ForParentsPoint } from "./for-parents";
import { Tutors } from "./tutors";
import { Testimonials } from "./testimonials";
import { SafetyStrip } from "./safety-strip";
import { FinalCta } from "./final-cta";
import { ScrollReveal, ScrollRevealNoScriptFallback } from "./scroll-reveal";
import styles from "./home.module.css";

const displayFont = Noto_Serif_Armenian({
  subsets: ["armenian", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--home-font-display",
});

const bodyFont = Noto_Sans_Armenian({
  subsets: ["armenian", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--home-font-body",
});

export function HomePageContent({ locale }: { locale: Locale }) {
  const t = useTranslations("marketing");
  const href = (path: string) => localHref(locale, path);
  const primaryCta = { label: t("cta.consultation"), href: href("/consultation") };
  const secondaryCta = { label: t("cta.assessment"), href: href("/free-assessment") };

  const steps = HOW_IT_WORKS_STEP_KEYS.map((key) => ({
    title: t(`home.howItWorks.steps.${key}.title`),
    body: t(`home.howItWorks.steps.${key}.body`),
  }));

  const subjects: SubjectCard[] = SUBJECT_KEYS.map((key) => ({
    key,
    title: t(`home.subjects.items.${key}.title`),
    body: t(`home.subjects.items.${key}.body`),
    cta: { label: t(`home.subjects.items.${key}.cta`), href: href(SUBJECT_HREFS[key]) },
  }));

  const whyUsPoints = WHY_US_POINT_KEYS.map((key) => ({
    title: t(`home.whyUs.points.${key}.title`),
    body: t(`home.whyUs.points.${key}.body`),
  }));

  const projects = PROJECT_KEYS.map((key) => ({
    label: t(`home.projects.items.${key}.label`),
    title: t(`home.projects.items.${key}.title`),
    body: t(`home.projects.items.${key}.body`),
    deliverables: t.raw(`home.projects.items.${key}.deliverables`) as string[],
  }));

  const forParentsPoints: ForParentsPoint[] = FOR_PARENTS_POINT_KEYS.map((key) => ({
    key,
    title: t(`home.forParents.points.${key}.title`),
    body: t(`home.forParents.points.${key}.body`),
  }));

  const testimonials: SafeHomeTestimonial[] = TESTIMONIAL_KEYS.map((key) => ({
    quote: t(`home.testimonials.items.${key}.quote`),
    attribution: t(`home.testimonials.items.${key}.attribution`),
    relationshipVerified: true,
    parentalConsent: true,
    studentIdentifiable: false,
  }));

  return (
    <div className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
      <ScrollRevealNoScriptFallback />
      <Hero
        eyebrow={t("home.hero.eyebrow")}
        title={t("home.hero.title")}
        description={t("home.hero.description")}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        trustLabel={t("home.hero.trust.label")}
        trustVerified={t("home.hero.trust.verified")}
        trustVisible={t("home.hero.trust.visible")}
        trustSafe={t("home.hero.trust.safe")}
        visualLabel={t("home.hero.visual.label")}
        visualHeadline={t("home.hero.visual.headline")}
        visualNote={t("home.hero.visual.note")}
      />
      <TrustBar
        label={t("home.trustBar.label")}
        verified={t("home.trustBar.items.verified")}
        parentsSee={t("home.trustBar.items.parentsSee")}
        noPrivateMessaging={t("home.trustBar.items.noPrivateMessaging")}
        feedback={t("home.trustBar.items.feedback")}
      />
      <ScrollReveal>
        <HowItWorks
          eyebrow={t("home.howItWorks.eyebrow")}
          title={t("home.howItWorks.title")}
          description={t("home.howItWorks.description")}
          steps={steps}
        />
      </ScrollReveal>
      <ScrollReveal>
        <Subjects
          eyebrow={t("home.subjects.eyebrow")}
          title={t("home.subjects.title")}
          description={t("home.subjects.description")}
          subjects={subjects}
        />
      </ScrollReveal>
      <ScrollReveal>
        <WhyChooseUs
          eyebrow={t("home.whyUs.eyebrow")}
          title={t("home.whyUs.title")}
          description={t("home.whyUs.description")}
          points={whyUsPoints}
        />
      </ScrollReveal>
      <ScrollReveal>
        <ProjectBasedLearning
          eyebrow={t("home.projects.eyebrow")}
          title={t("home.projects.title")}
          description={t("home.projects.description")}
          projects={projects}
        />
      </ScrollReveal>
      <ScrollReveal>
        <ForParents
          eyebrow={t("home.forParents.eyebrow")}
          title={t("home.forParents.title")}
          description={t("home.forParents.description")}
          points={forParentsPoints}
          cta={primaryCta}
          previewLabel={t("home.forParents.preview.label")}
          previewHeadline={t("home.forParents.preview.headline")}
          previewCaption={t("home.forParents.preview.caption")}
        />
      </ScrollReveal>
      <ScrollReveal>
        <Tutors
          eyebrow={t("home.tutors.eyebrow")}
          title={t("home.tutors.title")}
          description={t("home.tutors.description")}
          cta={{ label: t("home.tutors.cta"), href: href("/tutor-application") }}
        />
      </ScrollReveal>
      <ScrollReveal>
        <Testimonials
          eyebrow={t("home.testimonials.eyebrow")}
          title={t("home.testimonials.title")}
          disclosure={t("home.testimonials.disclosure")}
          testimonials={testimonials}
        />
      </ScrollReveal>
      <SafetyStrip
        statement={t("home.safety.statement")}
        safetyLink={{ label: t("pages.safety.title"), href: href("/safety") }}
        privacyLink={{ label: t("footer.privacy"), href: href("/privacy") }}
      />
      <ScrollReveal>
        <FinalCta
          title={t("home.finalCta.title")}
          description={t("home.finalCta.description")}
          primaryCta={primaryCta}
          secondaryCta={secondaryCta}
        />
      </ScrollReveal>
    </div>
  );
}
