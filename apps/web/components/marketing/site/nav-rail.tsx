"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Locale } from "@app/i18n/config";

import { localizedHref, type PrimaryNavEntry } from "./nav-items";
import { SubjectsDropdown } from "./subjects-dropdown";
import styles from "./site.module.css";

/**
 * Strips the locale prefix so `/en/parents` and `/hy/parents` both compare as `/parents`.
 * `buildLocaleSwitchHref` does the writing half of this; this is the read-only half.
 */
function stripLocale(pathname: string, locale: Locale) {
  const prefix = `/${locale}`;
  if (pathname === prefix) return "/";
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

/** A dropdown counts as active when any page beneath it is the current one. */
export function isEntryActive(pathname: string, locale: Locale, entry: PrimaryNavEntry) {
  const current = stripLocale(pathname, locale);
  const targets = entry.type === "link" ? [entry.href] : entry.items.map((item) => item.href);
  return targets.some((t) => t !== "/" && (current === t || current.startsWith(`${t}/`)));
}

/**
 * The primary nav, with a pill marking the page you are on.
 *
 * The pill is ONE shared element carried between items by `layoutId`, not a background applied to
 * each link. That is what makes it glide from "How it works" to "For parents" instead of blinking
 * out and in, and it is why the header reads as a single control rather than five buttons.
 *
 * This is route-based, deliberately not a scroll-spy: these links go to separate pages, not to
 * sections of the home page, so "where am I" is a question about the route. On `/home` nothing is
 * marked, because home is not one of these items.
 *
 * A client component so it can read `usePathname()`. The links still render in the server HTML and
 * work with JS disabled — only the pill needs the client.
 */
export function NavRail({
  locale,
  entries,
  ariaLabel,
}: {
  locale: Locale;
  entries: PrimaryNavEntry[];
  ariaLabel: string;
}) {
  const pathname = usePathname() ?? "/";
  const reduceMotion = useReducedMotion();
  const t = useTranslations("marketing");

  return (
    <nav
      aria-label={ariaLabel}
      className={`${styles.navRail} hidden shrink-0 items-center gap-0.5 xl:flex`}
    >
      {entries.map((entry) => {
        const active = isEntryActive(pathname, locale, entry);
        if (entry.type === "dropdown") {
          return <SubjectsDropdown key={entry.id} locale={locale} entry={entry} active={active} />;
        }
        return (
          <Link
            key={entry.id}
            href={localizedHref(locale, entry.href)}
            aria-current={active ? "page" : undefined}
            data-active={active ? "true" : "false"}
            className={`${styles.navLink} relative shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium`}
          >
            {active ? (
              <motion.span
                layoutId="nav-active-pill"
                className={styles.navPill}
                aria-hidden="true"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
                }
              />
            ) : null}
            <span className={styles.navLabel}>{t(entry.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
