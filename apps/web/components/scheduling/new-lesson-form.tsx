"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import {
  createLessonSeriesAction,
  createOneTimeLessonAction,
} from "../../app/(app)/scheduling/actions";
import { initialSchedulingActionState } from "../../app/(app)/scheduling/action-state";
import { WEEKDAYS } from "../../../../packages/domain/scheduling/recurrence";
import { ActionFeedback, FieldError } from "./action-feedback";
import styles from "./scheduling.module.css";

export function NewLessonForm() {
  const t = useTranslations("scheduling.newLesson");
  const [recurring, setRecurring] = useState(false);
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
                {t("assignmentId")}
              </label>
              <input
                className={styles.input}
                id="assignment-id"
                name="tutorStudentAssignmentId"
                required
              />
              <FieldError state={state} name="tutorStudentAssignmentId" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="subject-id">
                {t("subjectId")}
              </label>
              <input className={styles.input} id="subject-id" name="subjectId" required />
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
            <>
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
                  <label className={styles.label} htmlFor="series-hour">
                    {t("hour")}
                  </label>
                  <input
                    className={styles.input}
                    id="series-hour"
                    name="hour"
                    type="number"
                    min={0}
                    max={23}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="series-minute">
                    {t("minute")}
                  </label>
                  <input
                    className={styles.input}
                    id="series-minute"
                    name="minute"
                    type="number"
                    min={0}
                    max={59}
                    defaultValue={0}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="series-timezone">
                    {t("timezone")}
                  </label>
                  <input
                    className={styles.input}
                    id="series-timezone"
                    name="timezone"
                    placeholder="America/Los_Angeles"
                    required
                  />
                  <p className={styles.hint}>{t("timezoneHint")}</p>
                </div>
              </div>
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
            </>
          ) : (
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
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="one-time-timezone">
                  {t("timezone")}
                </label>
                <input
                  className={styles.input}
                  id="one-time-timezone"
                  name="timezoneAtBooking"
                  placeholder="America/Los_Angeles"
                  required
                />
              </div>
              <div className={styles.checkboxRow}>
                <input id="is-trial" type="checkbox" name="isTrial" />
                <label htmlFor="is-trial">{t("isTrial")}</label>
              </div>
            </div>
          )}

          <button className={styles.button} type="submit" disabled={pending}>
            {recurring ? t("createSeries") : t("createLesson")}
          </button>
        </form>
      </section>
    </div>
  );
}
