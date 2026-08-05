import { describe, expect, it } from "vitest";

import { isWithinReminderTolerance } from "../../../../packages/domain/whatsapp/reminders";

describe("isWithinReminderTolerance", () => {
  it("matches a lesson starting exactly at now + leadMinutes", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");
    const scheduledStartAt = new Date("2026-07-29T13:00:00.000Z"); // 60 minutes out
    expect(isWithinReminderTolerance(scheduledStartAt, now, 60)).toBe(true);
  });

  it("matches within the ±6-minute tolerance band", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");
    expect(isWithinReminderTolerance(new Date("2026-07-29T12:54:00.000Z"), now, 60)).toBe(true);
    expect(isWithinReminderTolerance(new Date("2026-07-29T13:06:00.000Z"), now, 60)).toBe(true);
  });

  it("rejects a lesson outside the tolerance band", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");
    expect(isWithinReminderTolerance(new Date("2026-07-29T12:53:00.000Z"), now, 60)).toBe(false);
    expect(isWithinReminderTolerance(new Date("2026-07-29T13:07:00.000Z"), now, 60)).toBe(false);
  });

  it("handles a 1440-minute (24h) lead time the same way", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");
    expect(isWithinReminderTolerance(new Date("2026-07-30T12:00:00.000Z"), now, 1440)).toBe(true);
    expect(isWithinReminderTolerance(new Date("2026-07-30T11:00:00.000Z"), now, 1440)).toBe(false);
  });

  it("produces bands that abut across consecutive 5-minute scans with no gap", () => {
    const firstScan = new Date("2026-07-29T12:00:00.000Z");
    const secondScan = new Date("2026-07-29T12:05:00.000Z");
    const leadMinutes = 60;

    // A lesson landing right at the edge of the first scan's window must still be caught by the
    // second scan, five minutes later — same coverage guarantee scheduling's reminders.ts documents.
    const edgeStart = new Date(firstScan.getTime() + (leadMinutes + 6) * 60_000);
    expect(isWithinReminderTolerance(edgeStart, firstScan, leadMinutes)).toBe(true);
    expect(isWithinReminderTolerance(edgeStart, secondScan, leadMinutes)).toBe(true);
  });
});
