export interface TimezoneOption {
  value: string;
  label: string;
}

function offsetMinutes(timeZone: string, reference: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(reference);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    lookup.hour === "24" ? 0 : Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second),
  );
  return Math.round((asUtc - reference.getTime()) / 60_000);
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const mins = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${mins}`;
}

let cachedOptions: TimezoneOption[] | null = null;

/** Every IANA time zone as a `{value, label}` pair, sorted by current UTC offset. Computed once
 * per process/session — the offset ordering only matters for readability, not correctness, so a
 * stale cache across a DST boundary is harmless. */
export function getTimezoneOptions(): TimezoneOption[] {
  if (cachedOptions) return cachedOptions;
  const reference = new Date();
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  cachedOptions = zones
    .map((zone) => ({ zone, minutes: offsetMinutes(zone, reference) }))
    .sort((a, b) => a.minutes - b.minutes || a.zone.localeCompare(b.zone))
    .map(({ zone, minutes }) => ({
      value: zone,
      label: `(${formatOffset(minutes)}) ${zone.replace(/_/g, " ")}`,
    }));
  return cachedOptions;
}

/** Best-effort guess at the visitor's own time zone, for defaulting the picker. */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}
