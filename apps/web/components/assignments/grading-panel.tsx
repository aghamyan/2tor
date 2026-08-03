"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  RubricRecord,
  RubricScoreRecord,
} from "../../../../packages/domain/assignments/models";
import { createRubricAction, gradeSubmissionAction } from "../../app/(app)/assignments/actions";
import { initialAssignmentActionState } from "../../app/(app)/assignments/action-state";
import { ActionFeedback, FieldError, fieldErrorId } from "./action-feedback";
import styles from "./assignments.module.css";

interface CriterionRow {
  rubricId: string;
  criterionKey: string;
  criterionLabel: string;
  scoreValue: string;
  maxValue: string;
  comments: string;
}

function toRows(scores: RubricScoreRecord[]): CriterionRow[] {
  return scores.map((score) => ({
    rubricId: score.rubricId,
    criterionKey: score.criterionKey,
    criterionLabel: score.criterionLabel,
    scoreValue: String(score.scoreValue),
    maxValue: String(score.maxValue),
    comments: score.comments ?? "",
  }));
}

export function GradingPanel({
  assignmentId,
  submissionId,
  rubrics,
  existingGrading,
  existingRubricScores,
}: {
  assignmentId: string;
  submissionId: string;
  rubrics: RubricRecord[];
  existingGrading: {
    score: number | null;
    maxScore: number | null;
    feedback: string | null;
  } | null;
  existingRubricScores: RubricScoreRecord[];
}) {
  const t = useTranslations("assignments.detail.grading");
  const idPrefix = useId();
  const [gradeState, gradeAction, gradePending] = useActionState(
    gradeSubmissionAction,
    initialAssignmentActionState,
  );
  const [rubricState, rubricAction, rubricPending] = useActionState(
    createRubricAction,
    initialAssignmentActionState,
  );
  const [showNewRubric, setShowNewRubric] = useState(false);
  const [rows, setRows] = useState<CriterionRow[]>(toRows(existingRubricScores));

  function addRow() {
    setRows((current) => [
      ...current,
      {
        rubricId: rubrics[0]?.id ?? "",
        criterionKey: "",
        criterionLabel: "",
        scoreValue: "",
        maxValue: "",
        comments: "",
      },
    ]);
  }
  function updateRow(index: number, patch: Partial<CriterionRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  const rubricScoresJson = JSON.stringify(
    rows
      .filter((row) => row.rubricId && row.criterionLabel)
      .map((row) => ({
        rubricId: row.rubricId,
        criterionKey:
          row.criterionKey || row.criterionLabel.toLowerCase().replace(/\s+/g, "-").slice(0, 80),
        criterionLabel: row.criterionLabel,
        scoreValue: Number(row.scoreValue) || 0,
        maxValue: Number(row.maxValue) || 0,
        comments: row.comments.trim() || null,
      })),
  );

  return (
    <section aria-labelledby="grading-title" className={styles.panel}>
      <h2 className={styles.sectionTitle} id="grading-title">
        {t("title")}
      </h2>
      <ActionFeedback state={gradeState} />
      <form action={gradeAction} className={styles.form}>
        <input name="submissionId" type="hidden" value={submissionId} />
        <input name="assignmentId" type="hidden" value={assignmentId} />
        <input name="rubricScoresJson" type="hidden" value={rubricScoresJson} />
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-score`}>
              {t("score")}
            </label>
            <input
              aria-describedby={fieldErrorId("score")}
              className={styles.input}
              defaultValue={existingGrading?.score ?? ""}
              id={`${idPrefix}-score`}
              min={0}
              name="score"
              step="any"
              type="number"
            />
            <FieldError name="score" state={gradeState} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-max-score`}>
              {t("maxScore")}
            </label>
            <input
              aria-describedby={fieldErrorId("maxScore")}
              className={styles.input}
              defaultValue={existingGrading?.maxScore ?? ""}
              id={`${idPrefix}-max-score`}
              min={0}
              name="maxScore"
              step="any"
              type="number"
            />
            <FieldError name="maxScore" state={gradeState} />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-feedback`}>
            {t("feedback")}
          </label>
          <textarea
            className={styles.textarea}
            defaultValue={existingGrading?.feedback ?? ""}
            id={`${idPrefix}-feedback`}
            name="feedback"
          />
        </div>

        <fieldset className={styles.field}>
          <legend className={styles.label}>{t("rubricScores")}</legend>
          {rows.length === 0 ? <p className={styles.hint}>{t("noCriteria")}</p> : null}
          {rows.map((row, index) => (
            <div className={styles.criterionRow} key={index}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${idPrefix}-rubric-${index}`}>
                  {t("rubric")}
                </label>
                <select
                  className={styles.select}
                  id={`${idPrefix}-rubric-${index}`}
                  onChange={(event) => updateRow(index, { rubricId: event.target.value })}
                  value={row.rubricId}
                >
                  <option value="">{t("selectRubric")}</option>
                  {rubrics.map((rubric) => (
                    <option key={rubric.id} value={rubric.id}>
                      {rubric.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${idPrefix}-criterion-${index}`}>
                  {t("criterion")}
                </label>
                <input
                  className={styles.input}
                  id={`${idPrefix}-criterion-${index}`}
                  onChange={(event) => updateRow(index, { criterionLabel: event.target.value })}
                  value={row.criterionLabel}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${idPrefix}-criterion-score-${index}`}>
                  {t("criterionScore")}
                </label>
                <input
                  className={styles.input}
                  id={`${idPrefix}-criterion-score-${index}`}
                  min={0}
                  onChange={(event) => updateRow(index, { scoreValue: event.target.value })}
                  step="any"
                  type="number"
                  value={row.scoreValue}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${idPrefix}-criterion-max-${index}`}>
                  {t("criterionMax")}
                </label>
                <input
                  className={styles.input}
                  id={`${idPrefix}-criterion-max-${index}`}
                  min={0}
                  onChange={(event) => updateRow(index, { maxValue: event.target.value })}
                  step="any"
                  type="number"
                  value={row.maxValue}
                />
              </div>
              <button
                aria-label={t("removeCriterionFor", {
                  criterion: row.criterionLabel || t("criterion"),
                })}
                className={`${styles.button} ${styles.buttonDanger}`}
                onClick={() => removeRow(index)}
                type="button"
              >
                {t("removeCriterion")}
              </button>
            </div>
          ))}
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            disabled={rubrics.length === 0}
            onClick={addRow}
            type="button"
          >
            {t("addCriterion")}
          </button>
          {rubrics.length === 0 ? <p className={styles.hint}>{t("noRubricsYet")}</p> : null}
        </fieldset>

        <button className={styles.button} disabled={gradePending} type="submit">
          {gradePending ? t("submitting") : t("submitGrade")}
        </button>
      </form>

      {showNewRubric ? (
        <div className={styles.panel}>
          <ActionFeedback state={rubricState} />
          <form action={rubricAction} className={styles.form}>
            <input name="assignmentId" type="hidden" value={assignmentId} />
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-rubric-title`}>
                {t("newRubricTitle")}
              </label>
              <input
                aria-describedby={fieldErrorId("title")}
                className={styles.input}
                id={`${idPrefix}-rubric-title`}
                name="title"
                required
              />
              <FieldError name="title" state={rubricState} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-rubric-description`}>
                {t("newRubricDescription")}
              </label>
              <textarea
                className={styles.textarea}
                id={`${idPrefix}-rubric-description`}
                name="description"
              />
            </div>
            <div className={styles.actionsRow}>
              <button className={styles.button} disabled={rubricPending} type="submit">
                {t("createRubric")}
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={() => setShowNewRubric(false)}
                type="button"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button className={styles.linkButton} onClick={() => setShowNewRubric(true)} type="button">
          {t("newRubricPrompt")}
        </button>
      )}
    </section>
  );
}
