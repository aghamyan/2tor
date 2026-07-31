import type { Locale } from "./config";

export type DisplayTimeZone = string;
export type DateInput = Date | number | string;

const numberDefaults: Intl.NumberFormatOptions = {
  maximumFractionDigits: 2,
};

const dateDefaults: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
};

const dateTimeDefaults: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

function asDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Expected a valid date value.");
  return date;
}

function assertTimeZone(timeZone: DisplayTimeZone): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    throw new RangeError(`Expected an IANA time zone; received "${timeZone}".`);
  }
}

/** Formats a number in the selected interface locale. */
export function formatNumber(
  value: number | bigint,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale, { ...numberDefaults, ...options }).format(value);
}

/** Formats a monetary amount. The currency comes from the value/domain, not the locale. */
export function formatCurrency(
  value: number | bigint,
  currency: string,
  locale: Locale,
  options: Omit<Intl.NumberFormatOptions, "style" | "currency"> = {},
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, ...options }).format(value);
}

/**
 * Formats an instant in the user's IANA zone for display. It never converts or stores
 * a different value; persist UTC instants and apply this only at the presentation edge.
 */
export function formatDate(
  value: DateInput,
  locale: Locale,
  timeZone: DisplayTimeZone,
  options: Intl.DateTimeFormatOptions = {},
): string {
  assertTimeZone(timeZone);
  return new Intl.DateTimeFormat(locale, { ...dateDefaults, ...options, timeZone }).format(
    asDate(value),
  );
}

export function formatDateTime(
  value: DateInput,
  locale: Locale,
  timeZone: DisplayTimeZone,
  options: Intl.DateTimeFormatOptions = {},
): string {
  assertTimeZone(timeZone);
  return new Intl.DateTimeFormat(locale, { ...dateTimeDefaults, ...options, timeZone }).format(
    asDate(value),
  );
}
