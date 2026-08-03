/**
 * Task requirement #9: a confirmation dialog only when there's genuinely unsaved work (an
 * in-progress assessment attempt registered via `unsaved-work.ts`, or any other unsaved form) —
 * otherwise logging out is one click, not a nagging prompt (task's UI/UX requirement). Extracted
 * as a pure function so the rule itself is directly testable, independent of the button's React
 * state.
 */
export type LogoutClickDecision = "show_confirm_dialog" | "proceed_immediately";

export function decideLogoutClick(hasUnsavedWork: boolean): LogoutClickDecision {
  return hasUnsavedWork ? "show_confirm_dialog" : "proceed_immediately";
}
