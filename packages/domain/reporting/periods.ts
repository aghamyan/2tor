import { ReportingError } from "./errors";
import type { ReportPeriod, ReportingCadence } from "./models";

const DAY_MS = 24 * 60 * 60 * 1_000;

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Returns the last fully completed UTC week (Monday–Monday) containing the anchor's prior day. */
export function previousWeeklyPeriod(anchor = new Date()): ReportPeriod {
  if (Number.isNaN(anchor.getTime()))
    throw new ReportingError("INVALID_PERIOD", "The report anchor is invalid.");
  const midnight = utcDate(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const daysSinceMonday = (midnight.getUTCDay() + 6) % 7;
  const end = new Date(midnight.getTime() - daysSinceMonday * DAY_MS);
  return { start: new Date(end.getTime() - 7 * DAY_MS), end };
}

/** Returns the last fully completed UTC calendar month. */
export function previousMonthlyPeriod(anchor = new Date()): ReportPeriod {
  if (Number.isNaN(anchor.getTime()))
    throw new ReportingError("INVALID_PERIOD", "The report anchor is invalid.");
  const end = utcDate(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1);
  return { start: utcDate(end.getUTCFullYear(), end.getUTCMonth() - 1, 1), end };
}

export function currentPeriod(cadence: ReportingCadence, anchor = new Date()): ReportPeriod {
  if (Number.isNaN(anchor.getTime()))
    throw new ReportingError("INVALID_PERIOD", "The report anchor is invalid.");
  const end = anchor;
  if (cadence === "weekly") {
    return { start: new Date(end.getTime() - 7 * DAY_MS), end };
  }
  return { start: utcDate(end.getUTCFullYear(), end.getUTCMonth(), 1), end };
}

export function previousPeriod(cadence: ReportingCadence, anchor = new Date()): ReportPeriod {
  return cadence === "weekly" ? previousWeeklyPeriod(anchor) : previousMonthlyPeriod(anchor);
}

export function reportKey(cadence: ReportingCadence, period: ReportPeriod): string {
  return `${cadence}:${period.start.toISOString()}:${period.end.toISOString()}`;
}
