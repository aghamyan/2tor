"use client";

import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleCheckBig,
  Clock3,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Locale } from "@app/i18n/config";
import { consultationContent } from "./consultation-content";
import styles from "./consultation-page.module.css";

type Subject = "mathematics" | "armenian" | "group-lessons" | "not-sure";
type LessonFormat = "individual" | "group" | "choose";
type ContactMethod = "email" | "phone" | "either";

type ConsultationRequest = {
  subject: Subject | "";
  gradeOrCourse: string;
  currentLevel: string;
  learningGoals: string[];
  currentChallenge: string;
  lessonPreference: LessonFormat | "";
  desiredStart: string;
  timezone: string;
  preferredDays: string[];
  preferredTimeRanges: string[];
  scheduleFlexibility: string;
  parentName: string;
  email: string;
  phone: string;
  preferredContactMethod: ContactMethod | "";
  notes: string;
  privacyAccepted: boolean;
};

type FieldError = Partial<Record<keyof ConsultationRequest, string>>;
type InitialContext = { subject?: string; format?: string; goal?: string };

const subjectKeys: Subject[] = ["mathematics", "armenian", "group-lessons", "not-sure"];
const goalKeys = [
  "catch-up",
  "stay-on-track",
  "move-ahead",
  "homework",
  "exam-prep",
  "confidence",
  "problem-solving",
  "armenian-connection",
  "not-sure",
] as const;

function initialValues(context?: InitialContext): ConsultationRequest {
  const subject = subjectKeys.includes(context?.subject as Subject)
    ? (context?.subject as Subject)
    : "";
  const goal = goalKeys.includes(context?.goal as (typeof goalKeys)[number])
    ? (context?.goal as string)
    : "";
  const lessonPreference =
    context?.format === "group" || subject === "group-lessons" ? "group" : "";

  return {
    subject,
    gradeOrCourse: "",
    currentLevel: "",
    learningGoals: goal ? [goal] : [],
    currentChallenge: "",
    lessonPreference,
    desiredStart: "",
    timezone: "",
    preferredDays: [],
    preferredTimeRanges: [],
    scheduleFlexibility: "",
    parentName: "",
    email: "",
    phone: "",
    preferredContactMethod: "",
    notes: "",
    privacyAccepted: false,
  };
}

function localHref(locale: Locale, path: string) {
  return `/${locale}${path === "/" ? "" : path}`;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ConsultationPage({
  locale,
  initialContext,
}: {
  locale: Locale;
  initialContext?: InitialContext;
}) {
  const c = consultationContent(locale);
  const [values, setValues] = useState<ConsultationRequest>(() => initialValues(initialContext));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldError>({});
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "sent">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current !== step) headingRef.current?.focus();
    previousStep.current = step;
  }, [step]);

  function update<K extends keyof ConsultationRequest>(key: K, value: ConsultationRequest[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function availableGoals(subject: ConsultationRequest["subject"]) {
    if (subject === "mathematics") return goalKeys.filter((goal) => goal !== "armenian-connection");
    if (subject === "armenian")
      return goalKeys.filter((goal) => !["homework", "problem-solving"].includes(goal));
    return goalKeys;
  }

  function chooseSubject(subject: Subject) {
    const allowed = availableGoals(subject);
    setValues((current) => ({
      ...current,
      subject,
      gradeOrCourse: current.subject === subject ? current.gradeOrCourse : "",
      learningGoals: current.learningGoals.filter((goal) => allowed.includes(goal as never)),
      lessonPreference: subject === "group-lessons" ? "group" : current.lessonPreference,
    }));
    setErrors((current) => ({ ...current, subject: undefined, learningGoals: undefined }));
  }

  function validate(targetStep: number) {
    const next: FieldError = {};
    if (targetStep === 0) {
      if (!values.subject) next.subject = c.validation.subject;
      if (!values.learningGoals.length) next.learningGoals = c.validation.goal;
    }
    if (targetStep === 1 && !values.gradeOrCourse) next.gradeOrCourse = c.validation.grade;
    if (targetStep === 2) {
      if (!values.lessonPreference) next.lessonPreference = c.validation.format;
      if (!values.desiredStart) next.desiredStart = c.validation.start;
    }
    if (targetStep === 3) {
      if (!values.timezone.trim()) next.timezone = c.validation.timezone;
      if (!values.preferredDays.length) next.preferredDays = c.validation.days;
      if (!values.preferredTimeRanges.length) next.preferredTimeRanges = c.validation.times;
    }
    if (targetStep === 4) {
      if (values.parentName.trim().length < 2) next.parentName = c.validation.name;
      if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) next.email = c.validation.email;
      if (!values.preferredContactMethod) next.preferredContactMethod = c.validation.method;
      if (!values.privacyAccepted) next.privacyAccepted = c.validation.privacy;
    }
    setErrors(next);
    if (Object.keys(next).length) requestAnimationFrame(() => errorRef.current?.focus());
    return Object.keys(next).length === 0;
  }

  function advance() {
    if (!validate(step)) return;
    if (step === 2 && !values.timezone) {
      setValues((current) => ({
        ...current,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }));
    }
    setStep((current) => Math.min(current + 1, 5));
  }

  function back() {
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
  }

  function subjectLabel() {
    return values.subject ? c.learning.subjects[values.subject] : c.review.missing;
  }
  function goalLabels() {
    return values.learningGoals.length
      ? values.learningGoals
          .map((goal) => c.learning.goals[goal as keyof typeof c.learning.goals])
          .join(", ")
      : c.review.missing;
  }
  function formatLabel() {
    return values.lessonPreference
      ? c.preference.formats[values.lessonPreference]
      : c.review.missing;
  }
  function scheduleLabel() {
    const parts = [values.preferredDays.join(", "), values.preferredTimeRanges.join(", ")].filter(
      Boolean,
    );
    return parts.length ? parts.join(" · ") : c.review.missing;
  }

  const summary = useMemo(
    () => [
      subjectLabel(),
      values.gradeOrCourse || c.review.missing,
      goalLabels(),
      formatLabel(),
      scheduleLabel(),
    ],
    // These helpers are derived solely from form state and localized content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values, c],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 5) {
      advance();
      return;
    }
    if (status === "sending" || !validate(4)) return;
    setStatus("sending");

    const interest = `${subjectLabel()} · ${values.gradeOrCourse} · ${goalLabels()}`.slice(0, 160);
    const message = JSON.stringify({
      grade: values.gradeOrCourse,
      level: values.currentLevel || null,
      goals: values.learningGoals,
      challenge: values.currentChallenge || null,
      format: values.lessonPreference,
      start: c.preference.starts.indexOf(values.desiredStart as never),
      timezone: values.timezone,
      days: values.preferredDays.map((day) => c.schedule.dayOptions.indexOf(day as never)),
      times: values.preferredTimeRanges.map((time) =>
        c.schedule.timeOptions.indexOf(time as never),
      ),
      flexibility: values.scheduleFlexibility
        ? c.schedule.flexibilityOptions.indexOf(values.scheduleFlexibility as never)
        : null,
      contact: values.preferredContactMethod,
      notes: values.notes || null,
    });

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "consultation",
          parentName: values.parentName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          learnerAgeBand: null,
          interest,
          message,
          locale,
          privacyConsent: values.privacyAccepted,
          company: "",
        }),
      });
      if (!response.ok) throw new Error("lead request failed");
      setStatus("sent");
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <ConsultationSuccess locale={locale} values={values} summary={summary} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.shell}>
          <p className={styles.eyebrow}>{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p className={styles.lede}>{c.intro}</p>
          <ul
            className={styles.assurances}
            aria-label={locale === "hy" ? "Հիմնական տեղեկություն" : "Key information"}
          >
            {c.assurances.map((item, index) => (
              <li key={item}>
                {index === 0 ? <Clock3 /> : <CheckCircle2 />}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className={`${styles.shell} ${styles.mainGrid}`}>
        <section
          className={styles.formColumn}
          aria-label={locale === "hy" ? "Խորհրդատվության հարցում" : "Consultation request"}
        >
          {ConsultationProgress()}
          <details className={styles.mobileNext}>
            <summary>{c.panel.title}</summary>
            <ol>
              {c.panel.next.map(([title, body]) => (
                <li key={title}>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </li>
              ))}
            </ol>
          </details>
          <form className={styles.formCard} onSubmit={submit} noValidate>
            {Object.values(errors).some(Boolean) && (
              <div className={styles.errorSummary} role="alert" tabIndex={-1} ref={errorRef}>
                {Object.values(errors).find(Boolean)}
              </div>
            )}
            <div className={styles.stepFrame} key={step}>
              {step === 0 && LearningNeedStep()}
              {step === 1 && LearnerLevelStep()}
              {step === 2 && LessonPreferenceStep()}
              {step === 3 && ScheduleStep()}
              {step === 4 && ParentContactStep()}
              {step === 5 && ReviewStep()}
            </div>
            {status === "error" && (
              <p className={styles.submitError} role="alert">
                {c.error}
              </p>
            )}
            <span className={styles.srOnly} role="status" aria-live="polite">
              {status === "sending" ? c.review.sending : ""}
            </span>
            <div className={styles.formActions}>
              {step > 0 && (
                <button
                  className={styles.backButton}
                  type="button"
                  onClick={back}
                  disabled={status === "sending"}
                >
                  <ChevronLeft />
                  {c.back}
                </button>
              )}
              <button
                className={styles.continueButton}
                type="submit"
                disabled={status === "sending"}
              >
                {step === 5 ? (
                  status === "sending" ? (
                    <>
                      <span className={styles.spinner} />
                      {c.review.sending}
                    </>
                  ) : (
                    <>
                      {c.review.submit}
                      <Mail />
                    </>
                  )
                ) : (
                  <>
                    {c.continue[step]}
                    <ArrowRight />
                  </>
                )}
              </button>
            </div>
            {step === 5 && (
              <p className={styles.commitment}>
                <ShieldCheck />
                {c.review.reassurance}
              </p>
            )}
          </form>
        </section>

        {ConsultationPanel()}
      </div>

      {ConsultationTrust()}
      {ConsultationFaq()}
    </div>
  );

  function StepHeader({ title, hint }: { title: string; hint: string }) {
    return (
      <header className={styles.stepHeader}>
        <p>{step < 5 ? c.stepLabel(step + 1) : c.reviewLabel}</p>
        <h2 ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        <span>{hint}</span>
      </header>
    );
  }

  function LearningNeedStep() {
    const goals = availableGoals(values.subject);
    return (
      <>
        <StepHeader title={c.learning.title} hint={c.learning.hint} />
        <ChoiceGroup legend={c.learning.subject} error={errors.subject}>
          <div className={styles.subjectGrid}>
            {subjectKeys.map((subject) => (
              <ChoiceCard
                key={subject}
                name="subject"
                value={subject}
                checked={values.subject === subject}
                onChange={() => chooseSubject(subject)}
              >
                {c.learning.subjects[subject]}
              </ChoiceCard>
            ))}
          </div>
        </ChoiceGroup>
        <ChoiceGroup legend={c.learning.goal} error={errors.learningGoals}>
          <div className={styles.chipGrid}>
            {goals.map((goal) => (
              <CheckChip
                key={goal}
                name="goal"
                checked={values.learningGoals.includes(goal)}
                onChange={() => update("learningGoals", toggleValue(values.learningGoals, goal))}
              >
                {c.learning.goals[goal]}
              </CheckChip>
            ))}
          </div>
        </ChoiceGroup>
      </>
    );
  }

  function LearnerLevelStep() {
    const levels =
      values.subject === "mathematics"
        ? c.learner.mathLevels
        : values.subject === "armenian"
          ? c.learner.armenianLevels
          : c.learner.generalLevels;
    return (
      <>
        <StepHeader title={c.learner.title} hint={c.learner.hint} />
        <Field label={c.learner.grade} error={errors.gradeOrCourse} htmlFor="grade-course">
          <select
            id="grade-course"
            value={values.gradeOrCourse}
            onChange={(event) => update("gradeOrCourse", event.target.value)}
            aria-invalid={Boolean(errors.gradeOrCourse)}
          >
            <option value="">{c.learner.select}</option>
            {levels.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </Field>
        <Field label={c.learner.currentLevel} htmlFor="current-level">
          <select
            id="current-level"
            value={values.currentLevel}
            onChange={(event) => update("currentLevel", event.target.value)}
          >
            <option value="">{c.learner.select}</option>
            {c.learner.currentLevels.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </Field>
        <Field label={c.learner.challenge} htmlFor="current-challenge">
          <textarea
            id="current-challenge"
            value={values.currentChallenge}
            onChange={(event) => update("currentChallenge", event.target.value)}
            maxLength={120}
            placeholder={c.learner.challengePlaceholder}
          />
        </Field>
      </>
    );
  }

  function LessonPreferenceStep() {
    const formats = Object.entries(c.preference.formats) as [LessonFormat, string][];
    return (
      <>
        <StepHeader title={c.preference.title} hint={c.preference.hint} />
        <ChoiceGroup legend={c.preference.format} error={errors.lessonPreference}>
          <div className={styles.threeGrid}>
            {formats.map(([format, label]) => (
              <ChoiceCard
                key={format}
                name="lessonPreference"
                value={format}
                checked={values.lessonPreference === format}
                onChange={() => update("lessonPreference", format)}
              >
                {label}
              </ChoiceCard>
            ))}
          </div>
        </ChoiceGroup>
        {(values.lessonPreference === "group" || values.subject === "group-lessons") && (
          <p className={styles.contextNote}>
            <BookOpenCheck />
            {c.preference.groupNote}
          </p>
        )}
        <ChoiceGroup legend={c.preference.start} error={errors.desiredStart}>
          <div className={styles.chipGrid}>
            {c.preference.starts.map((item) => (
              <ChoiceCard
                compact
                key={item}
                name="desiredStart"
                value={item}
                checked={values.desiredStart === item}
                onChange={() => update("desiredStart", item)}
              >
                {item}
              </ChoiceCard>
            ))}
          </div>
        </ChoiceGroup>
      </>
    );
  }

  function ScheduleStep() {
    return (
      <>
        <StepHeader title={c.schedule.title} hint={c.schedule.hint} />
        <Field
          label={c.schedule.timezone}
          hint={c.schedule.timezoneHint}
          error={errors.timezone}
          htmlFor="timezone"
        >
          <input
            id="timezone"
            value={values.timezone}
            onChange={(event) => update("timezone", event.target.value)}
            autoComplete="off"
            maxLength={80}
            aria-invalid={Boolean(errors.timezone)}
          />
        </Field>
        <ChoiceGroup legend={c.schedule.days} error={errors.preferredDays}>
          <div className={styles.dayGrid}>
            {c.schedule.dayOptions.map((day) => (
              <CheckChip
                key={day}
                name="preferredDays"
                checked={values.preferredDays.includes(day)}
                onChange={() => update("preferredDays", toggleValue(values.preferredDays, day))}
              >
                {day}
              </CheckChip>
            ))}
          </div>
        </ChoiceGroup>
        <ChoiceGroup legend={c.schedule.times} error={errors.preferredTimeRanges}>
          <div className={styles.chipGrid}>
            {c.schedule.timeOptions.map((time) => (
              <CheckChip
                key={time}
                name="preferredTimes"
                checked={values.preferredTimeRanges.includes(time)}
                onChange={() =>
                  update("preferredTimeRanges", toggleValue(values.preferredTimeRanges, time))
                }
              >
                {time}
              </CheckChip>
            ))}
          </div>
        </ChoiceGroup>
        <Field label={c.schedule.flexibility} htmlFor="schedule-flexibility">
          <select
            id="schedule-flexibility"
            value={values.scheduleFlexibility}
            onChange={(event) => update("scheduleFlexibility", event.target.value)}
          >
            <option value="">{c.learner.select}</option>
            {c.schedule.flexibilityOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <p className={styles.contextNote}>
          <Clock3 />
          {c.schedule.note}
        </p>
      </>
    );
  }

  function ParentContactStep() {
    const methods = Object.entries(c.contact.methods) as [ContactMethod, string][];
    return (
      <>
        <StepHeader title={c.contact.title} hint={c.contact.hint} />
        <div className={styles.twoGrid}>
          <Field label={c.contact.name} error={errors.parentName} htmlFor="parent-name">
            <input
              id="parent-name"
              value={values.parentName}
              onChange={(event) => update("parentName", event.target.value)}
              autoComplete="name"
              maxLength={120}
              aria-invalid={Boolean(errors.parentName)}
            />
          </Field>
          <Field label={c.contact.email} error={errors.email} htmlFor="parent-email">
            <input
              id="parent-email"
              type="email"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>
        </div>
        <Field label={c.contact.phone} htmlFor="parent-phone">
          <input
            id="parent-phone"
            type="tel"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            autoComplete="tel"
            inputMode="tel"
            maxLength={40}
          />
        </Field>
        <ChoiceGroup legend={c.contact.method} error={errors.preferredContactMethod}>
          <div className={styles.threeGrid}>
            {methods.map(([method, label]) => (
              <ChoiceCard
                compact
                key={method}
                name="contactMethod"
                value={method}
                checked={values.preferredContactMethod === method}
                onChange={() => update("preferredContactMethod", method)}
              >
                {label}
              </ChoiceCard>
            ))}
          </div>
        </ChoiceGroup>
        <details className={styles.notesDisclosure}>
          <summary>{c.contact.moreSummary}</summary>
          <Field label={c.contact.more} htmlFor="notes">
            <textarea
              id="notes"
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
              maxLength={120}
              placeholder={c.contact.notesPlaceholder}
            />
          </Field>
        </details>
        <div className={styles.consentBlock}>
          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={values.privacyAccepted}
              onChange={(event) => update("privacyAccepted", event.target.checked)}
              aria-invalid={Boolean(errors.privacyAccepted)}
            />
            <span>
              {c.contact.consentPrefix}{" "}
              <Link href={localHref(locale, "/privacy")}>{c.contact.privacy}</Link>.
            </span>
          </label>
          {errors.privacyAccepted && (
            <p className={styles.inlineError} role="alert">
              {errors.privacyAccepted}
            </p>
          )}
          <p>
            <LockKeyhole />
            {c.contact.reassurance}
          </p>
        </div>
      </>
    );
  }

  function ReviewStep() {
    const sections = [
      [c.review.subject, `${subjectLabel()} · ${goalLabels()}`, 0],
      [
        c.review.level,
        [values.gradeOrCourse, values.currentLevel].filter(Boolean).join(" · ") || c.review.missing,
        1,
      ],
      [c.review.format, [formatLabel(), values.desiredStart].filter(Boolean).join(" · "), 2],
      [c.review.schedule, `${scheduleLabel()} · ${values.timezone}`, 3],
      [
        c.review.contact,
        `${values.parentName} · ${values.preferredContactMethod === "email" ? values.email : values.preferredContactMethod === "phone" ? values.phone || values.email : values.email}`,
        4,
      ],
    ] as const;
    return (
      <>
        <StepHeader title={c.review.title} hint={c.review.hint} />
        <div className={styles.reviewList}>
          {sections.map(([label, body, target]) => (
            <section key={label}>
              <div>
                <span>{label}</span>
                <p>{body}</p>
              </div>
              <button type="button" onClick={() => setStep(target)}>
                {c.edit}
              </button>
            </section>
          ))}
        </div>
      </>
    );
  }

  function ConsultationProgress() {
    return (
      <nav
        className={styles.progress}
        aria-label={locale === "hy" ? "Ձևի ընթացք" : "Form progress"}
      >
        <div>
          <span>{step < 5 ? c.stepLabel(step + 1) : c.reviewLabel}</span>
          <strong>{c.steps[Math.min(step, 4)]}</strong>
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <i style={{ width: `${step === 5 ? 100 : ((step + 1) / 5) * 100}%` }} />
        </div>
        <ol>
          {c.steps.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={index < step ? styles.complete : index === step ? styles.current : ""}
            >
              <span>{index < step ? <Check /> : index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  function ConsultationPanel() {
    return (
      <aside className={styles.panel} aria-label={c.panel.title}>
        <p className={styles.panelEyebrow}>{c.panel.eyebrow}</p>
        <h2>{c.panel.title}</h2>
        <ol className={styles.nextSteps}>
          {c.panel.next.map(([title, body], index) => (
            <li key={title}>
              <span>{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.liveSummary}>
          <h3>{c.panel.summary}</h3>
          <dl>
            {c.panel.labels.map((label, index) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={summary[index] === c.review.missing ? styles.empty : ""}>
                  {summary[index]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <ul className={styles.trustList}>
          {c.panel.trust.map((item) => (
            <li key={item}>
              <CheckCircle2 />
              {item}
            </li>
          ))}
        </ul>
        <p className={styles.privacyNote}>
          <LockKeyhole />
          {c.panel.privacy}
        </p>
      </aside>
    );
  }

  function ConsultationTrust() {
    return (
      <section className={styles.trustSection}>
        <div className={styles.shell}>
          <p className={styles.eyebrow}>{c.trustSection.eyebrow}</p>
          <h2>{c.trustSection.title}</h2>
          <div>
            {c.trustSection.items.map(([title, body], index) => (
              <article key={title}>
                <span>{index === 0 ? <Mail /> : index === 1 ? <ShieldCheck /> : <Clock3 />}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function ConsultationFaq() {
    return (
      <section className={styles.faqSection}>
        <div className={styles.shell}>
          <p className={styles.eyebrow}>{c.faq.eyebrow}</p>
          <h2>{c.faq.title}</h2>
          <div>
            {c.faq.items.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    );
  }
}

function ChoiceGroup({
  legend,
  error,
  children,
}: {
  legend: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.choiceGroup}>
      <legend>{legend}</legend>
      {children}
      {error && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  children,
  compact = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <label
      className={`${styles.choiceCard} ${checked ? styles.selected : ""} ${compact ? styles.compact : ""}`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span>{children}</span>
      <i aria-hidden="true">{checked && <Check />}</i>
    </label>
  );
}

function CheckChip({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className={`${styles.checkChip} ${checked ? styles.selected : ""}`}>
      <input type="checkbox" name={name} checked={checked} onChange={onChange} />
      <i aria-hidden="true">{checked && <Check />}</i>
      <span>{children}</span>
    </label>
  );
}

function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
      {error && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ConsultationSuccess({
  locale,
  values,
  summary,
}: {
  locale: Locale;
  values: ConsultationRequest;
  summary: string[];
}) {
  const c = consultationContent(locale);
  const curriculumPath =
    values.subject === "mathematics"
      ? "/mathematics"
      : values.subject === "armenian"
        ? "/armenian-language-heritage"
        : values.subject === "group-lessons"
          ? "/group-lessons"
          : "/home";
  const contactMethod = values.preferredContactMethod
    ? c.contact.methods[values.preferredContactMethod]
    : c.review.missing;
  return (
    <section className={`${styles.successPage} ${styles.shell}`}>
      <div className={styles.successMark}>
        <CircleCheckBig />
      </div>
      <p className={styles.eyebrow}>{c.success.eyebrow}</p>
      <h1>{c.success.title}</h1>
      <p className={styles.successLede}>{c.success.body}</p>
      <div className={styles.successGrid}>
        <section>
          <h2>{c.panel.summary}</h2>
          <dl>
            {c.panel.labels.map((label, index) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{summary[index]}</dd>
              </div>
            ))}
            <div>
              <dt>{c.review.contact}</dt>
              <dd>{contactMethod}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h2>{c.success.nextTitle}</h2>
          <ol>
            {c.success.next.map((item, index) => (
              <li key={item}>
                <span>{index + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </section>
      </div>
      <nav className={styles.successActions}>
        <Link className={styles.continueButton} href={localHref(locale, curriculumPath)}>
          {c.success.explore}
          <ArrowRight />
        </Link>
        <Link className={styles.textLink} href={localHref(locale, "/how-it-works")}>
          {c.success.how}
        </Link>
        <Link className={styles.textLink} href={localHref(locale, "/home")}>
          {c.success.home}
        </Link>
      </nav>
    </section>
  );
}
