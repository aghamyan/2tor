"use client";

import { useActionState } from "react";

import type { DiscussionActionState } from "../../app/(app)/discussions/action-state";
import { initialDiscussionActionState } from "../../app/(app)/discussions/action-state";
import { DiscussionActionFeedback } from "./discussion-action-feedback";
import styles from "./feed.module.css";

/** A single-click server action with no form fields (accept, follow/unfollow, save/unsave, mark
 *  helpful) — wrapped so it gets a pending state and visible success/error feedback like any form. */
export function SimpleActionButton({
  action,
  label,
  pendingLabel,
  className,
  showFeedback = true,
}: {
  action: () => Promise<DiscussionActionState>;
  label: string;
  pendingLabel?: string;
  className?: string;
  showFeedback?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<DiscussionActionState, FormData>(
    () => action(),
    initialDiscussionActionState,
  );
  return (
    <form action={formAction}>
      <button type="submit" className={className ?? styles.searchButton} disabled={isPending}>
        {isPending && pendingLabel ? pendingLabel : label}
      </button>
      {showFeedback ? <DiscussionActionFeedback state={state} /> : null}
    </form>
  );
}
