import { describe, expect, it } from "vitest";

import {
  canJoinLesson,
  formatLessonCountdown,
  minutesUntil,
} from "../../app/(app)/(dashboards)/_lib/lesson-countdown";

const now = new Date("2026-07-31T12:00:00.000Z");

describe("lesson countdown", () => {
  it("rounds minutes until start, negative once the lesson has begun", () => {
    expect(minutesUntil(new Date("2026-07-31T12:14:00.000Z"), now)).toBe(14);
    expect(minutesUntil(new Date("2026-07-31T11:50:00.000Z"), now)).toBe(-10);
  });

  it("formats a locale-aware relative countdown without hand-authored plural strings", () => {
    expect(formatLessonCountdown(new Date("2026-07-31T12:14:00.000Z"), now, "en")).toBe(
      "in 14 minutes",
    );
    expect(formatLessonCountdown(new Date("2026-07-31T14:00:00.000Z"), now, "en")).toBe(
      "in 2 hours",
    );
    expect(formatLessonCountdown(new Date("2026-07-31T12:14:00.000Z"), now, "hy")).toContain("14");
  });

  it("has no join link before the join window opens", () => {
    const startAt = new Date("2026-07-31T12:30:00.000Z");
    const endAt = new Date("2026-07-31T13:00:00.000Z");
    expect(canJoinLesson(now, startAt, endAt, "https://zoom.example/join")).toBe(false);
  });

  it("opens the join link 15 minutes before start through the scheduled end", () => {
    const startAt = new Date("2026-07-31T12:10:00.000Z");
    const endAt = new Date("2026-07-31T12:40:00.000Z");
    expect(canJoinLesson(now, startAt, endAt, "https://zoom.example/join")).toBe(true);
    expect(
      canJoinLesson(
        new Date("2026-07-31T12:39:00.000Z"),
        startAt,
        endAt,
        "https://zoom.example/join",
      ),
    ).toBe(true);
    expect(
      canJoinLesson(
        new Date("2026-07-31T12:41:00.000Z"),
        startAt,
        endAt,
        "https://zoom.example/join",
      ),
    ).toBe(false);
  });

  it("never allows joining without a join URL", () => {
    const startAt = new Date("2026-07-31T12:05:00.000Z");
    const endAt = new Date("2026-07-31T12:35:00.000Z");
    expect(canJoinLesson(now, startAt, endAt, null)).toBe(false);
  });
});
