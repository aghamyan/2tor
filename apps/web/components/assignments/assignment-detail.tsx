import Link from "next/link";
import { useTranslations } from "next-intl";

import type { AssignmentDetailData } from "../../app/(app)/assignments/queries";
import { AssignmentStatusActions } from "./assignment-status-actions";
import styles from "./assignments.module.css";
import { FileUpload } from "./file-upload";
import { GradingPanel } from "./grading-panel";
import { SubmissionForm } from "./submission-form";

function statusBadgeClass(
  status: AssignmentDetailData["assignment"]["status"],
): string | undefined {
  if (status === "published") return styles.badgePrimary;
  return styles.badgeNeutral;
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function AssignmentDetail({ data }: { data: AssignmentDetailData }) {
  const t = useTranslations("assignments");
  const td = useTranslations("assignments.detail");
  const { assignment, studentName, submission, files, grading, rubricScores, rubrics, viewer } =
    data;
  const dueLabel = formatDate(assignment.dueAt);
  const answerByQuestion = new Map(
    (submission?.answers ?? []).map((answer) => [answer.questionId, answer]),
  );

  return (
    <div className={styles.shell}>
      <Link className={styles.backLink} href="/assignments">
        {td("backToList")}
      </Link>

      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{td("eyebrow")}</p>
          <h1 className={styles.title}>{assignment.title}</h1>
          {!viewer.isStudentOwner && studentName ? (
            <p className={styles.lede}>{td("forStudent", { name: studentName })}</p>
          ) : null}
        </div>
        <span className={`${styles.badge} ${statusBadgeClass(assignment.status)}`}>
          {t(`status.${assignment.status}`)}
        </span>
      </header>

      {viewer.canManage ? (
        <AssignmentStatusActions assignmentId={assignment.id} status={assignment.status} />
      ) : null}

      <section className={styles.panel}>
        <dl className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <dt>{td("dueDate")}</dt>
            <dd>{dueLabel ?? td("noDueDate")}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{td("maxScore")}</dt>
            <dd>{assignment.maxScore ?? td("notSet")}</dd>
          </div>
          {submission ? (
            <div className={styles.detailItem}>
              <dt>{td("submissionStatus")}</dt>
              <dd>{t(`submissionStatus.${submission.status}`)}</dd>
            </div>
          ) : null}
        </dl>
        {assignment.instructions ? (
          <div className={styles.field}>
            <span className={styles.label}>{td("instructions")}</span>
            <p>{assignment.instructions}</p>
          </div>
        ) : null}
      </section>

      {viewer.isStudentOwner ? (
        assignment.status === "draft" ? (
          <section className={styles.panel}>
            <p className={styles.hint}>{td("notPublishedYet")}</p>
          </section>
        ) : (
          <SubmissionForm
            alreadyGraded={submission?.status === "graded"}
            assignmentId={assignment.id}
            existingAnswers={submission?.answers ?? []}
            // Remounts on every persisted change so uncontrolled `defaultValue` fields and
            // `useActionState`'s local state don't go stale after `revalidatePath` re-renders
            // this Server Component tree with fresh props but the same client instance.
            key={submission?.updatedAt.toISOString() ?? "new"}
            locked={assignment.status !== "published"}
            questions={assignment.questions}
          />
        )
      ) : (
        <section aria-labelledby="answers-title" className={styles.panel}>
          <h2 className={styles.sectionTitle} id="answers-title">
            {td("submissionReview")}
          </h2>
          {submission ? (
            <ol className={styles.questionList}>
              {assignment.questions.map((question, index) => {
                const answer = answerByQuestion.get(question.id);
                const optionLabel =
                  answer?.selectedOptionKey && question.options
                    ? question.options.find((option) => option.key === answer.selectedOptionKey)
                        ?.label
                    : null;
                return (
                  <li className={styles.question} key={question.id}>
                    <p className={styles.questionPrompt}>
                      {index + 1}. {question.prompt}
                    </p>
                    <div className={styles.answerReadout}>
                      {optionLabel ?? answer?.answerText ?? td("noAnswerYet")}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.hint}>{td("noSubmissionYet")}</p>
          )}
        </section>
      )}

      {submission ? (
        <FileUpload
          assignmentId={assignment.id}
          canDownload
          canUpload={viewer.isStudentOwner && assignment.status === "published"}
          files={files}
          submissionId={submission.id}
        />
      ) : null}

      {submission && viewer.canManage ? (
        <GradingPanel
          assignmentId={assignment.id}
          existingGrading={grading}
          existingRubricScores={rubricScores}
          // See the matching comment on `SubmissionForm`'s key — `rows` is local `useState`
          // seeded once from `existingRubricScores`, so it must remount when a save changes them.
          key={`${submission.id}-${grading?.gradedAt.toISOString() ?? "ungraded"}`}
          rubrics={rubrics}
          submissionId={submission.id}
        />
      ) : null}

      {submission && !viewer.canManage && grading ? (
        <section aria-labelledby="grade-summary-title" className={styles.panel}>
          <h2 className={styles.sectionTitle} id="grade-summary-title">
            {td("grading.title")}
          </h2>
          <dl className={styles.detailGrid}>
            <div className={styles.detailItem}>
              <dt>{td("grading.score")}</dt>
              <dd>
                {grading.score ?? td("notSet")}
                {grading.maxScore !== null ? ` / ${grading.maxScore}` : ""}
              </dd>
            </div>
          </dl>
          {grading.feedback ? (
            <div className={styles.field}>
              <span className={styles.label}>{td("grading.feedback")}</span>
              <p>{grading.feedback}</p>
            </div>
          ) : null}
          {rubricScores.length > 0 ? (
            <ul className={styles.questionList}>
              {rubricScores.map((score) => (
                <li className={styles.question} key={score.id}>
                  <p className={styles.questionPrompt}>{score.criterionLabel}</p>
                  <p className={styles.questionMeta}>
                    {score.scoreValue} / {score.maxValue}
                  </p>
                  {score.comments ? <p>{score.comments}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
