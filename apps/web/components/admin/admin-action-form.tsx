"use client";

import { useActionState, type ReactNode } from "react";

import { initialAdminActionState, type AdminActionState } from "../../app/(app)/admin/action-state";
import { AdminActionFeedback } from "./admin-action-feedback";

type AdminAction = (previous: AdminActionState, formData: FormData) => Promise<AdminActionState>;

/**
 * Shared `useActionState` wrapper for the (many, mostly-similar) admin decision forms — every
 * page under `apps/web/app/(app)/admin/**` renders one of these per row/action instead of
 * duplicating the pending/feedback wiring `packages/domain/consent`'s `activate-panel.tsx` shows
 * as the per-module pattern.
 */
export function AdminActionForm({
  action,
  hiddenFields,
  children,
  submitLabel,
  pendingLabel,
  className,
}: {
  action: AdminAction;
  hiddenFields?: Record<string, string>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialAdminActionState);

  return (
    <form action={formAction} className={className ?? "space-y-2"}>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      {children}
      <button
        type="submit"
        disabled={pending}
        className="rounded border px-3 py-1 text-sm font-medium disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      <AdminActionFeedback state={state} />
    </form>
  );
}
