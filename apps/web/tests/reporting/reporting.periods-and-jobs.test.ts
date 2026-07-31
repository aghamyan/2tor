import { describe, expect, it } from "vitest";
import {
  monthlyReportingJob,
  weeklyReportingJob,
} from "../../../worker/src/jobs/reporting/generate-reports.job";
import {
  previousMonthlyPeriod,
  previousWeeklyPeriod,
} from "../../../../packages/domain/reporting/periods";

describe("report schedules", () => {
  it("uses complete UTC week and month boundaries", () => {
    expect(previousWeeklyPeriod(new Date("2026-07-29T18:00:00.000Z"))).toEqual({
      start: new Date("2026-07-20T00:00:00.000Z"),
      end: new Date("2026-07-27T00:00:00.000Z"),
    });
    expect(previousMonthlyPeriod(new Date("2026-07-29T18:00:00.000Z"))).toEqual({
      start: new Date("2026-06-01T00:00:00.000Z"),
      end: new Date("2026-07-01T00:00:00.000Z"),
    });
  });

  it("registers weekly and monthly repeat jobs", () => {
    expect(weeklyReportingJob).toMatchObject({
      name: "reporting.generate-weekly",
      queue: "reporting",
      options: { repeat: { pattern: "10 2 * * 1" } },
    });
    expect(monthlyReportingJob).toMatchObject({
      name: "reporting.generate-monthly",
      queue: "reporting",
      options: { repeat: { pattern: "10 3 1 * *" } },
    });
  });
});
