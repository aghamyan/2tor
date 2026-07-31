"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { ConsentOverviewItem } from "../../app/(app)/consent/queries";
import styles from "./consent.module.css";

export function ConsentOverview({ items }: { items: ConsentOverviewItem[] }) {
  const t = useTranslations("consent.overview");

  return (
    <div className={styles.shell}>
      <div className={styles.backRow}>
        <Link className={styles.secondaryLink} href="/families">
          {t("backToFamilies")}
        </Link>
      </div>
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.lede}>{t("intro")}</p>
      </header>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>{t("emptyTitle")}</h2>
          <p className={styles.emptyText}>{t("emptyText")}</p>
          <Link className={styles.primaryLink} href="/families/new">
            {t("addStudent")}
          </Link>
        </div>
      ) : (
        <ul className={styles.studentList}>
          {items.map((item) => {
            const actionable = item.status !== "active";
            return (
              <li key={item.id}>
                <Link className={styles.studentCard} href={`/consent/${item.id}`}>
                  <span>
                    <span className={styles.studentName}>{item.preferredName}</span>
                    <span className={styles.quiet}>@{item.username}</span>
                  </span>
                  <span
                    className={`${styles.status} ${
                      actionable ? styles.statusPending : styles.statusActive
                    }`}
                  >
                    {actionable ? t("statusActionNeeded") : t("statusActive")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
