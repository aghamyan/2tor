"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Locale } from "@app/i18n/config";

import { ArrowUpRightIcon, ChevronDownIcon } from "./icons";
import { navDropdownItemClassName, NavDropdown } from "./nav-dropdown";
import { localizedHref, type NavDropdownEntry } from "./nav-items";
import styles from "./site.module.css";

export function SubjectsDropdown({ locale, entry }: { locale: Locale; entry: NavDropdownEntry }) {
  const t = useTranslations("marketing");

  return (
    <NavDropdown
      triggerClassName={`${styles.dropdownTrigger} inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium`}
      panelClassName={styles.subjectsPanel}
      triggerLabel={
        <>
          {t(entry.labelKey)}
          <ChevronDownIcon className="size-4" />
        </>
      }
    >
      {entry.items.map((item, index) => (
        <Link
          key={item.id}
          href={localizedHref(locale, item.href)}
          role="menuitem"
          tabIndex={-1}
          className={navDropdownItemClassName(styles.subjectMenuItem)}
        >
          <span
            className={`${styles.subjectMenuIcon} ${index === 1 ? styles.subjectMenuIconHeritage : ""}`}
            aria-hidden="true"
          >
            {index === 0 ? "π" : "Ա"}
          </span>
          <span>{t(item.labelKey)}</span>
          <ArrowUpRightIcon className={styles.subjectMenuArrow} />
        </Link>
      ))}
    </NavDropdown>
  );
}
