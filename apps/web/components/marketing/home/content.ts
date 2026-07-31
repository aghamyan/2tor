import type { Locale } from "@app/i18n/config";

/** Builds a locale-prefixed internal href, matching the marketing shell's routing convention. */
export function localHref(locale: Locale, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}

export interface Cta {
  label: string;
  href: string;
}

export const HOW_IT_WORKS_STEP_KEYS = ["one", "two", "three", "four"] as const;
export type HowItWorksStepKey = (typeof HOW_IT_WORKS_STEP_KEYS)[number];

export const SUBJECT_KEYS = ["mathematics", "programming", "heritage"] as const;
export type SubjectKey = (typeof SUBJECT_KEYS)[number];

/** Public marketing paths each subject links to — already allowlisted in `apps/web/proxy.ts`. */
export const SUBJECT_HREFS: Record<SubjectKey, string> = {
  mathematics: "/mathematics",
  programming: "/programming",
  heritage: "/armenian-language-heritage",
};

export const WHY_US_POINT_KEYS = ["structure", "visibility", "accountability", "safety"] as const;
export type WhyUsPointKey = (typeof WHY_US_POINT_KEYS)[number];

export const PROJECT_KEYS = ["budget", "heritage"] as const;
export type ProjectKey = (typeof PROJECT_KEYS)[number];

export const FOR_PARENTS_POINT_KEYS = [
  "schedule",
  "feedback",
  "milestones",
  "progressTrend",
] as const;
export type ForParentsPointKey = (typeof FOR_PARENTS_POINT_KEYS)[number];

export const TRUST_BAR_ITEM_KEYS = [
  "verified",
  "parentsSee",
  "noPrivateMessaging",
  "feedback",
] as const;
export type TrustBarItemKey = (typeof TRUST_BAR_ITEM_KEYS)[number];

export const TESTIMONIAL_KEYS = ["one", "two"] as const;
export type TestimonialKey = (typeof TESTIMONIAL_KEYS)[number];

/**
 * Structural gate for a homepage testimonial. `relationshipVerified`/`parentalConsent` must be
 * the literal `true` and `studentIdentifiable` the literal `false` — passing anything else is a
 * type error, not just a runtime check. Real testimonials require written parental consent and
 * must never be fabricated; see the placeholder content and disclosure copy in `testimonials.tsx`.
 */
export interface SafeHomeTestimonial {
  quote: string;
  attribution: string;
  relationshipVerified: true;
  parentalConsent: true;
  studentIdentifiable: false;
  childName?: never;
  childPhotoUrl?: never;
}

/**
 * Runtime twin of `SafeHomeTestimonial`'s compile-time gate. `SafeHomeTestimonial` already makes
 * an unverified/unconsented/identifying testimonial impossible to author without a type error;
 * this defensive check exists for the same reason `apps/web/components/marketing/testimonial.tsx`
 * keeps one too — data can still reach this boundary from outside the type system later.
 */
export function isPublishableTestimonial(testimonial: {
  relationshipVerified: boolean;
  parentalConsent: boolean;
  studentIdentifiable: boolean;
}): boolean {
  return (
    testimonial.relationshipVerified === true &&
    testimonial.parentalConsent === true &&
    testimonial.studentIdentifiable === false
  );
}
