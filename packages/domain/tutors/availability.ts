import type { TutorAvailabilityRule, TutorAvailabilityUtcWindow } from "./models";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const dayMs = 86_400_000;

function partsAt(date: Date, timeZone: string): DateParts {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(formatted.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function dateKey(parts: Pick<DateParts, "year" | "month" | "day">): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Converts a local wall-clock minute to UTC. For an ambiguous fall-back time, chooses the earlier instant. */
function localMinuteToUtc(
  date: Pick<DateParts, "year" | "month" | "day">,
  minute: number,
  timeZone: string,
): Date {
  const hour = Math.floor(minute / 60);
  const localMinute = minute % 60;
  const wanted = Date.UTC(date.year, date.month - 1, date.day, hour, localMinute, 0);
  let candidate = new Date(wanted);
  // Two passes converge even across ordinary DST offset transitions.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = partsAt(candidate, timeZone);
    const observed = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    candidate = new Date(candidate.getTime() + wanted - observed);
  }
  return candidate;
}

function localMidnight(date: Date, timeZone: string): Date {
  const parts = partsAt(date, timeZone);
  return localMinuteToUtc(parts, 0, timeZone);
}

/**
 * Converts persisted weekly rules to exact UTC half-open intervals. This intentionally does not
 * subtract bookings or apply scheduling exceptions: D5 owns those overlays and consumes this
 * availability-only projection read-only.
 */
export function projectAvailabilityUtc(
  rules: readonly TutorAvailabilityRule[],
  startAt: Date,
  endAt: Date,
): TutorAvailabilityUtcWindow[] {
  if (endAt <= startAt) return [];
  const timeZone = rules[0]?.timeZone;
  if (!timeZone) return [];
  const firstMidnight = localMidnight(startAt, timeZone);
  const windows: TutorAvailabilityUtcWindow[] = [];

  for (let cursor = firstMidnight; cursor < endAt; cursor = new Date(cursor.getTime() + dayMs)) {
    const local = partsAt(cursor, timeZone);
    const dayOfWeek = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
    const localDate = dateKey(local);
    for (const rule of rules) {
      if (rule.dayOfWeek !== dayOfWeek) continue;
      if (
        (rule.effectiveFrom && localDate < rule.effectiveFrom) ||
        (rule.effectiveTo && localDate > rule.effectiveTo)
      )
        continue;
      const startsAt = localMinuteToUtc(local, rule.startMinute, rule.timeZone);
      const endsAt = localMinuteToUtc(local, rule.endMinute, rule.timeZone);
      if (endsAt <= startAt || startsAt >= endAt || endsAt <= startsAt) continue;
      windows.push({
        startsAt: new Date(Math.max(startsAt.getTime(), startAt.getTime())),
        endsAt: new Date(Math.min(endsAt.getTime(), endAt.getTime())),
        timeZone: rule.timeZone,
        source: "recurring",
        ruleId: rule.id,
      });
    }
  }
  return windows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export const AVAILABILITY_WINDOW_CONTRACT = {
  interval: "[startsAt, endsAt)",
  timestamps: "UTC ISO-8601 instants",
  recurrence: "weekly wall-clock rules with an IANA time zone",
  overlayOwner: "Scheduling (D5) applies one-time availability overrides and reservations",
} as const;

export function minutesToLocalTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function localTimeToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return Number.NaN;
  return hour * 60 + minute;
}
