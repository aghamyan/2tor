import { describe, expect, it } from "vitest";

import { reminderWindowBounds } from "../../../../packages/domain/scheduling/reminders";

describe("reminderWindowBounds", () => {
  it("centers a tolerance band on now + the window's hours", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");

    const day = reminderWindowBounds("24h", now);
    expect(day.start.toISOString()).toBe("2026-07-30T11:54:00.000Z");
    expect(day.end.toISOString()).toBe("2026-07-30T12:06:00.000Z");

    const hour = reminderWindowBounds("1h", now);
    expect(hour.start.toISOString()).toBe("2026-07-29T12:54:00.000Z");
    expect(hour.end.toISOString()).toBe("2026-07-29T13:06:00.000Z");
  });

  it("produces bands that abut across consecutive 5-minute-interval scans with no gap", () => {
    const firstScan = new Date("2026-07-29T12:00:00.000Z");
    const secondScan = new Date("2026-07-29T12:05:00.000Z");

    const firstBand = reminderWindowBounds("1h", firstScan);
    const secondBand = reminderWindowBounds("1h", secondScan);

    // The second scan's window must start at or before the first scan's window ends, so no
    // lesson lands in the gap between two consecutive ticks of the worker job.
    expect(secondBand.start.getTime()).toBeLessThanOrEqual(firstBand.end.getTime());
  });
});
