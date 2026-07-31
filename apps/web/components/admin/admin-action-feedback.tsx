"use client";

import { useTranslations } from "next-intl";

import type { AdminActionState } from "../../app/(app)/admin/action-state";

/**
 * Single shared feedback line for every admin form — `state.message` is always an `admin.*`
 * message key (`feedback.xxx` on success, `errors.xxx` on failure), so one `t()` call covers every
 * action in `apps/web/app/(app)/admin/actions.ts` instead of a per-page ternary chain.
 */
export function AdminActionFeedback({ state }: { state: AdminActionState }) {
  const t = useTranslations("admin");
  if (state.message === null) return null;

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-2 text-sm ${state.status === "error" ? "text-red-600" : "text-green-700"}`}
    >
      {t(state.message)}
    </p>
  );
}
