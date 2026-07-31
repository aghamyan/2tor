"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import type {
  ParentProfileRecord,
  StudentFamilySummary,
} from "../../../../packages/domain/families/models";
import { ParentProfileForm } from "./parent-profile-form";
import { StudentCard } from "./student-card";
import styles from "./families.module.css";

export function FamilyOverview({
  parent,
  students,
}: {
  parent: ParentProfileRecord | null;
  students: StudentFamilySummary[];
}) {
  const t = useTranslations("families.overview");

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.lede}>{t("intro")}</p>
        </div>
        {parent ? (
          <Link className={styles.primaryLink} href="/families/new">
            {t("addStudent")}
          </Link>
        ) : null}
      </header>

      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="parent-profile-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="parent-profile-title">
                {t("parentTitle")}
              </h2>
              <p className={styles.sectionIntro}>{t("parentIntro")}</p>
            </div>
          </div>
          <ParentProfileForm parent={parent} />
          <p className={styles.privacyNote}>{t("privacy")}</p>
        </section>

        <section className={styles.panel} aria-labelledby="student-list-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="student-list-title">
                {t("studentsTitle")}
              </h2>
              <p className={styles.sectionIntro}>{t("studentsIntro")}</p>
            </div>
          </div>
          {!parent ? (
            <div className={styles.empty}>
              <h3 className={styles.emptyTitle}>{t("parentFirstTitle")}</h3>
              <p className={styles.emptyText}>{t("parentFirstText")}</p>
            </div>
          ) : students.length === 0 ? (
            <div className={styles.empty}>
              <h3 className={styles.emptyTitle}>{t("emptyTitle")}</h3>
              <p className={styles.emptyText}>{t("emptyText")}</p>
              <Link className={styles.primaryLink} href="/families/new">
                {t("createFirst")}
              </Link>
            </div>
          ) : (
            <ul className={styles.studentList}>
              {students.map((student) => (
                <StudentCard key={student.id} student={student} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
