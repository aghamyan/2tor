"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { activateStudentAction } from "../../app/(app)/consent/actions";
import { initialConsentActionState } from "../../app/(app)/consent/action-state";
import { ActionFeedback } from "./action-feedback";
import styles from "./consent.module.css";

export function ActivatePanel({ studentProfileId }: { studentProfileId: string }) {
  const t = useTranslations("consent.studentScreen");
  const [state, formAction, pending] = useActionState(
    activateStudentAction,
    initialConsentActionState,
  );

  return (
    <section className={styles.panel} aria-labelledby="activate-title">
      <h2 className={styles.sectionTitle} id="activate-title">
        {t("activateTitle")}
      </h2>
      <p className={styles.sectionIntro}>{t("activateIntro")}</p>
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="studentProfileId" value={studentProfileId} />
        <div className={styles.formActions}>
          <button className={styles.button} disabled={pending} type="submit">
            {pending ? t("activating") : t("activate")}
          </button>
        </div>
        <ActionFeedback state={state} />
      </form>
    </section>
  );
}
