import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@app/i18n/config";

import { LanguageSwitcher } from "./language-switcher";
import { footerGroups, localizedHref } from "./nav-items";
import styles from "./site.module.css";

/**
 * Server-rendered, like `SiteHeader` — the only client island underneath is `LanguageSwitcher`
 * itself. Group headings are `<p>`, not `<h2>`, matching `MobileNav`'s "Subjects" group label:
 * this repo's established pattern for a visually-heading-styled label that isn't meant to add to
 * the page's heading outline (the footer element's implicit `contentinfo` role is landmark
 * enough on its own; a per-group heading isn't needed).
 */
export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketing" });
  const year = new Date().getFullYear();

  return (
    <footer className={`${styles.scope} ${styles.footer}`}>
      <div className="mx-auto max-w-[100rem] px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {footerGroups.map((group) => (
            <div key={group.id}>
              <p
                className={`${styles.footerHeading} text-xs font-semibold uppercase tracking-wide`}
              >
                {t(group.headingKey)}
              </p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={localizedHref(locale, link.href)}
                      className={`${styles.footerLink} text-sm`}
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className={`${styles.footerBottom} mt-10 flex flex-col items-center justify-between gap-4 pt-6 text-sm sm:flex-row`}
        >
          <p>{t("site.footer.copyright", { year })}</p>
          <LanguageSwitcher locale={locale} />
        </div>
      </div>
    </footer>
  );
}
