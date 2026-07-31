"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { LessonRecord } from "../../../../packages/domain/scheduling/models";
import { LessonCard } from "./lesson-card";
import styles from "./scheduling.module.css";

export function ScheduleOverview({ lessons }: { lessons: LessonRecord[] }) {
  const t = useTranslations("scheduling.overview");

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.lede}>{t("intro")}</p>
        </div>
        <Link className={styles.primaryLink} href="/scheduling/new">
          {t("scheduleLesson")}
        </Link>
      </header>

      {lessons.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ul className={styles.list}>
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </ul>
      )}
    </div>
  );
}
