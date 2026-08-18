"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { ClassListRecord } from "../../app/(app)/scheduling/queries";
import { LessonCard } from "./lesson-card";
import styles from "./scheduling.module.css";

type LearningRole = "student" | "parent" | "tutor";

function sectionedLessons(lessons: ClassListRecord[]) {
  const now = new Date();
  const byRecency = (a: ClassListRecord, b: ClassListRecord) =>
    b.scheduledStartAt.getTime() - a.scheduledStartAt.getTime();
  return {
    upcoming: lessons
      .filter((lesson) => lesson.status === "scheduled" && lesson.scheduledStartAt >= now)
      .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime()),
    completed: lessons.filter((lesson) => lesson.status === "completed").sort(byRecency),
    missed: lessons
      .filter((lesson) => lesson.status === "no_show_student" || lesson.status === "no_show_tutor")
      .sort(byRecency),
    canceled: lessons.filter((lesson) => lesson.status === "canceled").sort(byRecency),
    rescheduled: lessons.filter((lesson) => lesson.status === "rescheduled").sort(byRecency),
  };
}

function ClassSection({
  title,
  lessons,
  viewerRole,
}: {
  title: string;
  lessons: ClassListRecord[];
  viewerRole: LearningRole;
}) {
  if (lessons.length === 0) return null;

  return (
    <section className={styles.classSection} aria-labelledby={`classes-${title}`}>
      <div className={styles.sectionHeading}>
        <h2 id={`classes-${title}`}>{title}</h2>
        <span>{lessons.length}</span>
      </div>
      <ul className={styles.list}>
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} viewerRole={viewerRole} />
        ))}
      </ul>
    </section>
  );
}

export function ScheduleOverview({
  lessons,
  viewerRole,
}: {
  lessons: ClassListRecord[];
  viewerRole: LearningRole;
}) {
  const t = useTranslations("scheduling.overview");
  const grouped = sectionedLessons(lessons);

  return (
    <div className={`${styles.shell} ${styles.classesShell}`}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.title}>{t("classesTitle")}</h1>
          <p className={styles.lede}>{t(`roleIntro.${viewerRole}`)}</p>
        </div>
        {viewerRole === "tutor" ? (
          <Link className={styles.primaryLink} href="/scheduling/new">
            {t("scheduleLesson")}
          </Link>
        ) : null}
      </header>

      {Object.values(grouped).every((section) => section.length === 0) ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <div className={styles.classSections}>
          <ClassSection title={t("upcoming")} lessons={grouped.upcoming} viewerRole={viewerRole} />
          <ClassSection title={t("completed")} lessons={grouped.completed} viewerRole={viewerRole} />
          <ClassSection title={t("missed")} lessons={grouped.missed} viewerRole={viewerRole} />
          <ClassSection title={t("canceled")} lessons={grouped.canceled} viewerRole={viewerRole} />
          <ClassSection
            title={t("rescheduled")}
            lessons={grouped.rescheduled}
            viewerRole={viewerRole}
          />
        </div>
      )}
    </div>
  );
}
