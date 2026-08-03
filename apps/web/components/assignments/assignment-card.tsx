import Link from "next/link";
import { useTranslations } from "next-intl";

import type { AssignmentSummaryRecord } from "../../../../packages/domain/assignments/models";
import styles from "./assignments.module.css";

function statusBadgeClass(status: AssignmentSummaryRecord["status"]): string | undefined {
  if (status === "published") return styles.badgePrimary;
  return styles.badgeNeutral;
}

function submissionBadgeClass(
  status: AssignmentSummaryRecord["submissionStatus"],
): string | undefined {
  if (status === "graded") return styles.badgeSuccess;
  if (status === "submitted") return styles.badgePrimary;
  if (status === "in_progress" || status === "returned") return styles.badgeWarning;
  return styles.badgeNeutral;
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function AssignmentCard({
  assignment,
  showStudentName,
}: {
  assignment: AssignmentSummaryRecord;
  showStudentName: boolean;
}) {
  const t = useTranslations("assignments");
  const dueLabel = formatDate(assignment.dueAt);
  const submissionStatus = assignment.submissionStatus ?? "not_started";

  return (
    <li>
      <Link className={styles.card} href={`/assignments/${assignment.id}`}>
        <div className={styles.cardTop}>
          <h3 className={styles.cardTitle}>{assignment.title}</h3>
          <span className={`${styles.badge} ${statusBadgeClass(assignment.status)}`}>
            {t(`status.${assignment.status}`)}
          </span>
        </div>
        <div className={styles.cardMeta}>
          {showStudentName ? (
            <span>
              {t("card.student")}: {assignment.studentName}
            </span>
          ) : null}
          {assignment.subjectName ? (
            <span>
              {t("card.subject")}: {assignment.subjectName}
            </span>
          ) : null}
          <span>{dueLabel ? t("card.dueOn", { date: dueLabel }) : t("card.noDueDate")}</span>
        </div>
        <div className={styles.cardTop}>
          <span className={`${styles.badge} ${submissionBadgeClass(assignment.submissionStatus)}`}>
            {t(`submissionStatus.${submissionStatus}`)}
          </span>
          {assignment.score !== null && assignment.maxScore !== null ? (
            <span className={styles.cardMeta}>
              {t("card.score", { score: assignment.score, maxScore: assignment.maxScore })}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
