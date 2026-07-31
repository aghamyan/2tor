import { describe, expect, it } from "vitest";

import {
  expandOccurrences,
  parseRecurrencePattern,
  serializeRecurrencePattern,
  zonedTimeToUtc,
  type RecurrencePattern,
} from "../../../../packages/domain/scheduling/recurrence";

function localWallClock(
  date: Date,
  timeZone: string,
): { hour: number; minute: number; weekday: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return { hour: Number(parts.hour), minute: Number(parts.minute), weekday: parts.weekday ?? "" };
}

describe("scheduling recurrence — DST safety", () => {
  const weeklySunday2pmLA: RecurrencePattern = {
    frequency: "weekly",
    interval: 1,
    byDay: ["SU"],
    hour: 14,
    minute: 0,
    timezone: "America/Los_Angeles",
  };

  it("keeps the local wall-clock time fixed across the US spring-forward boundary (2026-03-08)", () => {
    const occurrences = expandOccurrences(
      weeklySunday2pmLA,
      "2026-01-04",
      "2026-02-22",
      "2026-03-22",
    );

    expect(occurrences.map((date) => date.toISOString())).toEqual([
      "2026-02-22T22:00:00.000Z", // PST, UTC-8
      "2026-03-01T22:00:00.000Z", // PST, UTC-8 (last Sunday before the DST change)
      "2026-03-08T21:00:00.000Z", // PDT, UTC-7 (DST began earlier that day)
      "2026-03-15T21:00:00.000Z", // PDT, UTC-7
      "2026-03-22T21:00:00.000Z", // PDT, UTC-7
    ]);

    // Every occurrence reads as 14:00 local time in the zone, regardless of the UTC offset shift.
    for (const occurrence of occurrences) {
      const wallClock = localWallClock(occurrence, "America/Los_Angeles");
      expect(wallClock.hour).toBe(14);
      expect(wallClock.minute).toBe(0);
      expect(wallClock.weekday).toBe("Sun");
    }

    // The regression this guards against: computing occurrence N+1 as N's UTC instant + 7*24h
    // instead of re-deriving the local wall clock per occurrence. That would keep every gap at
    // exactly 168h; the real gap across the spring-forward boundary is 167h (an hour is skipped).
    const [, beforeChange, afterChange] = occurrences;
    if (!beforeChange || !afterChange) throw new Error("expected both boundary occurrences");
    const gapHours = (afterChange.getTime() - beforeChange.getTime()) / (60 * 60 * 1000);
    expect(gapHours).toBe(167);
    expect(gapHours).not.toBe(168);
  });

  it("keeps the local wall-clock time fixed across the US fall-back boundary (2026-11-01)", () => {
    const occurrences = expandOccurrences(
      weeklySunday2pmLA,
      "2026-01-04",
      "2026-10-25",
      "2026-11-08",
    );

    expect(occurrences.map((date) => date.toISOString())).toEqual([
      "2026-10-25T21:00:00.000Z", // PDT, UTC-7
      "2026-11-01T22:00:00.000Z", // PST, UTC-8 (fall-back happened earlier that day)
      "2026-11-08T22:00:00.000Z", // PST, UTC-8
    ]);

    for (const occurrence of occurrences) {
      const wallClock = localWallClock(occurrence, "America/Los_Angeles");
      expect(wallClock.hour).toBe(14);
      expect(wallClock.minute).toBe(0);
    }

    const [beforeChange, afterChange] = occurrences;
    if (!beforeChange || !afterChange) throw new Error("expected both boundary occurrences");
    const gapHours = (afterChange.getTime() - beforeChange.getTime()) / (60 * 60 * 1000);
    expect(gapHours).toBe(169); // an hour is repeated
  });

  it("survives the boundary through a full serialize -> parse -> expand round-trip", () => {
    const serialized = serializeRecurrencePattern(weeklySunday2pmLA);
    expect(serialized).toBe(
      "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SU;BYHOUR=14;BYMINUTE=0;TZID=America/Los_Angeles",
    );

    const roundTripped = parseRecurrencePattern(serialized);
    expect(roundTripped).toEqual(weeklySunday2pmLA);

    const direct = expandOccurrences(weeklySunday2pmLA, "2026-01-04", "2026-02-22", "2026-03-22");
    const viaRoundTrip = expandOccurrences(roundTripped, "2026-01-04", "2026-02-22", "2026-03-22");
    expect(viaRoundTrip.map((d) => d.toISOString())).toEqual(direct.map((d) => d.toISOString()));
  });

  it("honors interval (biweekly) and multiple weekdays anchored to the series start date", () => {
    const pattern: RecurrencePattern = {
      frequency: "weekly",
      interval: 2,
      byDay: ["MO", "TH"],
      hour: 9,
      minute: 30,
      timezone: "Asia/Yerevan",
    };
    // Anchor week (containing 2026-01-05, a Monday) is week 0. Week 2 is the next active week.
    const occurrences = expandOccurrences(pattern, "2026-01-05", "2026-01-05", "2026-02-01");
    expect(occurrences.map((date) => date.toISOString())).toEqual([
      "2026-01-05T05:30:00.000Z", // week 0 Monday, Asia/Yerevan is UTC+4 year-round (no DST)
      "2026-01-08T05:30:00.000Z", // week 0 Thursday
      "2026-01-19T05:30:00.000Z", // week 2 Monday (week 1 skipped by interval=2)
      "2026-01-22T05:30:00.000Z", // week 2 Thursday
    ]);
  });

  it("never returns an occurrence before the series start date even if the window starts earlier", () => {
    const occurrences = expandOccurrences(
      weeklySunday2pmLA,
      "2026-03-04", // Wednesday
      "2026-02-01",
      "2026-03-15",
    );
    expect(occurrences.every((date) => date.getTime() >= Date.UTC(2026, 2, 4))).toBe(true);
    expect(occurrences.map((d) => d.toISOString())).toEqual([
      "2026-03-08T21:00:00.000Z",
      "2026-03-15T21:00:00.000Z",
    ]);
  });

  it("rejects malformed or unsupported recurrence rules", () => {
    expect(() => parseRecurrencePattern("RRULE:FREQ=DAILY;BYHOUR=9;BYMINUTE=0;TZID=UTC")).toThrow();
    expect(() => parseRecurrencePattern("RRULE:FREQ=WEEKLY;BYHOUR=9;BYMINUTE=0;TZID=UTC")).toThrow(
      /BYDAY/,
    );
    expect(() =>
      serializeRecurrencePattern({
        frequency: "weekly",
        interval: 1,
        byDay: ["SU"],
        hour: 14,
        minute: 0,
        timezone: "Not/AZone",
      }),
    ).toThrow();
  });
});

describe("scheduling recurrence — zonedTimeToUtc", () => {
  it("converts a local wall-clock time to the correct UTC instant across zones", () => {
    expect(zonedTimeToUtc(2026, 6, 15, 12, 0, "UTC").toISOString()).toBe(
      "2026-06-15T12:00:00.000Z",
    );
    expect(zonedTimeToUtc(2026, 6, 15, 12, 0, "Asia/Yerevan").toISOString()).toBe(
      "2026-06-15T08:00:00.000Z",
    );
    expect(zonedTimeToUtc(2026, 1, 15, 12, 0, "America/Los_Angeles").toISOString()).toBe(
      "2026-01-15T20:00:00.000Z",
    );
    expect(zonedTimeToUtc(2026, 7, 15, 12, 0, "America/Los_Angeles").toISOString()).toBe(
      "2026-07-15T19:00:00.000Z",
    );
  });
});
