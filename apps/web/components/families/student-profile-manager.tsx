"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { initialFamilyActionState } from "../../app/(app)/families/action-state";
import {
  saveInterestsAction,
  savePreferencesAction,
  unlinkStudentAction,
} from "../../app/(app)/families/actions";
import type { StudentFamilyDetail } from "../../../../packages/domain/families/models";
import { ActionFeedback } from "./action-feedback";
import styles from "./families.module.css";
import { StudentForm } from "./student-form";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "•"
  );
}

export function StudentProfileManager({ student }: { student: StudentFamilyDetail }) {
  const t = useTranslations("families.studentProfile");
  const [interestState, interestAction, interestPending] = useActionState(
    saveInterestsAction,
    initialFamilyActionState,
  );
  const [preferenceState, preferenceAction, preferencePending] = useActionState(
    savePreferencesAction,
    initialFamilyActionState,
  );
  const [unlinkState, unlinkAction, unlinkPending] = useActionState(
    unlinkStudentAction,
    initialFamilyActionState,
  );

  return (
    <div className={styles.shell}>
      <div className={styles.backRow}>
        <Link className={styles.secondaryLink} href="/families">
          {t("back")}
        </Link>
      </div>
      <header className={styles.profileHeader}>
        <span className={styles.profileMark} aria-hidden="true">
          {initials(student.preferredName)}
        </span>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.profileTitle}>{student.preferredName}</h1>
          <p className={styles.quiet}>{t("account", { username: student.username })}</p>
        </div>
      </header>

      <div className={styles.profileSections}>
        <section className={styles.panel} aria-labelledby="student-information">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="student-information">
                {t("informationTitle")}
              </h2>
              <p className={styles.sectionIntro}>{t("informationIntro")}</p>
            </div>
          </div>
          <StudentForm student={student} />
        </section>

        <section className={styles.panel} aria-labelledby="student-interests">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="student-interests">
                {t("interestsTitle")}
              </h2>
              <p className={styles.sectionIntro}>{t("interestsIntro")}</p>
            </div>
          </div>
          <form action={interestAction} className={styles.form}>
            <input type="hidden" name="studentProfileId" value={student.id} />
            <div className={styles.field}>
              <label className={styles.label} htmlFor="student-interests-value">
                {t("interestsLabel")}
              </label>
              <textarea
                className={styles.textarea}
                id="student-interests-value"
                name="interests"
                defaultValue={student.interests.join(", ")}
              />
              <p className={styles.hint}>{t("interestsHint")}</p>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="interests-reason">
                {t("reason")}
              </label>
              <input
                className={styles.input}
                id="interests-reason"
                name="reason"
                placeholder={t("reasonPlaceholder")}
                required
              />
            </div>
            <div className={styles.formActions}>
              <button className={styles.button} disabled={interestPending} type="submit">
                {interestPending ? t("saving") : t("saveInterests")}
              </button>
            </div>
            <ActionFeedback state={interestState} />
          </form>
        </section>

        <section className={styles.panel} aria-labelledby="student-preferences">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="student-preferences">
                {t("preferencesTitle")}
              </h2>
              <p className={styles.sectionIntro}>{t("preferencesIntro")}</p>
            </div>
          </div>
          <form action={preferenceAction} className={styles.form}>
            <input type="hidden" name="studentProfileId" value={student.id} />
            <div className={styles.field}>
              <label className={styles.label} htmlFor="lesson-style">
                {t("lessonStyle")}
              </label>
              <textarea
                className={styles.textarea}
                id="lesson-style"
                name="preferredLessonStyle"
                defaultValue={student.preferences?.preferredLessonStyle ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="availability-notes">
                {t("availability")}
              </label>
              <textarea
                className={styles.textarea}
                id="availability-notes"
                name="availabilityNotes"
                defaultValue={student.preferences?.availabilityNotes ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="learning-goals">
                {t("goals")}
              </label>
              <textarea
                className={styles.textarea}
                id="learning-goals"
                name="notes"
                defaultValue={student.preferences?.notes ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="preferences-reason">
                {t("reason")}
              </label>
              <input
                className={styles.input}
                id="preferences-reason"
                name="reason"
                placeholder={t("reasonPlaceholder")}
                required
              />
            </div>
            <div className={styles.formActions}>
              <button className={styles.button} disabled={preferencePending} type="submit">
                {preferencePending ? t("saving") : t("savePreferences")}
              </button>
            </div>
            <ActionFeedback state={preferenceState} />
          </form>
        </section>

        <section className={styles.panel} aria-labelledby="family-link">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="family-link">
                {t("linkTitle")}
              </h2>
              <p className={styles.sectionIntro}>{t("linkIntro")}</p>
            </div>
          </div>
          <form action={unlinkAction} className={styles.form}>
            <input type="hidden" name="studentProfileId" value={student.id} />
            <input type="hidden" name="parentProfileId" value={student.parentProfileId} />
            <div className={styles.field}>
              <label className={styles.label} htmlFor="unlink-reason">
                {t("reason")}
              </label>
              <input
                className={styles.input}
                id="unlink-reason"
                name="reason"
                placeholder={t("unlinkReasonPlaceholder")}
                required
              />
            </div>
            <div className={styles.formActions}>
              <button className={styles.dangerButton} disabled={unlinkPending} type="submit">
                {unlinkPending ? t("unlinking") : t("unlink")}
              </button>
            </div>
            <ActionFeedback state={unlinkState} />
          </form>
        </section>
      </div>
    </div>
  );
}
