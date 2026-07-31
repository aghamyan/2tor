"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import type { StudentFamilySummary } from "../../../../packages/domain/families/models";
import styles from "./families.module.css";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "•"
  );
}

export function StudentCard({ student }: { student: StudentFamilySummary }) {
  const t = useTranslations("families.studentCard");
  const age =
    student.ageBand ??
    (student.dobYearMonth ? t("birthMonth", { value: student.dobYearMonth }) : t("ageNotSet"));

  return (
    <li className={styles.studentItem}>
      <span className={styles.studentMark} aria-hidden="true">
        {initials(student.preferredName)}
      </span>
      <Link className={styles.studentCard} href={`/families/${student.id}`}>
        <span>
          <span className={styles.studentName}>{student.preferredName}</span>
          <span className={styles.metadata}>
            {t("details", {
              username: student.username,
              grade: student.gradeLevel ?? t("gradeNotSet"),
              age,
            })}
          </span>
        </span>
        <span
          className={`${styles.status} ${student.status === "active" ? styles.statusActive : ""}`}
        >
          {student.status === "active" ? t("active") : t("awaitingActivation")}
        </span>
      </Link>
    </li>
  );
}
