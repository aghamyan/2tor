"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { resolveReportAction } from "../../app/(app)/discussions/actions";
import { initialDiscussionActionState } from "../../app/(app)/discussions/action-state";
import { DiscussionActionFeedback } from "./discussion-action-feedback";
import styles from "./moderation.module.css";

export function ResolveReportForm({ reportId }: { reportId: string }) {
  const t = useTranslations("discussions");
  const action = resolveReportAction.bind(null, reportId);
  const [state, formAction, isPending] = useActionState(action, initialDiscussionActionState);

  return (
    <form action={formAction} className={styles.resolveForm}>
      <div className={styles.resolveFields}>
        <label className={styles.fieldLabel}>
          {t("moderation.statusLabel")}
          <select name="status" defaultValue="resolved" required>
            <option value="reviewing">{t("moderation.reportStatus.reviewing")}</option>
            <option value="resolved">{t("moderation.reportStatus.resolved")}</option>
            <option value="dismissed">{t("moderation.reportStatus.dismissed")}</option>
            <option value="escalated">{t("moderation.reportStatus.escalated")}</option>
          </select>
        </label>
        <label className={styles.fieldLabel}>
          {t("moderation.severityLabel")}
          <select name="severity" defaultValue="">
            <option value="">{t("moderation.severityNone")}</option>
            <option value="low">{t("moderation.severity.low")}</option>
            <option value="medium">{t("moderation.severity.medium")}</option>
            <option value="high">{t("moderation.severity.high")}</option>
            <option value="critical">{t("moderation.severity.critical")}</option>
          </select>
        </label>
      </div>
      <label className={styles.fieldLabel}>
        {t("moderation.resolutionNoteLabel")}
        <textarea
          name="resolutionNote"
          rows={2}
          required
          minLength={1}
          placeholder={t("moderation.resolutionNotePlaceholder")}
        />
      </label>
      <DiscussionActionFeedback state={state} />
      <button type="submit" className={styles.resolveButton} disabled={isPending}>
        {isPending ? t("moderation.saving") : t("moderation.resolveButton")}
      </button>
    </form>
  );
}
