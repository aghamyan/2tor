/**
 * Single source of truth for the community-facing product name. Used for sidebar navigation, page
 * titles, metadata, breadcrumbs, empty states, notifications, email templates, mobile navigation,
 * and admin settings — never hardcoded at those call sites. Change this one value (and, if the
 * routed URL should follow suit, add a redirect next to `nav.ts`) to rename the feature everywhere.
 *
 * The module's internal name (routes, tables, i18n namespace, folders) stays "discussions" — see
 * `README.md` — precisely so a rename here never requires touching those.
 */
export const communityName = "MathOverflow";

export const communityEyebrow = "COMMUNITY · MATHEMATICS";
