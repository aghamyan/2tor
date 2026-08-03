import type { Locale } from "@app/i18n/config";

/**
 * Hrefs here are the repo's established public-page slugs (see `proxy.ts`'s `PUBLIC_PATHS` and
 * `../seo.ts`'s `pageSlugs`), not the shorter slugs a design brief might suggest (e.g.
 * `/mathematics`, not `/math`) — an unlisted path falls outside `PUBLIC_PATHS` and would redirect
 * an anonymous visitor straight to `/login`.
 */
export interface FooterLinkItem {
  id: string;
  labelKey: string;
  href: string;
}

export interface NavLinkEntry {
  type: "link";
  id: string;
  labelKey: string;
  href: string;
}

export interface NavDropdownEntry {
  type: "dropdown";
  id: string;
  labelKey: string;
  items: FooterLinkItem[];
}

export type PrimaryNavEntry = NavLinkEntry | NavDropdownEntry;

export const primaryNav: PrimaryNavEntry[] = [
  { type: "link", id: "how-it-works", labelKey: "site.nav.howItWorks", href: "/how-it-works" },
  {
    type: "dropdown",
    id: "subjects",
    labelKey: "site.nav.subjects.label",
    items: [
      { id: "mathematics", labelKey: "site.nav.subjects.mathematics", href: "/mathematics" },
      {
        id: "heritage",
        labelKey: "site.nav.subjects.heritage",
        href: "/armenian-language-heritage",
      },
    ],
  },
  { type: "link", id: "group-lessons", labelKey: "site.nav.groupLessons", href: "/group-lessons" },
  { type: "link", id: "for-parents", labelKey: "site.nav.forParents", href: "/parents" },
  { type: "link", id: "tutors", labelKey: "site.nav.tutors", href: "/tutors" },
];

export interface FooterGroup {
  id: string;
  headingKey: string;
  links: FooterLinkItem[];
}

export const footerGroups: FooterGroup[] = [
  {
    id: "subjects",
    headingKey: "site.footer.subjectsHeading",
    links: [
      { id: "mathematics", labelKey: "site.footer.mathematics", href: "/mathematics" },
      {
        id: "heritage",
        labelKey: "site.footer.heritage",
        href: "/armenian-language-heritage",
      },
    ],
  },
  {
    id: "company",
    headingKey: "site.footer.companyHeading",
    links: [
      { id: "how-it-works", labelKey: "site.footer.howItWorks", href: "/how-it-works" },
      { id: "group-lessons", labelKey: "site.footer.groupLessons", href: "/group-lessons" },
      { id: "pricing", labelKey: "site.footer.pricing", href: "/pricing" },
      { id: "safety", labelKey: "site.footer.safety", href: "/safety" },
    ],
  },
  {
    id: "families",
    headingKey: "site.footer.familiesHeading",
    links: [
      { id: "for-parents", labelKey: "site.footer.forParents", href: "/parents" },
      { id: "tutors", labelKey: "site.footer.tutors", href: "/tutors" },
      {
        id: "tutor-application",
        labelKey: "site.footer.tutorApplication",
        href: "/tutor-application",
      },
    ],
  },
  {
    id: "legal",
    headingKey: "site.footer.legalHeading",
    links: [
      { id: "privacy", labelKey: "site.footer.privacy", href: "/privacy" },
      { id: "terms", labelKey: "site.footer.terms", href: "/terms" },
      { id: "contact", labelKey: "site.footer.contact", href: "/contact" },
    ],
  },
];

/** Every marketing route is served under a locale prefix (`proxy.ts` redirects bare paths). */
export function localizedHref(locale: Locale, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}
