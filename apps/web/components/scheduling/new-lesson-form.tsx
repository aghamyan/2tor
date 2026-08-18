"use client";

import { Fragment, useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  createLessonSeriesAction,
  createOneTimeLessonAction,
} from "../../app/(app)/scheduling/actions";
import { initialSchedulingActionState } from "../../app/(app)/scheduling/action-state";
import type {
  SchedulableAssignmentOption,
  SubjectOption,
} from "../../../../packages/domain/scheduling/models";
import { WEEKDAYS } from "../../../../packages/domain/scheduling/recurrence";
import { ActionFeedback, FieldError } from "./action-feedback";
import { detectBrowserTimezone, getTimezoneOptions } from "./timezones";
import styles from "./scheduling.module.css";

function assignmentLabel(assignment: SchedulableAssignmentOption): string {
  return assignment.subjectName
    ? `${assignment.studentName} — ${assignment.subjectName}`
    : assignment.studentName;
}

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** A same-page confirmation of what "date + time + zone" resolves to, purely for catching typos
 * (wrong AM/PM, wrong day) before submit — not a substitute for the server's own
 * `zonedTimeToUtc` conversion, so it deliberately doesn't attempt DST-correct math itself. */
function formatResolvedPreview(
  dateValue: string,
  timeValue: string,
  timezone: string,
): string | null {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const asLocal = new Date(year, month - 1, day, hour, minute);
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(asLocal);
  return timezone ? `${formatted} · ${timezone.replace(/_/g, " ")}` : formatted;
}

export function NewLessonForm({
  assignments,
  subjects,
}: {
  assignments: SchedulableAssignmentOption[];
  subjects: SubjectOption[];
}) {
  const t = useTranslations("scheduling.newLesson");
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const [recurring, setRecurring] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  // Both start blank so the client's first hydration render matches the server-rendered HTML
  // exactly, then fill in post-mount. A `useState(() => typeof window === "undefined" ? "" : …)`
  // initializer looks SSR-safe but isn't: React only patches *state-driven* mismatches on
  // hydration, not plain DOM attributes like an <input min> or a <select>'s reflected value — it
  // logs a "won't be patched up" warning and leaves the server's blank value in the DOM forever.
  // Setting the real value from an effect is a normal post-hydration update, which does patch it.
  const [timezone, setTimezone] = useState("");
  const [todayStr, setTodayStr] = useState("");
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the browser timezone and today's local
       date are external, client-only values read after hydration (see comment above). */
    setTimezone(detectBrowserTimezone());
    setTodayStr(todayDateString());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const [oneTimeDate, setOneTimeDate] = useState("");
  const [oneTimeTime, setOneTimeTime] = useState("");
  const [seriesStartDate, setSeriesStartDate] = useState("");
  const [seriesTime, setSeriesTime] = useState("");
  const [oneTimeState, oneTimeAction, oneTimePending] = useActionState(
    createOneTimeLessonAction,
    initialSchedulingActionState,
  );
  const [seriesState, seriesAction, seriesPending] = useActionState(
    createLessonSeriesAction,
    initialSchedulingActionState,
  );

  const state = recurring ? seriesState : oneTimeState;
  const action = recurring ? seriesAction : oneTimeAction;
  const pending = recurring ? seriesPending : oneTimePending;
  const canSchedule = assignments.length > 0 && subjects.length > 0;

  function handleAssignmentChange(id: string) {
    setAssignmentId(id);
    const match = assignments.find((assignment) => assignment.id === id);
    if (match?.subjectId) setSubjectId(match.subjectId);
  }

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
        {assignments.length === 0 ? <p className={styles.hint}>{t("noAssignments")}</p> : null}
        {assignments.length > 0 && subjects.length === 0 ? (
          <p className={styles.hint}>{t("noSubjects")}</p>
        ) : null}

        <div className={styles.checkboxRow}>
          <input
            id="recurring-toggle"
            type="checkbox"
            checked={recurring}
            onChange={(event) => setRecurring(event.target.checked)}
          />
          <label htmlFor="recurring-toggle">{t("repeatsWeekly")}</label>
        </div>

        <ActionFeedback state={state} />

        <form action={action} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="assignment-id">
                {t("student")}
              </label>
              <select
                className={styles.select}
                id="assignment-id"
                name="tutorStudentAssignmentId"
                value={assignmentId}
                onChange={(event) => handleAssignmentChange(event.target.value)}
                required
              >
                <option value="" disabled>
                  {t("selectStudent")}
                </option>
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignmentLabel(assignment)}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="tutorStudentAssignmentId" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="subject-id">
                {t("subject")}
              </label>
              <select
                className={styles.select}
                id="subject-id"
                name="subjectId"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                required
              >
                <option value="" disabled>
                  {t("selectSubject")}
                </option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="subjectId" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="duration">
                {t("durationMinutes")}
              </label>
              <input
                className={styles.input}
                id="duration"
                name="durationMinutes"
                type="number"
                min={15}
                max={240}
                defaultValue={60}
                required
              />
            </div>
          </div>

          {recurring ? (
            // Explicit, distinct `key`s (not a bare `<>`) so React never tries to reconcile this
            // branch's inputs against the one-time branch's by position when `recurring` toggles
            // — a bare Fragment on both sides let a controlled input line up with an uncontrolled
            // one at the same index and get its `value` prop silently dropped mid-session.
            <Fragment key="recurring">
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="start-date">
                    {t("startDate")}
                  </label>
                  <input
                    className={styles.input}
                    id="start-date"
                    name="startDate"
                    type="date"
                    min={todayStr || undefined}
                    value={seriesStartDate}
                    onChange={(event) => setSeriesStartDate(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="end-date">
                    {t("endDate")}
                  </label>
                  <input className={styles.input} id="end-date" name="endDate" type="date" />
                  <p className={styles.hint}>{t("endDateHint")}</p>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="interval">
                    {t("interval")}
                  </label>
                  <input
                    className={styles.input}
                    id="interval"
                    name="interval"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={1}
                    required
                  />
                  <p className={styles.hint}>{t("intervalHint")}</p>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="series-time">
                    {t("time")}
                  </label>
                  <input
                    className={styles.input}
                    id="series-time"
                    name="seriesTime"
                    type="time"
                    value={seriesTime}
                    onChange={(event) => setSeriesTime(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="series-timezone">
                    {t("timezone")}
                  </label>
                  <select
                    className={styles.select}
                    id="series-timezone"
                    name="timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    required
                  >
                    <option value="" disabled>
                      {t("selectTimezone")}
                    </option>
                    {timezoneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {formatResolvedPreview(seriesStartDate, seriesTime, timezone) ? (
                <p className={styles.hint}>
                  {t("resolvedPreview", {
                    details: formatResolvedPreview(seriesStartDate, seriesTime, timezone) ?? "",
                  })}
                </p>
              ) : null}
              <fieldset className={styles.field}>
                <legend className={styles.label}>{t("weekdays")}</legend>
                <div className={styles.weekdayRow}>
                  {WEEKDAYS.map((day) => (
                    <label className={styles.weekdayOption} key={day}>
                      <input type="checkbox" name="byDay" value={day} />
                      {t(`weekday.${day}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </Fragment>
          ) : (
            <Fragment key="one-time">
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="one-time-date">
                    {t("date")}
                  </label>
                  <input
                    className={styles.input}
                    id="one-time-date"
                    name="date"
                    type="date"
                    min={todayStr || undefined}
                    value={oneTimeDate}
                    onChange={(event) => setOneTimeDate(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="one-time-time">
                    {t("time")}
                  </label>
                  <input
                    className={styles.input}
                    id="one-time-time"
                    name="time"
                    type="time"
                    value={oneTimeTime}
                    onChange={(event) => setOneTimeTime(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="one-time-timezone">
                    {t("timezone")}
                  </label>
                  <select
                    className={styles.select}
                    id="one-time-timezone"
                    name="timezoneAtBooking"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    required
                  >
                    <option value="" disabled>
                      {t("selectTimezone")}
                    </option>
                    {timezoneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {formatResolvedPreview(oneTimeDate, oneTimeTime, timezone) ? (
                <p className={styles.hint}>
                  {t("resolvedPreview", {
                    details: formatResolvedPreview(oneTimeDate, oneTimeTime, timezone) ?? "",
                  })}
                </p>
              ) : null}
              <div className={styles.checkboxRow}>
                <input id="is-trial" type="checkbox" name="isTrial" />
                <label htmlFor="is-trial">{t("isTrial")}</label>
              </div>
            </Fragment>
          )}

          <button className={styles.button} type="submit" disabled={pending || !canSchedule}>
            {recurring ? t("createSeries") : t("createLesson")}
          </button>
        </form>
      </section>
    </div>
  );
}
