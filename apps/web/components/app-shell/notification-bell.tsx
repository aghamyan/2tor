import { unreadNotificationCount } from "./shell-data";
import { BellIcon } from "./icons";
import styles from "./app-shell.module.css";

/**
 * A `role="status"` indicator, not a link or button: there is no notifications inbox route in
 * this codebase to send a click to (only `@app/notifications`'s dispatch/inbox primitives exist,
 * no page — see `shell-data.ts`'s header comment), and a clickable control that goes nowhere is
 * worse than an honest, non-interactive count. No `aria-live` — this renders once per navigation
 * server-side, not on a live interval, so a live region would just re-announce the same count on
 * every page change.
 *
 * Awaited inside a `<Suspense>` boundary in `topbar.tsx` so a slow/unavailable read delays only
 * this indicator, not the rest of the shell (see "Perf" in the task brief). It can still throw
 * (Suspense catches pending promises, not rejections) — an unhandled rejection here still fails
 * the whole layout render today, same blast radius `currentSession()`'s Redis dependency already
 * has; flagged in this task's output notes as a follow-up rather than fixed here.
 */
export async function NotificationBell({
  userId,
  label,
  emptyLabel,
}: {
  userId: string;
  label: (count: number) => string;
  emptyLabel: string;
}) {
  const count = await unreadNotificationCount(userId);

  return (
    <span
      role="status"
      className={`${styles.iconButton} relative inline-flex size-9 items-center justify-center rounded-md`}
    >
      <BellIcon className="size-5" aria-hidden="true" />
      <span className={styles.visuallyHidden}>{count > 0 ? label(count) : emptyLabel}</span>
      {count > 0 ? (
        <span
          aria-hidden="true"
          className={`${styles.bellBadge} absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[0.6rem] font-bold leading-4`}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </span>
  );
}

export function NotificationBellFallback({ emptyLabel }: { emptyLabel: string }) {
  return (
    <span
      role="status"
      className={`${styles.iconButton} relative inline-flex size-9 items-center justify-center rounded-md`}
    >
      <BellIcon className="size-5" aria-hidden="true" />
      <span className={styles.visuallyHidden}>{emptyLabel}</span>
    </span>
  );
}
