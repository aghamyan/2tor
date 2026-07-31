/** Public navigation belongs to the marketing shell, never the authenticated app registry. */
export const marketingNav = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/mathematics", label: "Subjects" },
  { href: "/parents", label: "For parents" },
  { href: "/pricing", label: "Pricing" },
] as const;

export type MarketingNavItem = (typeof marketingNav)[number];
