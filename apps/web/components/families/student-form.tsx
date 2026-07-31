"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { initialFamilyActionState } from "../../app/(app)/families/action-state";
import { correctStudentAction, createStudentAction } from "../../app/(app)/families/actions";
import type { StudentFamilyDetail } from "../../../../packages/domain/families/models";
import { ActionFeedback, FieldError } from "./action-feedback";
import styles from "./families.module.css";

export function StudentForm({ student = null }: { student?: StudentFamilyDetail | null }) {
  const t = useTranslations("families.studentForm");
  const [adult, setAdult] = useState(student?.isAdultLearner ?? false);
  const [state, action, pending] = useActionState(
    student ? correctStudentAction : createStudentAction,
    initialFamilyActionState,
  );

  return (
    <form action={action} className={styles.form}>
      {student ? <input type="hidden" name="studentProfileId" value={student.id} /> : null}
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="student-preferred-name">
            {t("preferredName")}
          </label>
          <input
            className={styles.input}
            id="student-preferred-name"
            name="preferredName"
            defaultValue={student?.preferredName ?? ""}
            autoComplete="off"
            required
          />
          <FieldError state={state} name="preferredName" />
        </div>

        {!student ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="student-username">
              {t("username")}
            </label>
            <input
              className={styles.input}
              id="student-username"
              name="username"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <p className={styles.hint}>{t("usernameHint")}</p>
            <FieldError state={state} name="username" />
          </div>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="student-grade">
            {t("grade")}
          </label>
          <input
            className={styles.input}
            id="student-grade"
            name="gradeLevel"
            defaultValue={student?.gradeLevel ?? ""}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="student-state">
            {t("state")}
          </label>
          <input
            className={styles.input}
            id="student-state"
            name="usState"
            defaultValue={student?.usState ?? ""}
            autoComplete="off"
          />
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.checkRow}>
            <input
              name="isAdultLearner"
              type="checkbox"
              defaultChecked={adult}
              onChange={(event) => setAdult(event.currentTarget.checked)}
            />
            <span>
              <span className={styles.label}>{t("adultLearner")}</span>
              <span className={styles.hint}>{t("adultLearnerHint")}</span>
            </span>
          </label>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="student-birth-month">
            {t("birthMonth")}
          </label>
          <input
            className={styles.input}
            id="student-birth-month"
            name="dobYearMonth"
            type="month"
            defaultValue={student?.dobYearMonth ?? ""}
            disabled={adult}
          />
          <p className={styles.hint}>{t("birthMonthHint")}</p>
          <FieldError state={state} name="dobYearMonth" />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="student-age-band">
            {t("ageBand")}
          </label>
          <select
            className={styles.select}
            id="student-age-band"
            name="ageBand"
            defaultValue={student?.ageBand ?? ""}
            disabled={adult}
          >
            <option value="">{t("chooseAgeBand")}</option>
            <option value="under-8">{t("ageBands.under8")}</option>
            <option value="8-10">{t("ageBands.8to10")}</option>
            <option value="11-12">{t("ageBands.11to12")}</option>
            <option value="13-15">{t("ageBands.13to15")}</option>
            <option value="16-17">{t("ageBands.16to17")}</option>
          </select>
          <p className={styles.hint}>{t("ageBandHint")}</p>
          <FieldError state={state} name="ageBand" />
        </div>

        {!student ? (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="student-timezone">
                {t("timezone")}
              </label>
              <input
                className={styles.input}
                id="student-timezone"
                name="primaryTimezone"
                defaultValue="Asia/Yerevan"
                autoComplete="off"
                required
              />
              <p className={styles.hint}>{t("timezoneHint")}</p>
              <FieldError state={state} name="primaryTimezone" />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="student-locale">
                {t("interfaceLanguage")}
              </label>
              <select className={styles.select} id="student-locale" name="locale" defaultValue="en">
                <option value="en">{t("english")}</option>
                <option value="hy">{t("armenian")}</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="student-relationship">
                {t("relationship")}
              </label>
              <select
                className={styles.select}
                id="student-relationship"
                name="relationship"
                defaultValue="parent"
              >
                <option value="parent">{t("parent")}</option>
                <option value="guardian">{t("guardian")}</option>
              </select>
            </div>
          </>
        ) : (
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label} htmlFor="student-correction-reason">
              {t("correctionReason")}
            </label>
            <input
              className={styles.input}
              id="student-correction-reason"
              name="reason"
              placeholder={t("correctionReasonPlaceholder")}
              required
            />
          </div>
        )}
      </div>

      <div className={styles.formActions}>
        <button className={styles.button} disabled={pending} type="submit">
          {pending ? t("saving") : student ? t("saveChanges") : t("createStudent")}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
