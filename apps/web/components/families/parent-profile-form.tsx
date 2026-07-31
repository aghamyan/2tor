"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { initialFamilyActionState } from "../../app/(app)/families/action-state";
import { saveParentProfileAction } from "../../app/(app)/families/actions";
import type { ParentProfileRecord } from "../../../../packages/domain/families/models";
import { ActionFeedback, FieldError } from "./action-feedback";
import styles from "./families.module.css";

export function ParentProfileForm({ parent }: { parent: ParentProfileRecord | null }) {
  const t = useTranslations("families.parentForm");
  const [state, action, pending] = useActionState(
    saveParentProfileAction,
    initialFamilyActionState,
  );

  return (
    <form action={action} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="parent-full-name">
          {t("fullName")}
        </label>
        <input
          className={styles.input}
          id="parent-full-name"
          name="fullName"
          defaultValue={parent?.fullName ?? ""}
          autoComplete="name"
          required
        />
        <FieldError state={state} name="fullName" />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="parent-phone">
          {t("phone")}
        </label>
        <input
          className={styles.input}
          id="parent-phone"
          name="phone"
          type="tel"
          defaultValue={parent?.phone ?? ""}
          autoComplete="tel"
        />
        <FieldError state={state} name="phone" />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="parent-content-language">
          {t("contentLanguage")}
        </label>
        <select
          className={styles.select}
          id="parent-content-language"
          name="contentLanguagePreference"
          defaultValue={parent?.contentLanguagePreference ?? ""}
        >
          <option value="">{t("noPreference")}</option>
          <option value="en">{t("english")}</option>
          <option value="hy">{t("armenian")}</option>
        </select>
      </div>
      <div className={styles.formActions}>
        <button className={styles.button} disabled={pending} type="submit">
          {pending ? t("saving") : parent ? t("save") : t("create")}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
