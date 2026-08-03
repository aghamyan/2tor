import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@app/i18n/config";

import { AccountMenu } from "./account-menu";
import { ArrowUpRightIcon } from "./icons";
import type { HeaderAuthState } from "./header-actions";
import { localizedHref } from "./nav-items";
import styles from "./site.module.css";

const buttonClass =
  "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold";

/**
 * Server-rendered from an already-resolved `authState` — no client-side auth check, no flicker.
 * Hidden below `xl`: at that width `MobileNav`'s drawer carries the same actions instead, so the
 * two controls never compete for the same narrow header row.
 */
export async function HeaderActionsPanel({
  locale,
  authState,
}: {
  locale: Locale;
  authState: HeaderAuthState;
}) {
  const t = await getTranslations({ locale, namespace: "marketing" });

  if (authState.kind === "logged-out") {
    return (
      <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
        <Link
          href={localizedHref(locale, "/login")}
          className={`${styles.buttonSecondary} ${buttonClass}`}
        >
          {t("site.actions.login")}
        </Link>
        <Link
          href={localizedHref(locale, "/consultation")}
          className={`${styles.buttonPrimary} ${buttonClass}`}
        >
          {t("site.actions.consultation")}
          <ArrowUpRightIcon className={styles.buttonIcon} />
        </Link>
      </div>
    );
  }

  return (
    <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
      <Link
        href={localizedHref(locale, authState.dashboardHref)}
        className={`${styles.buttonPrimary} ${buttonClass}`}
      >
        {t("site.actions.dashboard")}
        <ArrowUpRightIcon className={styles.buttonIcon} />
      </Link>
      <AccountMenu locale={locale} roleLabelKey={authState.roleLabelKey} />
    </div>
  );
}
