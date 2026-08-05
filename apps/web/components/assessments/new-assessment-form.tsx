"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./assessments.module.css";

type AssessmentType = "diagnostic" | "quiz" | "exam" | "practice";
type QuestionType = "multiple_choice" | "short_answer" | "numeric" | "essay" | "code";
type AudienceMode = "everyone" | "selected";
type IntegrityAction = "log_only" | "warn" | "auto_submit";

const ASSESSMENT_TYPES: AssessmentType[] = ["diagnostic", "quiz", "exam", "practice"];
const QUESTION_TYPES: QuestionType[] = [
  "multiple_choice",
  "short_answer",
  "numeric",
  "essay",
  "code",
];
const INTEGRITY_ACTIONS: IntegrityAction[] = ["log_only", "warn", "auto_submit"];

interface ChoiceRow {
  key: string;
  label: string;
}

interface QuestionRow {
  type: QuestionType;
  prompt: string;
  points: string;
  correctAnswer: string;
  choices: ChoiceRow[];
}

function emptyChoice(): ChoiceRow {
  return { key: "", label: "" };
}

function emptyQuestion(): QuestionRow {
  return {
    type: "multiple_choice",
    prompt: "",
    points: "1",
    correctAnswer: "",
    choices: [emptyChoice(), emptyChoice()],
  };
}

function messageFromResponse(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

export function NewAssessmentForm({
  subjects,
  students,
}: {
  subjects: { id: string; name: string }[];
  students: { studentProfileId: string; studentName: string }[];
}) {
  const t = useTranslations("assessments");
  const idPrefix = useId();
  const router = useRouter();

  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AssessmentType>("quiz");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [publish, setPublish] = useState(false);
  const [fullscreenRequired, setFullscreenRequired] = useState(false);
  const [cameraRequired, setCameraRequired] = useState(false);
  const [cameraPolicyVersion, setCameraPolicyVersion] = useState("");
  const [headTrackingEnabled, setHeadTrackingEnabled] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("everyone");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [maxAttempts, setMaxAttempts] = useState("");
  const [violationLimit, setViolationLimit] = useState("");
  const [integrityAction, setIntegrityAction] = useState<IntegrityAction>("log_only");
  const [questions, setQuestions] = useState<QuestionRow[]>([emptyQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleStudent(studentProfileId: string, checked: boolean) {
    setSelectedStudentIds((current) =>
      checked ? [...current, studentProfileId] : current.filter((id) => id !== studentProfileId),
    );
  }

  function updateQuestion(index: number, patch: Partial<QuestionRow>) {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }
  function addQuestion() {
    setQuestions((current) => [...current, emptyQuestion()]);
  }
  function removeQuestion(index: number) {
    setQuestions((current) => current.filter((_, i) => i !== index));
  }
  function updateChoice(questionIndex: number, choiceIndex: number, patch: Partial<ChoiceRow>) {
    setQuestions((current) =>
      current.map((q, i) =>
        i === questionIndex
          ? { ...q, choices: q.choices.map((c, ci) => (ci === choiceIndex ? { ...c, ...patch } : c)) }
          : q,
      ),
    );
  }
  function addChoice(questionIndex: number) {
    setQuestions((current) =>
      current.map((q, i) =>
        i === questionIndex ? { ...q, choices: [...q.choices, emptyChoice()] } : q,
      ),
    );
  }
  function removeChoice(questionIndex: number, choiceIndex: number) {
    setQuestions((current) =>
      current.map((q, i) =>
        i === questionIndex ? { ...q, choices: q.choices.filter((_, ci) => ci !== choiceIndex) } : q,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!subjectId) {
      setError(t("newAssessment.validation.subject"));
      return;
    }
    if (!title.trim()) {
      setError(t("newAssessment.validation.title"));
      return;
    }

    const answeredQuestions = questions.filter((question) => question.prompt.trim());
    if (answeredQuestions.length === 0) {
      setError(t("newAssessment.validation.questions"));
      return;
    }
    // Numbered against the full on-screen list (including any blank rows) so the message matches
    // what the tutor sees, not the post-filter position.
    const invalidChoiceIndex = questions.findIndex(
      (question) =>
        question.prompt.trim() &&
        question.type === "multiple_choice" &&
        question.choices.filter((choice) => choice.key.trim() && choice.label.trim()).length < 2,
    );
    if (invalidChoiceIndex !== -1) {
      setError(t("newAssessment.validation.choices", { number: invalidChoiceIndex + 1 }));
      return;
    }
    if (cameraRequired && !cameraPolicyVersion.trim()) {
      setError(t("newAssessment.validation.cameraPolicy"));
      return;
    }
    if (audienceMode === "selected" && selectedStudentIds.length === 0) {
      setError(t("newAssessment.validation.audience"));
      return;
    }
    if (integrityAction !== "log_only" && !violationLimit.trim()) {
      setError(t("newAssessment.validation.violationLimit"));
      return;
    }

    const preparedQuestions = answeredQuestions.map((question) => {
      const points = Number(question.points);
      const choices =
        question.type === "multiple_choice"
          ? question.choices
              .map((choice) => ({ key: choice.key.trim(), label: choice.label.trim() }))
              .filter((choice) => choice.key && choice.label)
          : null;
      return {
        type: question.type,
        prompt: question.prompt.trim(),
        choices,
        correctAnswer: question.correctAnswer.trim() || null,
        points: Number.isFinite(points) && points > 0 ? points : 1,
        poolId: null,
      };
    });

    setSubmitting(true);
    try {
      const durationSeconds =
        durationMinutes.trim() === "" ? null : Math.round(Number(durationMinutes) * 60);
      const maxAttemptsValue = maxAttempts.trim() === "" ? null : Math.round(Number(maxAttempts));
      const violationLimitValue =
        violationLimit.trim() === "" ? null : Math.round(Number(violationLimit));
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectId,
          title: title.trim(),
          description: description.trim() || null,
          type,
          status: publish ? "published" : "draft",
          version: {
            changeSummary: null,
            durationSeconds,
            fullscreenRequired,
            camera: {
              required: cameraRequired,
              policyVersion: cameraRequired ? cameraPolicyVersion.trim() : null,
              headTrackingEnabled: cameraRequired && headTrackingEnabled,
            },
            audience:
              audienceMode === "everyone"
                ? { mode: "everyone" }
                : { mode: "selected", studentProfileIds: selectedStudentIds },
            maxAttempts: maxAttemptsValue,
            integrityPolicy: {
              violationLimit: integrityAction === "log_only" ? null : violationLimitValue,
              action: integrityAction,
            },
            questions: preparedQuestions,
          },
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) throw new Error(messageFromResponse(payload, t("errors.create")));
      router.push("/assessments");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.create"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.shell}>
      <Link className={styles.backLink} href="/assessments">
        ← {t("newAssessment.back")}
      </Link>
      <header className={styles.overviewHeader}>
        <p className={styles.eyebrow}>{t("newAssessment.eyebrow")}</p>
        <h1>{t("newAssessment.title")}</h1>
        <p className={styles.lede}>{t("newAssessment.intro")}</p>
      </header>

      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-subject`}>
              {t("newAssessment.subject")}
            </label>
            <select
              className={styles.select}
              id={`${idPrefix}-subject`}
              onChange={(event) => setSubjectId(event.target.value)}
              value={subjectId}
            >
              <option value="">{t("newAssessment.selectSubject")}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            {subjects.length === 0 ? (
              <p className={styles.hint}>{t("newAssessment.noSubjects")}</p>
            ) : null}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-title`}>
              {t("newAssessment.assessmentTitle")}
            </label>
            <input
              className={styles.input}
              id={`${idPrefix}-title`}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-type`}>
              {t("newAssessment.type")}
            </label>
            <select
              className={styles.select}
              id={`${idPrefix}-type`}
              onChange={(event) => setType(event.target.value as AssessmentType)}
              value={type}
            >
              {ASSESSMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(`types.${option}`)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-duration`}>
              {t("newAssessment.duration")}
            </label>
            <input
              className={styles.input}
              id={`${idPrefix}-duration`}
              max={480}
              min={1}
              onChange={(event) => setDurationMinutes(event.target.value)}
              type="number"
              value={durationMinutes}
            />
            <p className={styles.hint}>{t("newAssessment.durationHint")}</p>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-description`}>
            {t("newAssessment.description")}
          </label>
          <textarea
            className={styles.textarea}
            id={`${idPrefix}-description`}
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </div>

        <div className={styles.checkboxRow}>
          <input
            checked={publish}
            id={`${idPrefix}-publish`}
            onChange={(event) => setPublish(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={`${idPrefix}-publish`}>{t("newAssessment.publishNow")}</label>
        </div>
        <p className={styles.hint}>{t("newAssessment.publishHint")}</p>

        <fieldset className={styles.field}>
          <legend className={styles.label}>{t("newAssessment.proctoring.legend")}</legend>
          <div className={styles.checkboxRow}>
            <input
              checked={fullscreenRequired}
              id={`${idPrefix}-fullscreen`}
              onChange={(event) => setFullscreenRequired(event.target.checked)}
              type="checkbox"
            />
            <label htmlFor={`${idPrefix}-fullscreen`}>{t("newAssessment.proctoring.fullscreen")}</label>
          </div>
          <p className={styles.hint}>{t("newAssessment.proctoring.fullscreenHint")}</p>

          <div className={styles.checkboxRow}>
            <input
              checked={cameraRequired}
              id={`${idPrefix}-camera`}
              onChange={(event) => {
                setCameraRequired(event.target.checked);
                if (!event.target.checked) setHeadTrackingEnabled(false);
              }}
              type="checkbox"
            />
            <label htmlFor={`${idPrefix}-camera`}>{t("newAssessment.proctoring.camera")}</label>
          </div>
          <p className={styles.hint}>{t("newAssessment.proctoring.cameraHint")}</p>

          {cameraRequired ? (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${idPrefix}-camera-policy`}>
                  {t("newAssessment.proctoring.policyVersion")}
                </label>
                <input
                  className={styles.input}
                  id={`${idPrefix}-camera-policy`}
                  onChange={(event) => setCameraPolicyVersion(event.target.value)}
                  placeholder={t("newAssessment.proctoring.policyVersionPlaceholder")}
                  value={cameraPolicyVersion}
                />
              </div>

              <div className={styles.checkboxRow}>
                <input
                  checked={headTrackingEnabled}
                  id={`${idPrefix}-head-tracking`}
                  onChange={(event) => setHeadTrackingEnabled(event.target.checked)}
                  type="checkbox"
                />
                <label htmlFor={`${idPrefix}-head-tracking`}>
                  {t("newAssessment.proctoring.headTracking")}
                </label>
              </div>
              <p className={styles.hint}>{t("newAssessment.proctoring.headTrackingHint")}</p>
            </>
          ) : null}
        </fieldset>

        <fieldset className={styles.field}>
          <legend className={styles.label}>{t("newAssessment.audience.legend")}</legend>
          <div className={styles.checkboxRow}>
            <input
              checked={audienceMode === "everyone"}
              id={`${idPrefix}-audience-everyone`}
              name={`${idPrefix}-audience`}
              onChange={() => setAudienceMode("everyone")}
              type="radio"
            />
            <label htmlFor={`${idPrefix}-audience-everyone`}>
              {t("newAssessment.audience.everyone")}
            </label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              checked={audienceMode === "selected"}
              id={`${idPrefix}-audience-selected`}
              name={`${idPrefix}-audience`}
              onChange={() => setAudienceMode("selected")}
              type="radio"
            />
            <label htmlFor={`${idPrefix}-audience-selected`}>
              {t("newAssessment.audience.selected")}
            </label>
          </div>
          {audienceMode === "selected" ? (
            students.length === 0 ? (
              <p className={styles.hint}>{t("newAssessment.audience.noStudents")}</p>
            ) : (
              <div className={styles.field}>
                {students.map((option) => (
                  <div className={styles.checkboxRow} key={option.studentProfileId}>
                    <input
                      checked={selectedStudentIds.includes(option.studentProfileId)}
                      id={`${idPrefix}-student-${option.studentProfileId}`}
                      onChange={(event) =>
                        toggleStudent(option.studentProfileId, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <label htmlFor={`${idPrefix}-student-${option.studentProfileId}`}>
                      {option.studentName}
                    </label>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </fieldset>

        <fieldset className={styles.field}>
          <legend className={styles.label}>{t("newAssessment.integrity.legend")}</legend>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-max-attempts`}>
              {t("newAssessment.integrity.maxAttempts")}
            </label>
            <input
              className={styles.input}
              id={`${idPrefix}-max-attempts`}
              min={1}
              onChange={(event) => setMaxAttempts(event.target.value)}
              type="number"
              value={maxAttempts}
            />
            <p className={styles.hint}>{t("newAssessment.integrity.maxAttemptsHint")}</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-integrity-action`}>
              {t("newAssessment.integrity.action")}
            </label>
            <select
              className={styles.select}
              id={`${idPrefix}-integrity-action`}
              onChange={(event) => setIntegrityAction(event.target.value as IntegrityAction)}
              value={integrityAction}
            >
              {INTEGRITY_ACTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`newAssessment.integrity.actionOption.${option}`)}
                </option>
              ))}
            </select>
            <p className={styles.hint}>{t(`newAssessment.integrity.actionHint.${integrityAction}`)}</p>
          </div>

          {integrityAction !== "log_only" ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-violation-limit`}>
                {t("newAssessment.integrity.violationLimit")}
              </label>
              <input
                className={styles.input}
                id={`${idPrefix}-violation-limit`}
                min={1}
                onChange={(event) => setViolationLimit(event.target.value)}
                type="number"
                value={violationLimit}
              />
              <p className={styles.hint}>{t("newAssessment.integrity.violationLimitHint")}</p>
            </div>
          ) : null}
        </fieldset>

        <fieldset className={styles.field}>
          <legend className={styles.label}>{t("newAssessment.questions")}</legend>
          {questions.map((question, questionIndex) => (
            <div className={styles.question} key={questionIndex}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${idPrefix}-q-type-${questionIndex}`}>
                    {t("newAssessment.questionType")}
                  </label>
                  <select
                    className={styles.select}
                    id={`${idPrefix}-q-type-${questionIndex}`}
                    onChange={(event) =>
                      updateQuestion(questionIndex, { type: event.target.value as QuestionType })
                    }
                    value={question.type}
                  >
                    {QUESTION_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {t(`newAssessment.questionTypeOption.${option}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${idPrefix}-q-points-${questionIndex}`}>
                    {t("newAssessment.points")}
                  </label>
                  <input
                    className={styles.input}
                    id={`${idPrefix}-q-points-${questionIndex}`}
                    min={0}
                    onChange={(event) => updateQuestion(questionIndex, { points: event.target.value })}
                    step="any"
                    type="number"
                    value={question.points}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${idPrefix}-q-prompt-${questionIndex}`}>
                  {t("newAssessment.prompt")}
                </label>
                <textarea
                  className={styles.textarea}
                  id={`${idPrefix}-q-prompt-${questionIndex}`}
                  onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
                  value={question.prompt}
                />
              </div>
              {question.type === "multiple_choice" ? (
                <div className={styles.field}>
                  <span className={styles.label}>{t("newAssessment.options")}</span>
                  {question.choices.map((choice, choiceIndex) => (
                    <div className={styles.choiceRow} key={choiceIndex}>
                      <div className={styles.field}>
                        <label
                          className={styles.label}
                          htmlFor={`${idPrefix}-opt-key-${questionIndex}-${choiceIndex}`}
                        >
                          {t("newAssessment.optionKey")}
                        </label>
                        <input
                          className={styles.input}
                          id={`${idPrefix}-opt-key-${questionIndex}-${choiceIndex}`}
                          onChange={(event) =>
                            updateChoice(questionIndex, choiceIndex, { key: event.target.value })
                          }
                          value={choice.key}
                        />
                      </div>
                      <div className={styles.field}>
                        <label
                          className={styles.label}
                          htmlFor={`${idPrefix}-opt-label-${questionIndex}-${choiceIndex}`}
                        >
                          {t("newAssessment.optionLabel")}
                        </label>
                        <input
                          className={styles.input}
                          id={`${idPrefix}-opt-label-${questionIndex}-${choiceIndex}`}
                          onChange={(event) =>
                            updateChoice(questionIndex, choiceIndex, { label: event.target.value })
                          }
                          value={choice.label}
                        />
                      </div>
                      <button
                        className={styles.buttonDanger}
                        disabled={question.choices.length <= 2}
                        onClick={() => removeChoice(questionIndex, choiceIndex)}
                        type="button"
                      >
                        {t("newAssessment.removeOption")}
                      </button>
                    </div>
                  ))}
                  <button
                    className={styles.buttonSecondary}
                    onClick={() => addChoice(questionIndex)}
                    type="button"
                  >
                    {t("newAssessment.addOption")}
                  </button>
                </div>
              ) : (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${idPrefix}-q-answer-${questionIndex}`}>
                    {t("newAssessment.correctAnswer")}
                  </label>
                  <input
                    className={styles.input}
                    id={`${idPrefix}-q-answer-${questionIndex}`}
                    onChange={(event) =>
                      updateQuestion(questionIndex, { correctAnswer: event.target.value })
                    }
                    value={question.correctAnswer}
                  />
                </div>
              )}
              <button
                className={styles.buttonDanger}
                disabled={questions.length === 1}
                onClick={() => removeQuestion(questionIndex)}
                type="button"
              >
                {t("newAssessment.removeQuestion")}
              </button>
            </div>
          ))}
          <button className={styles.buttonSecondary} onClick={addQuestion} type="button">
            {t("newAssessment.addQuestion")}
          </button>
        </fieldset>

        {error ? (
          <p className={styles.inlineError} role="alert">
            {error}
          </p>
        ) : null}

        <button className={styles.primaryButton} disabled={submitting} type="submit">
          {submitting ? t("newAssessment.creating") : t("newAssessment.create")}
        </button>
      </form>
    </div>
  );
}
