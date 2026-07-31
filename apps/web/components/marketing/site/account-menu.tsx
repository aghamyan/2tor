"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@app/ui";
import type { Locale } from "@app/i18n/config";

import { ChevronDownIcon, UserIcon } from "./icons";
import { navDropdownItemClassName, NavDropdown } from "./nav-dropdown";
import { localizedHref } from "./nav-items";
import styles from "./site.module.css";

/**
 * `Settings` has no page yet and there is no `/api/auth/logout` route yet (only
 * `/api/auth/login` exists) — both are noted in this task's output notes as follow-up work,
 * out of this task's file scope (`apps/web/app/api/**`, `(app)/*`).
 */
export function AccountMenu({ locale, roleLabelKey }: { locale: Locale; roleLabelKey: string }) {
  const t = useTranslations("marketing");

  return (
    <NavDropdown
      align="end"
      triggerClassName={`${styles.accountTrigger} inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-2`}
      triggerLabel={
        <>
          <Avatar className="size-8">
            <AvatarFallback className={styles.avatarFallback}>
              <UserIcon className="size-4" />
            </AvatarFallback>
          </Avatar>
          <span className="sr-only">{t("site.account.menuLabel")}</span>
          <ChevronDownIcon className="size-4" />
        </>
      }
    >
      <p
        role="presentation"
        className={`${styles.dropdownMeta} px-3 py-1.5 text-xs font-semibold uppercase tracking-wide`}
      >
        {t(roleLabelKey)}
      </p>
      <div role="separator" className={`${styles.dropdownSeparator} my-1 h-px`} />
      <Link
        href={localizedHref(locale, "/settings")}
        role="menuitem"
        tabIndex={-1}
        className={navDropdownItemClassName()}
      >
        {t("site.account.settings")}
      </Link>
      {/*
       * `role="presentation"` on the form: a bare `<form>` is not a valid direct child of
       * `role="menu"` (axe's `aria-required-children`, WCAG 1.3.1) — marking it presentational
       * makes the ARIA tree treat its `menuitem` button as if it were a direct child of the menu,
       * per the WAI-ARIA "presentational children" flattening rule, without changing behavior.
       */}
      <form role="presentation" action="/api/auth/logout" method="post">
        <button type="submit" role="menuitem" tabIndex={-1} className={navDropdownItemClassName()}>
          {t("site.account.logOut")}
        </button>
      </form>
    </NavDropdown>
  );
}
