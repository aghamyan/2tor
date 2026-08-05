"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CircleCheck, Clock3, Send } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Locale } from "@app/i18n/config";
import type { ParentsCopy } from "./parents-content";
import styles from "./parents-page.module.css";

function localHref(locale: Locale, path: string) {
  return `/${locale}${path}`;
}

export function ParentDashboardTabs({
  tabs,
  ariaLabel,
}: {
  tabs: ParentsCopy["visibility"]["tabs"];
  ariaLabel: string;
}) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panel = tabs[active];
  if (!panel) return null;

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={styles.walkthrough}>
      <div className={styles.tabList} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab, index) => (
          <button
            aria-controls={`parent-panel-${tab.id}`}
            aria-selected={active === index}
            className={styles.tabButton}
            id={`parent-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActive(index)}
            onKeyDown={(event) => move(event, index)}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            role="tab"
            tabIndex={active === index ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`parent-tab-${panel.id}`}
        className={styles.tabPanel}
        id={`parent-panel-${panel.id}`}
        role="tabpanel"
        tabIndex={0}
      >
        <div className={styles.tabPanelCopy}>
          <span className={styles.liveDot} aria-hidden="true" />
          <h3>{panel.title}</h3>
          <p>{panel.body}</p>
        </div>
        <ul className={styles.previewRows}>
          {panel.items.map((item, index) => (
            <li key={item}>
              <span className={styles.previewRowIcon} aria-hidden="true">
                {index + 1}
              </span>
              <span>{item}</span>
              <Check size={17} aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type ConsultationValues = {
  learnerAgeBand: string;
  subject: string;
  challenge: string;
  goal: string;
  preference: string;
  timezone: string;
  days: string;
  time: string;
  parentName: string;
  email: string;
  phone: string;
  privacyConsent: boolean;
};

const initialValues: ConsultationValues = {
  learnerAgeBand: "",
  subject: "",
  challenge: "",
  goal: "",
  preference: "",
  timezone: "Asia/Yerevan",
  days: "",
  time: "",
  parentName: "",
  email: "",
  phone: "",
  privacyConsent: false,
};

export function ParentConsultationFlow({
  copy,
  locale,
}: {
  copy: ParentsCopy["form"];
  locale: Locale;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ConsultationValues>(initialValues);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [validation, setValidation] = useState("");
  const firstFieldRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null);
  const total = 5;

  function update<K extends keyof ConsultationValues>(key: K, value: ConsultationValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidation("");
  }

  function validForStep() {
    if (step === 0) return Boolean(values.learnerAgeBand && values.subject && values.challenge);
    if (step === 1) return Boolean(values.goal);
    if (step === 2) return Boolean(values.preference);
    if (step === 3) return Boolean(values.timezone && values.days && values.time);
    return Boolean(values.parentName && values.email && values.privacyConsent);
  }

  function advance() {
    if (!validForStep()) {
      setValidation(copy.required);
      return;
    }
    setStep((current) => Math.min(current + 1, total - 1));
    setTimeout(() => firstFieldRef.current?.focus(), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validForStep()) {
      setValidation(copy.required);
      return;
    }
    setStatus("sending");
    setValidation("");
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "consultation",
        parentName: values.parentName,
        email: values.email,
        phone: values.phone,
        learnerAgeBand: values.learnerAgeBand,
        interest: values.subject,
        message: [
          `${copy.challenge}: ${values.challenge}`,
          `${copy.goal}: ${values.goal}`,
          `${copy.preference}: ${values.preference}`,
          `${copy.schedule}: ${values.days}, ${values.time} (${values.timezone})`,
        ].join("\n"),
        locale,
        privacyConsent: values.privacyConsent,
        company: "",
      }),
    });
    setStatus(response.ok ? "sent" : "error");
  }

  if (status === "sent") {
    return (
      <div className={styles.consultationSuccess} role="status">
        <span aria-hidden="true">
          <CircleCheck />
        </span>
        <h3>{copy.success}</h3>
        <p>{copy.successBody}</p>
      </div>
    );
  }

  return (
    <form className={styles.consultationForm} onSubmit={submit} noValidate>
      <div className={styles.formProgressRow}>
        <p>
          {copy.progress.replace("{current}", String(step + 1)).replace("{total}", String(total))}
        </p>
        <div className={styles.formProgress} aria-hidden="true">
          <span style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>

      <fieldset className={styles.formStep} hidden={step !== 0}>
        <legend>{copy.learner}</legend>
        <p>{copy.learnerIntro}</p>
        <label>
          <span>{copy.grade}</span>
          <select
            value={values.learnerAgeBand}
            onChange={(event) => update("learnerAgeBand", event.target.value)}
            ref={step === 0 ? (firstFieldRef as React.RefObject<HTMLSelectElement>) : undefined}
          >
            {copy.gradeOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.subject}</span>
          <input
            value={values.subject}
            onChange={(event) => update("subject", event.target.value)}
            placeholder={copy.subjectPlaceholder}
            maxLength={160}
          />
        </label>
        <label>
          <span>{copy.challenge}</span>
          <textarea
            value={values.challenge}
            onChange={(event) => update("challenge", event.target.value)}
            placeholder={copy.challengePlaceholder}
            maxLength={500}
          />
        </label>
      </fieldset>

      <fieldset className={styles.formStep} hidden={step !== 1}>
        <legend>{copy.goal}</legend>
        <p>{copy.goalIntro}</p>
        <div className={styles.choiceGrid}>
          {copy.goals.map((goal) => (
            <label className={styles.choice} key={goal}>
              <input
                type="radio"
                name="goal"
                value={goal}
                checked={values.goal === goal}
                onChange={() => update("goal", goal)}
              />
              <span>{goal}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.formStep} hidden={step !== 2}>
        <legend>{copy.preference}</legend>
        <p>{copy.preferenceIntro}</p>
        <div className={styles.choiceGrid}>
          {copy.preferences.map((preference) => (
            <label className={styles.choice} key={preference}>
              <input
                type="radio"
                name="preference"
                value={preference}
                checked={values.preference === preference}
                onChange={() => update("preference", preference)}
              />
              <span>{preference}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.formStep} hidden={step !== 3}>
        <legend>{copy.schedule}</legend>
        <p>{copy.scheduleIntro}</p>
        <label>
          <span>{copy.timezone}</span>
          <input
            value={values.timezone}
            onChange={(event) => update("timezone", event.target.value)}
          />
        </label>
        <label>
          <span>{copy.days}</span>
          <input
            value={values.days}
            onChange={(event) => update("days", event.target.value)}
            placeholder={copy.daysPlaceholder}
          />
        </label>
        <label>
          <span>{copy.time}</span>
          <input
            value={values.time}
            onChange={(event) => update("time", event.target.value)}
            placeholder={copy.timePlaceholder}
          />
        </label>
      </fieldset>

      <fieldset className={styles.formStep} hidden={step !== 4}>
        <legend>{copy.contact}</legend>
        <p>{copy.contactIntro}</p>
        <label>
          <span>{copy.name}</span>
          <input
            autoComplete="name"
            value={values.parentName}
            onChange={(event) => update("parentName", event.target.value)}
            maxLength={120}
          />
        </label>
        <label>
          <span>{copy.email}</span>
          <input
            autoComplete="email"
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            maxLength={254}
          />
        </label>
        <label>
          <span>{copy.phone}</span>
          <input
            autoComplete="tel"
            type="tel"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            maxLength={40}
          />
        </label>
        <label className={styles.privacyChoice}>
          <input
            type="checkbox"
            checked={values.privacyConsent}
            onChange={(event) => update("privacyConsent", event.target.checked)}
          />
          <span>
            {copy.consentPrefix} <Link href={localHref(locale, "/privacy")}>{copy.privacy}</Link>.
          </span>
        </label>
      </fieldset>

      <div className={styles.formAnnouncement} aria-live="polite">
        {validation && <p className={styles.formError}>{validation}</p>}
        {status === "error" && <p className={styles.formError}>{copy.error}</p>}
      </div>
      <div className={styles.formActions}>
        {step > 0 && (
          <button
            className={styles.formBack}
            type="button"
            onClick={() => {
              setStep((current) => current - 1);
              setValidation("");
            }}
          >
            <ChevronLeft size={18} /> {copy.back}
          </button>
        )}
        {step < total - 1 ? (
          <button className={styles.formNext} type="button" onClick={advance}>
            {copy.next} <ChevronRight size={18} />
          </button>
        ) : (
          <button className={styles.formSubmit} type="submit" disabled={status === "sending"}>
            {status === "sending" ? <Clock3 size={18} /> : <Send size={18} />}
            {status === "sending" ? copy.sending : copy.submit}
          </button>
        )}
      </div>
      <p className={styles.formNote}>{copy.note}</p>
    </form>
  );
}
