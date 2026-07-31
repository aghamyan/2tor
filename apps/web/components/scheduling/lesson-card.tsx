"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { LessonRecord } from "../../../../packages/domain/scheduling/models";
import styles from "./scheduling.module.css";

function badgeClass(status: LessonRecord["status"]): string {
  if (status === "scheduled") return styles.badgeScheduled ?? "";
  if (status === "no_show_student" || status === "no_show_tutor")
    return styles.badgeAttention ?? "";
  return styles.badgeClosed ?? "";
}

export function LessonCard({ lesson }: { lesson: LessonRecord }) {
  const t = useTranslations("scheduling");
  const when = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(lesson.scheduledStartAt);
  const minutes = Math.round(
    (lesson.scheduledEndAt.getTime() - lesson.scheduledStartAt.getTime()) / 60_000,
  );

  return (
    <li className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.cardWhen}>{when}</span>
        <span className={`${styles.badge} ${badgeClass(lesson.status)}`}>
          {t(`status.${lesson.status}`)}
        </span>
      </div>
      <p className={styles.cardMeta}>{t("overview.duration", { minutes })}</p>
      <Link className={styles.backLink} href={`/scheduling/${lesson.id}`}>
        {t("overview.viewDetails")}
      </Link>
    </li>
  );
}
