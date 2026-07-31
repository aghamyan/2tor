/**
 * Time-zone-safe recurrence engine for lesson series (spec §5.4/§14.2/§15: "DST handled by zone,
 * never manually"). `lesson_series.recurrence_rule` (packages/db/src/schema/scheduling.ts) is a
 * free-text column documented as "RFC 5545 RRULE string" — this module owns the packed format
 * actually stored there (`serializeRecurrencePattern`/`parseRecurrencePattern`) and the DST-safe
 * expansion into concrete UTC instants (`expandOccurrences`).
 *
 * `lesson_series` already has `startDate`/`endDate` (date-only) columns bounding the series'
 * calendar range, so the packed string only needs to encode the recurrence *pattern* — weekday(s),
 * local wall-clock time, IANA zone, and the week interval — not another start/end.
 *
 * The critical invariant: every occurrence's UTC instant is computed independently from its own
 * local calendar date via `zonedTimeToUtc`, never by adding a fixed millisecond offset (e.g.
 * `interval * 7 * 86_400_000`) to the previous occurrence. Fixed-offset arithmetic silently
 * produces the wrong wall-clock time across a DST boundary; per-occurrence zone conversion is what
 * keeps "every Sunday at 2pm America/Los_Angeles" landing on 2pm local on both sides of it.
 */

export const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface RecurrencePattern {
  frequency: "weekly";
  /** Weeks between occurrences. 1 = every week, 2 = biweekly, etc. */
  interval: number;
  /** One or more weekdays the lesson occurs on, e.g. ["MO", "WE"]. */
  byDay: readonly Weekday[];
  /** Local wall-clock hour, 0-23, in `timezone`. */
  hour: number;
  /** Local wall-clock minute, 0-59. */
  minute: number;
  /** IANA time zone the wall-clock hour/minute above is expressed in. */
  timezone: string;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses a "YYYY-MM-DD" calendar date into a UTC-midnight millisecond serial (pure day bookkeeping — never a real instant). */
function parseDateOnly(value: string): number {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error(`Invalid calendar date "${value}"; expected YYYY-MM-DD.`);
  const [, year, month, day] = match as unknown as [string, string, string, string];
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function formatDateOnly(dayMs: number): string {
  const date = new Date(dayMs);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarParts(dayMs: number): { year: number; month: number; day: number } {
  const date = new Date(dayMs);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * The IANA offset (in minutes, local minus UTC) in effect at `instantMs`, computed by formatting
 * that instant in `timeZone` and diffing against its UTC calendar reading. No timezone-database
 * dependency needed — this only relies on `Intl.DateTimeFormat`, which every Node runtime bundles.
 */
function offsetMinutesAt(instantMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(instantMs));
  const byType = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(byType.year),
    Number(byType.month) - 1,
    Number(byType.day),
    Number(byType.hour),
    Number(byType.minute),
    Number(byType.second),
  );
  return (asUtc - instantMs) / 60_000;
}

/**
 * Converts a local wall-clock date/time in `timeZone` to the UTC instant it represents.
 * Standard guess-and-correct approach: treat the wall-clock fields as if they were UTC, read the
 * zone's offset at that instant, and re-solve; two iterations converge for every real-world zone,
 * including ones with non-hour offsets (e.g. `Asia/Kolkata`, `+05:30`).
 *
 * DST edge cases are resolved pragmatically, not perfectly: a "spring forward" gap (a wall-clock
 * time that never occurs) resolves to the post-transition instant; a "fall back" ambiguity (a
 * wall-clock time that occurs twice) resolves to its first occurrence. Acceptable for lesson
 * scheduling — nobody is booking lessons inside the one skipped/repeated hour on transition day.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guessMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let iteration = 0; iteration < 2; iteration++) {
    const offsetMinutes = offsetMinutesAt(guessMs, timeZone);
    const nextGuessMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60_000;
    if (nextGuessMs === guessMs) break;
    guessMs = nextGuessMs;
  }
  return new Date(guessMs);
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
}

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function assertValidPattern(pattern: RecurrencePattern): void {
  if (pattern.frequency !== "weekly") {
    throw new Error(`Unsupported recurrence frequency "${pattern.frequency}".`);
  }
  if (!Number.isInteger(pattern.interval) || pattern.interval < 1) {
    throw new Error(`Recurrence interval must be a positive integer, got ${pattern.interval}.`);
  }
  if (pattern.byDay.length === 0) {
    throw new Error("Recurrence pattern requires at least one weekday.");
  }
  // Wrapped in an arrow function (not passed as a bare reference) so TS doesn't statically narrow
  // `pattern.byDay` itself to `Weekday[]`/`never[]` here — this guards runtime input built via an
  // unchecked cast (see `parseRecurrencePattern`'s `byDay as Weekday[]`), which the type system
  // otherwise assumes can never fail.
  if (!pattern.byDay.every((day) => isWeekday(day))) {
    throw new Error(`Recurrence pattern has an invalid weekday in [${pattern.byDay.join(",")}].`);
  }
  if (!Number.isInteger(pattern.hour) || pattern.hour < 0 || pattern.hour > 23) {
    throw new Error(`Recurrence hour must be 0-23, got ${pattern.hour}.`);
  }
  if (!Number.isInteger(pattern.minute) || pattern.minute < 0 || pattern.minute > 59) {
    throw new Error(`Recurrence minute must be 0-59, got ${pattern.minute}.`);
  }
  if (!isValidIanaTimezone(pattern.timezone)) {
    throw new Error(`Recurrence pattern has an invalid IANA time zone "${pattern.timezone}".`);
  }
}

/**
 * Serializes a pattern into the packed string stored in `lesson_series.recurrence_rule`. Loosely
 * RRULE-shaped (see module docstring) — this is a domain-internal format, not meant for iCalendar
 * interchange.
 */
export function serializeRecurrencePattern(pattern: RecurrencePattern): string {
  assertValidPattern(pattern);
  const byDay = [...pattern.byDay]
    .sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
    .join(",");
  return [
    "RRULE:FREQ=WEEKLY",
    `INTERVAL=${pattern.interval}`,
    `BYDAY=${byDay}`,
    `BYHOUR=${pattern.hour}`,
    `BYMINUTE=${pattern.minute}`,
    `TZID=${pattern.timezone}`,
  ].join(";");
}

/** Parses the packed string back into a structured pattern. Throws on malformed or invalid input. */
export function parseRecurrencePattern(serialized: string): RecurrencePattern {
  const withoutPrefix = serialized.trim().replace(/^RRULE:/, "");
  const fields = new Map<string, string>();
  for (const segment of withoutPrefix.split(";")) {
    const [key, value] = segment.split("=");
    if (!key || value === undefined) {
      throw new Error(`Malformed recurrence segment "${segment}" in "${serialized}".`);
    }
    fields.set(key.trim().toUpperCase(), value.trim());
  }

  const freq = fields.get("FREQ");
  if (freq !== "WEEKLY") {
    throw new Error(`Unsupported or missing FREQ in recurrence rule "${serialized}".`);
  }
  const byDayRaw = fields.get("BYDAY");
  if (!byDayRaw) throw new Error(`Recurrence rule "${serialized}" is missing BYDAY.`);
  const byDay = byDayRaw.split(",").map((entry) => entry.trim());

  const pattern: RecurrencePattern = {
    frequency: "weekly",
    interval: Number(fields.get("INTERVAL") ?? "1"),
    byDay: byDay as Weekday[],
    hour: Number(fields.get("BYHOUR")),
    minute: Number(fields.get("BYMINUTE")),
    timezone: fields.get("TZID") ?? "",
  };
  assertValidPattern(pattern);
  return pattern;
}

export interface ExpandOccurrencesOptions {
  /** Safety cap on the number of returned occurrences. Defaults to 500. */
  limit?: number;
}

/**
 * Expands `pattern` into concrete UTC instants (lesson `scheduledStartAt` values) within
 * `[windowStartDate, windowEndDate]` (inclusive, "YYYY-MM-DD" local calendar dates), anchored to
 * `seriesStartDate` — the `lesson_series.start_date` this pattern belongs to, which defines which
 * week counts as "week zero" for `interval` purposes (so a biweekly series keeps recurring on the
 * same cadence regardless of what window is being expanded).
 *
 * Returned instants are sorted ascending. No occurrence before `seriesStartDate` is ever produced,
 * even if the window starts earlier.
 */
export function expandOccurrences(
  pattern: RecurrencePattern,
  seriesStartDate: string,
  windowStartDate: string,
  windowEndDate: string,
  options: ExpandOccurrencesOptions = {},
): Date[] {
  assertValidPattern(pattern);
  const limit = options.limit ?? 500;

  const anchorDayMs = parseDateOnly(seriesStartDate);
  const windowStartMs = Math.max(parseDateOnly(windowStartDate), anchorDayMs);
  const windowEndMs = parseDateOnly(windowEndDate);
  if (windowEndMs < windowStartMs) return [];

  // Week start (Sunday) of the anchor date — the reference point `interval` weeks are counted from.
  const anchorWeekday = new Date(anchorDayMs).getUTCDay();
  const anchorWeekStartMs = anchorDayMs - anchorWeekday * DAY_MS;

  const sortedByDay = [...new Set(pattern.byDay)].sort(
    (a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b),
  );

  const results: Date[] = [];
  const maxWeekIndex = Math.ceil((windowEndMs - anchorWeekStartMs) / (7 * DAY_MS)) + 1;

  for (let weekIndex = 0; weekIndex <= maxWeekIndex; weekIndex++) {
    if (weekIndex % pattern.interval !== 0) continue;
    const weekStartMs = anchorWeekStartMs + weekIndex * 7 * DAY_MS;
    if (weekStartMs > windowEndMs) break;

    for (const weekday of sortedByDay) {
      const dayOffset = WEEKDAYS.indexOf(weekday);
      const candidateDayMs = weekStartMs + dayOffset * DAY_MS;
      if (candidateDayMs < windowStartMs || candidateDayMs > windowEndMs) continue;

      const { year, month, day } = calendarParts(candidateDayMs);
      results.push(
        zonedTimeToUtc(year, month, day, pattern.hour, pattern.minute, pattern.timezone),
      );
      if (results.length >= limit) {
        return results.sort((a, b) => a.getTime() - b.getTime());
      }
    }
  }

  return results.sort((a, b) => a.getTime() - b.getTime());
}

export function formatCalendarDate(date: Date): string {
  return formatDateOnly(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
