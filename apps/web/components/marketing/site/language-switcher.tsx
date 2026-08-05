"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { locales, type Locale } from "@app/i18n/config";

import { buildLocaleSwitchHref } from "./locale-switch";
import styles from "./site.module.css";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Renders as real `<Link>`s (works with JS disabled) to the same page under the other locale.
 * The cookie write on click is a progressive-enhancement extra: it keeps a later visit to a
 * bare, non-locale-prefixed URL landing on the just-chosen locale (`proxy.ts` reads
 * `NEXT_LOCALE` for that redirect) rather than re-detecting from `accept-language`.
 *
 * `variant="compact"` shows the raw locale code ("EN"/"HY") instead of the full translated name.
 * It exists only so the always-visible desktop header row (nav + dropdown + two CTAs + this) has
 * a chance of fitting without wrapping — full names ("English"/"Armenian" or their hy equivalents)
 * cost roughly 60px more per link than a two-letter code. Deliberately does NOT set an `aria-label`
 * override to compensate for the shorter visible text: an override whose text doesn't contain the
 * visible label (e.g. aria-label="Armenian" over visible "HY") fails WCAG 2.5.3 Label in Name,
 * which the repo's automated axe sweep (`tests/a11y/wcag-22-aa.a11y.ts`) checks on every public
 * page this switcher now renders on. Letting the accessible name equal the visible text avoids the
 * mismatch entirely; the enclosing `role="group"` label below still gives screen reader users
 * context ("Switch language" / "Փոխել լեզուն").
 */
export function LanguageSwitcher({
  locale,
  className,
  variant = "full",
}: {
  locale: Locale;
  className?: string;
  variant?: "full" | "compact";
}) {
  const t = useTranslations("marketing");
  const pathname = usePathname() ?? "/";

  return (
    /*
     * A segmented control rather than two loose text links: one recessed track holding two
     * segments, with the active one raised onto a surface. That shape says "this is a choice
     * between two states" at a glance, which two adjacent words do not.
     */
    <div
      role="group"
      aria-label={t("site.languageSwitcher.label")}
      className={`${styles.localeSwitch} ${className ?? ""}`}
    >
      {locales.map((candidate) => {
        const active = candidate === locale;
        return (
          <Link
            key={candidate}
            href={buildLocaleSwitchHref(pathname, candidate)}
            aria-current={active ? "true" : undefined}
            data-active={active ? "true" : "false"}
            onClick={() => {
              document.cookie = `${LOCALE_COOKIE_NAME}=${candidate}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
            }}
            className={styles.localeSwitchOption}
          >
            {variant === "compact"
              ? candidate.toUpperCase()
              : t(`site.languageSwitcher.${candidate}`)}
          </Link>
        );
      })}
    </div>
  );
}
