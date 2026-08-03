/**
 * A generic, cross-module "is there unsaved work right now" registry. Task requirement: logging
 * out during an in-progress assessment attempt (or any other unsaved form) must prompt for
 * confirmation instead of silently discarding it — but which page has unsaved work is a fact only
 * that page's own component knows, and this task's file scope doesn't extend to the assessment
 * attempt page (`(app)/assessments/**`) or any other module's forms, so those pages register
 * themselves against this primitive rather than this module reaching into them.
 *
 * A registrant calls `registerUnsavedWork(() => isDirty)` while it has state that would be lost,
 * and calls the returned cleanup once it doesn't (typically a `useEffect` cleanup function).
 * `hasUnsavedWork()` is true if *any* currently-registered check reports unsaved state.
 */
type UnsavedWorkCheck = () => boolean;

const checks = new Set<UnsavedWorkCheck>();

export function registerUnsavedWork(check: UnsavedWorkCheck): () => void {
  checks.add(check);
  return () => {
    checks.delete(check);
  };
}

export function hasUnsavedWork(): boolean {
  for (const check of checks) {
    if (check()) return true;
  }
  return false;
}
