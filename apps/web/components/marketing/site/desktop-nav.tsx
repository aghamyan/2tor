import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@app/i18n/config";

import { localizedHref, primaryNav } from "./nav-items";
import { SubjectsDropdown } from "./subjects-dropdown";
import styles from "./site.module.css";

/**
 * Server-rendered so the nav's plain links exist in the initial HTML with no client JS required;
 * `SubjectsDropdown` is the one interactive island (it needs open/close state and keyboard
 * handling), embedded directly rather than making the whole nav a client component.
 */
export async function DesktopNav({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketing" });

  return (
    <nav
      aria-label={t("site.nav.ariaLabel")}
      className={`${styles.navRail} hidden shrink-0 items-center gap-0.5 xl:flex`}
    >
      {primaryNav.map((entry) =>
        entry.type === "link" ? (
          <Link
            key={entry.id}
            href={localizedHref(locale, entry.href)}
            className={`${styles.navLink} shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium`}
          >
            {t(entry.labelKey)}
          </Link>
        ) : (
          <SubjectsDropdown key={entry.id} locale={locale} entry={entry} />
        ),
      )}
    </nav>
  );
}
