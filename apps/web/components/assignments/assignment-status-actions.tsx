"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import type { AssignmentStatus } from "../../../../packages/domain/assignments/models";
import { setAssignmentStatusAction } from "../../app/(app)/assignments/actions";
import { initialAssignmentActionState } from "../../app/(app)/assignments/action-state";
import { ActionFeedback } from "./action-feedback";
import styles from "./assignments.module.css";

export function AssignmentStatusActions({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: AssignmentStatus;
}) {
  const t = useTranslations("assignments.detail");
  const [state, action, pending] = useActionState(
    setAssignmentStatusAction,
    initialAssignmentActionState,
  );
  if (status === "closed") return null;
  const nextStatus = status === "draft" ? "published" : "closed";

  return (
    <div>
      <ActionFeedback state={state} />
      <form action={action} className={styles.actionsRow}>
        <input name="assignmentId" type="hidden" value={assignmentId} />
        <input name="status" type="hidden" value={nextStatus} />
        <button
          className={
            status === "draft" ? styles.button : `${styles.button} ${styles.buttonSecondary}`
          }
          disabled={pending}
          type="submit"
        >
          {status === "draft" ? t("publishAssignment") : t("closeAssignment")}
        </button>
      </form>
      {status === "draft" ? <p className={styles.hint}>{t("draftHint")}</p> : null}
    </div>
  );
}
