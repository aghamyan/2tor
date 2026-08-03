"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";

import { createAssignmentAction } from "../../app/(app)/assignments/actions";
import { initialAssignmentActionState } from "../../app/(app)/assignments/action-state";
import { ActionFeedback, FieldError, fieldErrorId } from "./action-feedback";
import styles from "./assignments.module.css";

const QUESTION_TYPES = ["short_answer", "essay", "multiple_choice", "file_upload", "code"] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

interface OptionRow {
  key: string;
  label: string;
}
interface QuestionRow {
  type: QuestionType;
  prompt: string;
  points: string;
  options: OptionRow[];
}

function emptyQuestion(): QuestionRow {
  return { type: "short_answer", prompt: "", points: "", options: [] };
}

export function NewAssignmentForm({
  students,
}: {
  students: { studentProfileId: string; studentName: string }[];
}) {
  const t = useTranslations("assignments.newAssignment");
  const idPrefix = useId();
  const [state, action, pending] = useActionState(
    createAssignmentAction,
    initialAssignmentActionState,
  );
  const [questions, setQuestions] = useState<QuestionRow[]>([emptyQuestion()]);

  function addQuestion() {
    setQuestions((current) => [...current, emptyQuestion()]);
  }
  function updateQuestion(index: number, patch: Partial<QuestionRow>) {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }
  function removeQuestion(index: number) {
    setQuestions((current) => current.filter((_, i) => i !== index));
  }
  function addOption(questionIndex: number) {
    setQuestions((current) =>
      current.map((q, i) =>
        i === questionIndex ? { ...q, options: [...q.options, { key: "", label: "" }] } : q,
      ),
    );
  }
  function updateOption(questionIndex: number, optionIndex: number, patch: Partial<OptionRow>) {
    setQuestions((current) =>
      current.map((q, i) =>
        i === questionIndex
          ? {
              ...q,
              options: q.options.map((o, oi) => (oi === optionIndex ? { ...o, ...patch } : o)),
            }
          : q,
      ),
    );
  }
  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) =>
      current.map((q, i) =>
        i === questionIndex
          ? { ...q, options: q.options.filter((_, oi) => oi !== optionIndex) }
          : q,
      ),
    );
  }

  const questionsJson = JSON.stringify(
    questions
      .filter((question) => question.prompt.trim())
      .map((question) => ({
        type: question.type,
        prompt: question.prompt,
        points: question.points.trim() === "" ? null : Number(question.points) || 0,
        options:
          question.type === "multiple_choice"
            ? question.options.filter((option) => option.key.trim() && option.label.trim())
            : null,
      })),
  );

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.lede}>{t("intro")}</p>
        </div>
      </header>

      <section className={styles.panel}>
        <ActionFeedback state={state} />
        <form action={action} className={styles.form}>
          <input name="questionsJson" type="hidden" value={questionsJson} />
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-student`}>
                {t("student")}
              </label>
              <select
                aria-describedby={fieldErrorId("studentProfileId")}
                className={styles.select}
                id={`${idPrefix}-student`}
                name="studentProfileId"
                required
              >
                <option value="">{t("selectStudent")}</option>
                {students.map((student) => (
                  <option key={student.studentProfileId} value={student.studentProfileId}>
                    {student.studentName}
                  </option>
                ))}
              </select>
              <FieldError name="studentProfileId" state={state} />
              {students.length === 0 ? <p className={styles.hint}>{t("noStudents")}</p> : null}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-title`}>
                {t("assignmentTitle")}
              </label>
              <input
                aria-describedby={fieldErrorId("title")}
                className={styles.input}
                id={`${idPrefix}-title`}
                name="title"
                required
              />
              <FieldError name="title" state={state} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-due`}>
                {t("dueDate")}
              </label>
              <input className={styles.input} id={`${idPrefix}-due`} name="dueAt" type="date" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-max-score`}>
                {t("maxScore")}
              </label>
              <input
                className={styles.input}
                id={`${idPrefix}-max-score`}
                min={0}
                name="maxScore"
                step="any"
                type="number"
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-instructions`}>
              {t("instructions")}
            </label>
            <textarea
              className={styles.textarea}
              id={`${idPrefix}-instructions`}
              name="instructions"
            />
          </div>
          <div className={styles.checkboxRow}>
            <input id={`${idPrefix}-publish`} name="publish" type="checkbox" />
            <label htmlFor={`${idPrefix}-publish`}>{t("publishNow")}</label>
          </div>
          <p className={styles.hint}>{t("publishHint")}</p>

          <fieldset className={styles.field}>
            <legend className={styles.label}>{t("questions")}</legend>
            <FieldError name="questions" state={state} />
            <div className={styles.form}>
              {questions.map((question, questionIndex) => (
                <div className={styles.question} key={questionIndex}>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label
                        className={styles.label}
                        htmlFor={`${idPrefix}-q-type-${questionIndex}`}
                      >
                        {t("questionType")}
                      </label>
                      <select
                        className={styles.select}
                        id={`${idPrefix}-q-type-${questionIndex}`}
                        onChange={(event) =>
                          updateQuestion(questionIndex, {
                            type: event.target.value as QuestionType,
                          })
                        }
                        value={question.type}
                      >
                        {QUESTION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(`questionTypeOption.${type}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label
                        className={styles.label}
                        htmlFor={`${idPrefix}-q-points-${questionIndex}`}
                      >
                        {t("points")}
                      </label>
                      <input
                        className={styles.input}
                        id={`${idPrefix}-q-points-${questionIndex}`}
                        min={0}
                        onChange={(event) =>
                          updateQuestion(questionIndex, { points: event.target.value })
                        }
                        step="any"
                        type="number"
                        value={question.points}
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor={`${idPrefix}-q-prompt-${questionIndex}`}
                    >
                      {t("prompt")}
                    </label>
                    <textarea
                      className={styles.textarea}
                      id={`${idPrefix}-q-prompt-${questionIndex}`}
                      onChange={(event) =>
                        updateQuestion(questionIndex, { prompt: event.target.value })
                      }
                      required
                      value={question.prompt}
                    />
                  </div>
                  {question.type === "multiple_choice" ? (
                    <div className={styles.field}>
                      <span className={styles.label}>{t("options")}</span>
                      {question.options.map((option, optionIndex) => (
                        <div className={styles.formGrid} key={optionIndex}>
                          <div className={styles.field}>
                            <label
                              className={styles.label}
                              htmlFor={`${idPrefix}-opt-key-${questionIndex}-${optionIndex}`}
                            >
                              {t("optionKey")}
                            </label>
                            <input
                              className={styles.input}
                              id={`${idPrefix}-opt-key-${questionIndex}-${optionIndex}`}
                              onChange={(event) =>
                                updateOption(questionIndex, optionIndex, {
                                  key: event.target.value,
                                })
                              }
                              value={option.key}
                            />
                          </div>
                          <div className={styles.field}>
                            <label
                              className={styles.label}
                              htmlFor={`${idPrefix}-opt-label-${questionIndex}-${optionIndex}`}
                            >
                              {t("optionLabel")}
                            </label>
                            <input
                              className={styles.input}
                              id={`${idPrefix}-opt-label-${questionIndex}-${optionIndex}`}
                              onChange={(event) =>
                                updateOption(questionIndex, optionIndex, {
                                  label: event.target.value,
                                })
                              }
                              value={option.label}
                            />
                          </div>
                          <button
                            className={`${styles.button} ${styles.buttonDanger}`}
                            onClick={() => removeOption(questionIndex, optionIndex)}
                            type="button"
                          >
                            {t("removeOption")}
                          </button>
                        </div>
                      ))}
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        onClick={() => addOption(questionIndex)}
                        type="button"
                      >
                        {t("addOption")}
                      </button>
                    </div>
                  ) : null}
                  <button
                    className={`${styles.button} ${styles.buttonDanger}`}
                    disabled={questions.length === 1}
                    onClick={() => removeQuestion(questionIndex)}
                    type="button"
                  >
                    {t("removeQuestion")}
                  </button>
                </div>
              ))}
            </div>
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={addQuestion}
              type="button"
            >
              {t("addQuestion")}
            </button>
          </fieldset>

          <button className={styles.button} disabled={pending} type="submit">
            {pending ? t("creating") : t("create")}
          </button>
        </form>
      </section>
    </div>
  );
}
