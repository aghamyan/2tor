"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import styles from "./dashboard.module.css";

export function LessonFeedbackForm({
  lessonId,
  studentProfileId,
  studentName,
}: {
  lessonId: string;
  studentProfileId: string;
  studentName: string;
}) {
  const t = useTranslations("dashboards.learning.tutor.form");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error" | "noRecipient">("idle");

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const form = new FormData(event.currentTarget);
    const outcome = String(form.get("outcome"));
    const homework = String(form.get("homework")).trim() || t("noneAssigned");
    const topic = String(form.get("topic")).trim();
    const subtopic = String(form.get("subtopic")).trim();
    const visibleToParent = form.get("visibleToParent") === "on";
    const visibleToStudent = form.get("visibleToStudent") === "on";
    if (!visibleToParent && !visibleToStudent) {
      setState("noRecipient");
      return;
    }

    const response = await fetch("/api/academics/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lessonId,
        studentProfileId,
        topicsCovered: subtopic ? `${topic} · ${subtopic}` : topic,
        objectiveMet: outcome,
        assignmentCompletionStatus: "not_applicable",
        assignmentAccuracyNote: null,
        effortEngagementNote: String(form.get("engagement")).trim(),
        strengthsDemonstrated: String(form.get("strength")).trim(),
        skillsToImprove: String(form.get("improve")).trim(),
        nextLessonFocus: String(form.get("nextFocus")).trim(),
        assignedHomework: homework,
        parentActionNeeded: t("noParentAction"),
        studentActionNeeded: homework,
        milestoneProgressNote: t("progressReviewed"),
        tutorConfidence: outcome === "yes" ? "high" : outcome === "partly" ? "medium" : "low",
        freeTextComment: String(form.get("comment")).trim(),
        staffOnlyNote: null,
        visibleToParent,
        visibleToStudent,
        status: "published",
      }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }
    setState("saved");
    router.refresh();
  }

  return (
    <form className={styles.recapForm} onSubmit={publish}>
      <div className={styles.formIntro}>
        <span className={styles.formStep}>01</span>
        <div>
          <h3>{t("title", { name: studentName })}</h3>
          <p>{t("intro")}</p>
        </div>
      </div>

      <fieldset className={styles.outcomeFieldset}>
        <legend>{t("outcome")}</legend>
        <label>
          <input defaultChecked name="outcome" type="radio" value="yes" />
          <span>😊</span>
          {t("outcomes.great")}
        </label>
        <label>
          <input name="outcome" type="radio" value="partly" />
          <span>🙂</span>
          {t("outcomes.good")}
        </label>
        <label>
          <input name="outcome" type="radio" value="no" />
          <span>🧭</span>
          {t("outcomes.support")}
        </label>
      </fieldset>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>{t("topic")}</span>
          <input name="topic" placeholder={t("topicPlaceholder")} required />
        </label>
        <label className={styles.field}>
          <span>{t("subtopic")}</span>
          <input name="subtopic" placeholder={t("subtopicPlaceholder")} />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>{t("engagement")}</span>
          <textarea name="engagement" placeholder={t("engagementPlaceholder")} required rows={2} />
        </label>
        <label className={styles.field}>
          <span>{t("strength")}</span>
          <textarea name="strength" placeholder={t("strengthPlaceholder")} required rows={3} />
        </label>
        <label className={styles.field}>
          <span>{t("improve")}</span>
          <textarea name="improve" placeholder={t("improvePlaceholder")} required rows={3} />
        </label>
        <label className={styles.field}>
          <span>{t("nextFocus")}</span>
          <input name="nextFocus" placeholder={t("nextFocusPlaceholder")} required />
        </label>
        <label className={styles.field}>
          <span>{t("homework")}</span>
          <input name="homework" placeholder={t("homeworkPlaceholder")} />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>{t("comment")}</span>
          <textarea name="comment" placeholder={t("commentPlaceholder")} required rows={3} />
        </label>
      </div>

      <fieldset className={styles.outcomeFieldset}>
        <legend>{t("visibility")}</legend>
        <label>
          <input defaultChecked name="visibleToParent" type="checkbox" />
          {t("visibleToParent")}
        </label>
        <label>
          <input defaultChecked name="visibleToStudent" type="checkbox" />
          {t("visibleToStudent")}
        </label>
      </fieldset>

      <div className={styles.formFooter}>
        <p aria-live="polite">
          {state === "saving"
            ? t("saving")
            : state === "saved"
              ? t("saved")
              : state === "error"
                ? t("error")
                : state === "noRecipient"
                  ? t("noRecipient")
                  : t("visibilityHint")}
        </p>
        <button disabled={state === "saving"} type="submit">
          {state === "saving" ? t("savingButton") : t("publish")}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
