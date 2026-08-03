"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { ClassListRecord } from "../../app/(app)/scheduling/queries";
import styles from "./scheduling.module.css";

function badgeClass(status: ClassListRecord["status"]): string {
  if (status === "scheduled") return styles.badgeScheduled ?? "";
  if (status === "no_show_student" || status === "no_show_tutor")
    return styles.badgeAttention ?? "";
  return styles.badgeClosed ?? "";
}

export function LessonCard({
  lesson,
  viewerRole,
}: {
  lesson: ClassListRecord;
  viewerRole: "student" | "parent" | "tutor";
}) {
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
      <div className={styles.classDate} aria-hidden="true">
        <span>{new Intl.DateTimeFormat(undefined, { month: "short" }).format(lesson.scheduledStartAt)}</span>
        <strong>{new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(lesson.scheduledStartAt)}</strong>
      </div>
      <div className={styles.classContent}>
        <div className={styles.cardTop}>
          <div>
            <p className={styles.cardSubject}>{t("overview.subject", { subject: lesson.subjectId })}</p>
            <p className={styles.cardWhen}>{when}</p>
          </div>
          <span className={`${styles.badge} ${badgeClass(lesson.status)}`}>
            {t(`status.${lesson.status}`)}
          </span>
        </div>
        <p className={styles.cardMeta}>
          {t("overview.duration", { minutes })} · {t(`overview.cardAudience.${viewerRole}`)}
        </p>
      </div>
      {lesson.status === "scheduled" && lesson.joinUrl ? (
        <a className={styles.classAction} href={lesson.joinUrl} target="_blank" rel="noreferrer">
          {t("overview.joinClass")}
        </a>
      ) : (
        <Link className={styles.classAction} href={`/scheduling/${lesson.id}`}>
          {lesson.status === "scheduled" ? t("overview.openClass") : t("overview.viewDetails")}
        </Link>
      )}
    </li>
  );
}
