import Link from "next/link";
import { useTranslations } from "next-intl";

import type { AssignmentListData } from "../../app/(app)/assignments/queries";
import { AssignmentCard } from "./assignment-card";
import styles from "./assignments.module.css";

const STATUS_OPTIONS = ["draft", "published", "closed"] as const;

type HomeworkGroup = "pending" | "submitted" | "reviewed" | "overdue";

function homeworkGroup(
  assignment: AssignmentListData["page"]["items"][number],
): HomeworkGroup {
  if (assignment.submissionStatus === "graded") return "reviewed";
  if (assignment.submissionStatus === "submitted") return "submitted";
  if (assignment.dueAt && assignment.dueAt.getTime() < Date.now()) {
    return "overdue";
  }
  return "pending";
}

function HomeworkSection({
  group,
  title,
  items,
  showStudentName,
}: {
  group: HomeworkGroup;
  title: string;
  items: AssignmentListData["page"]["items"];
  showStudentName: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className={styles.homeworkSection} id={`homework-${group}`} aria-labelledby={`${group}-title`}>
      <div className={styles.homeworkSectionHeading}>
        <h2 id={`${group}-title`}>{title}</h2>
        <span>{items.length}</span>
      </div>
      <ul className={styles.list}>
        {items.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            showStudentName={showStudentName}
          />
        ))}
      </ul>
    </section>
  );
}

export function AssignmentsOverview({
  data,
  currentStatus,
}: {
  data: AssignmentListData;
  currentStatus?: string;
}) {
  const t = useTranslations("assignments");
  const { page, isTutor, isStudentSelf } = data;
  const groups: Record<HomeworkGroup, AssignmentListData["page"]["items"]> = {
    pending: [],
    submitted: [],
    reviewed: [],
    overdue: [],
  };
  for (const assignment of page.items) groups[homeworkGroup(assignment)].push(assignment);

  return (
    <div className={`${styles.shell} ${styles.homeworkShell}`}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{t("overview.eyebrow")}</p>
          <h1 className={styles.title}>{t("overview.homeworkTitle")}</h1>
          <p className={styles.lede}>{t(`overview.roleIntro.${isTutor ? "tutor" : isStudentSelf ? "student" : "parent"}`)}</p>
        </div>
        {isTutor ? (
          <Link className={styles.primaryLink} href="/assignments/new">
            {t("overview.createAssignment")}
          </Link>
        ) : null}
      </header>

      <nav className={styles.homeworkFilters} aria-label={t("overview.homeworkStates")}>
        {(["pending", "submitted", "reviewed", "overdue"] as const).map((group) => (
          <a href={`#homework-${group}`} key={group} data-active={groups[group].length > 0}>
            <span>{t(`overview.groups.${group}`)}</span>
            <b>{groups[group].length}</b>
          </a>
        ))}
      </nav>

      {isTutor ? (
        <details className={styles.managementFilters}>
          <summary>{t("overview.filterHomework")}</summary>
          <form className={styles.filterBar} method="get" aria-label={t("overview.filtersLabel")}>
            <div className={styles.filterField}>
              <label className={styles.filterLabel} htmlFor="status-filter">
                {t("overview.statusFilter")}
              </label>
              <select
                className={styles.select}
                id="status-filter"
                name="status"
                defaultValue={currentStatus ?? ""}
              >
                <option value="">{t("overview.allStatuses")}</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>
            </div>
            <button className={`${styles.button} ${styles.buttonSecondary}`} type="submit">
              {t("overview.applyFilters")}
            </button>
            {currentStatus ? (
              <Link className={styles.linkButton} href="/assignments">
                {t("overview.clearFilters")}
              </Link>
            ) : null}
          </form>
        </details>
      ) : null}

      {page.items.length === 0 ? (
        <div className={styles.empty} role="status">
          <p>{t("overview.emptyTitle")}</p>
          <p className={styles.hint}>
            {isTutor ? t("overview.emptyBodyTutor") : t("overview.emptyBodyOther")}
          </p>
          {isTutor ? (
            <Link className={styles.primaryLink} href="/assignments/new">
              {t("overview.createAssignment")}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className={styles.homeworkSections}>
          <HomeworkSection group="pending" title={t("overview.groups.pending")} items={groups.pending} showStudentName={!isStudentSelf} />
          <HomeworkSection group="submitted" title={t("overview.groups.submitted")} items={groups.submitted} showStudentName={!isStudentSelf} />
          <HomeworkSection group="reviewed" title={t("overview.groups.reviewed")} items={groups.reviewed} showStudentName={!isStudentSelf} />
          <HomeworkSection group="overdue" title={t("overview.groups.overdue")} items={groups.overdue} showStudentName={!isStudentSelf} />
        </div>
      )}

      {page.nextCursor ? (
        <nav className={styles.pagination} aria-label={t("overview.paginationLabel")}>
          <Link
            className={`${styles.button} ${styles.buttonSecondary}`}
            href={{
              pathname: "/assignments",
              query: {
                ...(currentStatus ? { status: currentStatus } : {}),
                cursor: page.nextCursor,
              },
            }}
          >
            {t("overview.nextPage")}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
