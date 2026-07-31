import { describe, expect, it } from "vitest";

import { studentExperienceFor } from "../../app/(app)/(dashboards)/_lib/student-experience";

const profile = (
  overrides: Partial<Parameters<typeof studentExperienceFor>[0]> = {},
): Parameters<typeof studentExperienceFor>[0] => ({
  isAdultLearner: false,
  dobYearMonth: null,
  ageBand: null,
  gradeLevel: null,
  ...overrides,
});

const now = new Date("2026-07-29T12:00:00.000Z");

describe("age-sensitive student dashboard selection", () => {
  it("always gives adult learners the detailed view", () => {
    expect(
      studentExperienceFor(
        profile({ isAdultLearner: true, ageBand: "8-10", gradeLevel: "4" }),
        now,
      ),
    ).toBe("older");
  });

  it("uses date of birth month ahead of broader age-band and grade hints", () => {
    expect(
      studentExperienceFor(
        profile({ dobYearMonth: "2014-08", ageBand: "14-17", gradeLevel: "9" }),
        now,
      ),
    ).toBe("younger");
    expect(
      studentExperienceFor(
        profile({ dobYearMonth: "2013-07", ageBand: "8-10", gradeLevel: "4" }),
        now,
      ),
    ).toBe("older");
  });

  it("falls back through age band and grade without inventing an age", () => {
    expect(studentExperienceFor(profile({ ageBand: "8-12" }), now)).toBe("younger");
    expect(studentExperienceFor(profile({ ageBand: "13-17" }), now)).toBe("older");
    expect(studentExperienceFor(profile({ gradeLevel: "Grade 6" }), now)).toBe("younger");
    expect(studentExperienceFor(profile({ gradeLevel: "Grade 7" }), now)).toBe("older");
  });

  it("uses the neutral detailed view when age information is unavailable", () => {
    expect(studentExperienceFor(profile(), now)).toBe("older");
  });
});
