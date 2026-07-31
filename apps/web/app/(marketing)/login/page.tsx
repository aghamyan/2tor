import { resolveLocale } from "@app/i18n/config";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "../../../components/auth/login-form";
import { MarketingChrome } from "../../../components/marketing/marketing-site";
import styles from "../../../components/marketing/marketing.module.css";

export const metadata: Metadata = {
  title: "Sign in | Loom կրթություն",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const locale = resolveLocale((await headers()).get("x-locale"));
  const t = await getTranslations("auth.login");
  const requestedNext = (await searchParams).next;
  const nextPath = typeof requestedNext === "string" ? requestedNext : "/dashboard";

  return (
    <MarketingChrome locale={locale}>
      <section className={styles.pageHero}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1 className={styles.pageHeading}>{t("title")}</h1>
        <p className={styles.lede}>{t("intro")}</p>
      </section>
      <section className={styles.pageBody}>
        <LoginForm nextPath={nextPath} />
      </section>
    </MarketingChrome>
  );
}
