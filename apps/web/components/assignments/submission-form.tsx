"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";

import type {
  AssignmentQuestionRecord,
  SubmissionAnswerRecord,
} from "../../../../packages/domain/assignments/models";
import { saveSubmissionAnswersAction } from "../../app/(app)/assignments/actions";
import { initialAssignmentActionState } from "../../app/(app)/assignments/action-state";
import { ActionFeedback } from "./action-feedback";
import styles from "./assignments.module.css";

export function SubmissionForm({
  assignmentId,
  questions,
  existingAnswers,
  locked,
  alreadyGraded,
}: {
  assignmentId: string;
  questions: AssignmentQuestionRecord[];
  existingAnswers: SubmissionAnswerRecord[];
  locked: boolean;
  alreadyGraded: boolean;
}) {
  const t = useTranslations("assignments.detail.submission");
  const idPrefix = useId();
  const [state, action, pending] = useActionState(
    saveSubmissionAnswersAction,
    initialAssignmentActionState,
  );
  const answerByQuestion = new Map(existingAnswers.map((answer) => [answer.questionId, answer]));

  return (
    <section aria-labelledby="submission-title" className={styles.panel}>
      <h2 className={styles.sectionTitle} id="submission-title">
        {t("title")}
      </h2>
      {locked ? <p className={styles.hint}>{t("locked")}</p> : null}
      {!locked && alreadyGraded ? <p className={styles.hint}>{t("alreadyGradedNote")}</p> : null}
      <ActionFeedback state={state} />
      <form action={action} className={styles.form}>
        <input name="assignmentId" type="hidden" value={assignmentId} />
        <ol className={styles.questionList}>
          {questions.map((question, index) => {
            const existing = answerByQuestion.get(question.id);
            return (
              <li className={styles.question} key={question.id}>
                <input name="questionId" type="hidden" value={question.id} />
                <p className={styles.questionPrompt}>
                  {index + 1}. {question.prompt}
                </p>
                <p className={styles.questionMeta}>
                  {t(`questionType.${question.type}`)}
                  {question.points !== null ? ` · ${t("points", { points: question.points })}` : ""}
                </p>
                {question.type === "multiple_choice" && question.options ? (
                  <div aria-label={question.prompt} className={styles.radioRow} role="radiogroup">
                    {question.options.map((option) => (
                      <label className={styles.radioOption} key={option.key}>
                        <input
                          defaultChecked={existing?.selectedOptionKey === option.key}
                          disabled={locked}
                          name={`option-${question.id}`}
                          type="radio"
                          value={option.key}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                ) : question.type === "file_upload" ? (
                  <p className={styles.hint}>{t("fileUploadNote")}</p>
                ) : (
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`${idPrefix}-answer-${question.id}`}>
                      {t("yourAnswer")}
                    </label>
                    <textarea
                      className={styles.textarea}
                      defaultValue={existing?.answerText ?? ""}
                      disabled={locked}
                      id={`${idPrefix}-answer-${question.id}`}
                      name={`answer-${question.id}`}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {locked ? null : (
          <div className={styles.actionsRow}>
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              disabled={pending}
              name="submit"
              type="submit"
              value="false"
            >
              {t("saveDraft")}
            </button>
            <button
              className={styles.button}
              disabled={pending}
              name="submit"
              type="submit"
              value="true"
            >
              {t("submitFinal")}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
