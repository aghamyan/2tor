/**
 * A join link becomes actionable 15 minutes before start (a conventional meeting-app join
 * window) through the lesson's scheduled end. Outside that window the countdown still renders,
 * but there is nothing to click yet.
 */
const JOIN_WINDOW_MS = 15 * 60 * 1000;

export function canJoinLesson(
  now: Date,
  startAt: Date,
  endAt: Date,
  joinUrl: string | null,
): boolean {
  if (!joinUrl) return false;
  const joinWindowStart = new Date(startAt.getTime() - JOIN_WINDOW_MS);
  return now >= joinWindowStart && now < endAt;
}

/** Rounds to the nearest whole minute; negative once `startAt` has passed. */
export function minutesUntil(startAt: Date, now: Date): number {
  return Math.round((startAt.getTime() - now.getTime()) / 60_000);
}

/** Locale-aware countdown text ("in 14 minutes", "in 2 hours") without hand-authored plural rules. */
export function formatLessonCountdown(startAt: Date, now: Date, locale: string): string {
  const minutes = minutesUntil(startAt, now);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  return rtf.format(Math.round(minutes / 60), "hour");
}
