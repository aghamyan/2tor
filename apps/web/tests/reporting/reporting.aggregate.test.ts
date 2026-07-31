import { describe, expect, it } from "vitest";
import { generateReportingSnapshot } from "../../../../packages/domain/reporting/aggregate";
import type {
  ReportingFactSet,
  ReportingRepository,
  ReportingSnapshot,
} from "../../../../packages/domain/reporting/models";
import { generateAndStoreReportingSnapshot } from "../../../../packages/domain/reporting/services";

const period = {
  start: new Date("2026-01-01T00:00:00.000Z"),
  end: new Date("2026-05-01T00:00:00.000Z"),
};

function at(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function seedFacts(): ReportingFactSet {
  const students = Array.from({ length: 6 }, (_, index) => `student-${index + 1}`);
  const funnelEvents = students.flatMap((subjectKey) => [
    { subjectKey, stage: "visitor" as const, occurredAt: at("2026-01-01") },
    { subjectKey, stage: "consultation" as const, occurredAt: at("2026-01-02") },
    { subjectKey, stage: "trial" as const, occurredAt: at("2026-01-03") },
    { subjectKey, stage: "paid" as const, occurredAt: at("2026-01-04") },
    { subjectKey, stage: "retained_30d" as const, occurredAt: at("2026-02-03") },
    { subjectKey, stage: "retained_90d" as const, occurredAt: at("2026-04-04") },
  ]);
  const lessons = Array.from({ length: 10 }, (_, index) => {
    const completed = index < 8;
    return {
      lessonKey: `lesson-${index + 1}`,
      occurredAt: at("2026-02-10"),
      status: completed ? ("completed" as const) : ("canceled" as const),
      scheduledMinutes: 60,
      expectedStudentCount: 1,
      attendedStudentCount: completed && index < 6 ? 1 : 0,
      tutorExpected: true,
      tutorAttended: completed && index < 7,
      hasPublishedFeedback: completed && index < 6,
      revenueMinor: completed ? 100 : null,
      tutorCostMinor: completed ? 60 : null,
      currency: completed ? "USD" : null,
    };
  });
  return {
    funnelEvents,
    lessons,
    capacity: [{ occurredAt: at("2026-02-10"), availableMinutes: 600 }],
    supportTickets: Array.from({ length: 6 }, (_, index) => ({
      openedAt: at("2026-02-10"),
      resolvedAt: index < 5 ? new Date(at("2026-02-10").getTime() + 2 * 60 * 60 * 1_000) : null,
    })),
    paymentAttempts: [
      ...Array.from({ length: 8 }, () => ({
        occurredAt: at("2026-02-10"),
        status: "succeeded" as const,
      })),
      ...Array.from({ length: 2 }, () => ({
        occurredAt: at("2026-02-10"),
        status: "failed" as const,
      })),
    ],
    refunds: [{ occurredAt: at("2026-02-10"), status: "completed" }],
    academicMeasurements: students.flatMap((studentKey) => [
      {
        studentKey,
        subjectKey: "math",
        measuredAt: at("2026-01-10"),
        percent: 50,
        kind: "diagnostic" as const,
      },
      {
        studentKey,
        subjectKey: "math",
        measuredAt: at("2026-03-10"),
        percent: 70,
        kind: "diagnostic" as const,
      },
    ]),
    milestones: students.map((studentKey, index) => ({
      studentKey,
      occurredAt: at("2026-03-10"),
      completed: index < 3,
    })),
    planProgress: students.map((studentKey) => ({
      studentKey,
      occurredAt: at("2026-03-10"),
      completedItems: 2,
      totalItems: 4,
    })),
    rubricMeasurements: students.flatMap((studentKey) => [
      {
        studentKey,
        criterionKey: "reasoning",
        measuredAt: at("2026-01-10"),
        percent: 40,
      },
      {
        studentKey,
        criterionKey: "reasoning",
        measuredAt: at("2026-03-10"),
        percent: 70,
      },
    ]),
    schoolPerformance: students.map((studentKey, index) => ({
      studentKey,
      measuredAt: at("2026-03-10"),
      percent: 70 + index * 2,
    })),
  };
}

describe("privacy-preserving report aggregation", () => {
  it("produces the specified funnel, operational, and academic aggregates on seed facts", () => {
    const report = generateReportingSnapshot(seedFacts(), {
      cadence: "monthly",
      period,
      generatedAt: new Date("2026-05-01T03:10:00.000Z"),
    });

    expect(report.funnel.stages.map((stage) => stage.reached.value)).toEqual([6, 6, 6, 6, 6, 6]);
    expect(report.operational.tutorAttendanceRate.value).toBe(87.5);
    expect(report.operational.studentAttendanceRate.value).toBe(75);
    expect(report.operational.missingFeedbackRate.value).toBe(25);
    expect(report.operational.cancellationRate.value).toBe(20);
    expect(report.operational.supportResolutionRate.value).toBe(83.33);
    expect(report.operational.supportResolutionHours.value).toBe(2);
    expect(report.operational.utilizationRate.value).toBe(80);
    expect(report.operational.marginPerLesson).toMatchObject([{ currency: "USD", value: 40 }]);
    expect(report.operational.paymentFailureRate.value).toBe(20);
    expect(report.operational.refundRate.value).toBe(12.5);

    expect(report.academic.baselineScore.value).toBe(50);
    expect(report.academic.followUpScore.value).toBe(70);
    expect(report.academic.baselineToFollowUpChange.value).toBe(20);
    expect(report.academic.milestoneCompletionRate.value).toBe(50);
    expect(report.academic.planProgressRate.value).toBe(50);
    expect(report.academic.accuracyTrend.value).toBe(20);
    expect(report.academic.rubricImprovement.value).toBe(30);
    expect(report.academic.selfReportedSchoolPerformance.value).toBe(75);
    expect(report.academic.selfReportedSchoolPerformanceLabel).toBe(
      "Self-reported school performance",
    );
    expect(JSON.stringify(report)).not.toContain("student-");
  });

  it("suppresses a non-empty cohort smaller than the configured privacy floor", () => {
    const facts = seedFacts();
    const report = generateReportingSnapshot(
      {
        ...facts,
        milestones: facts.milestones.slice(0, 1),
      },
      { cadence: "weekly", period },
    );

    expect(report.academic.milestoneCompletionRate).toMatchObject({
      value: null,
      numerator: null,
      denominator: null,
      sampleSize: null,
      suppressed: true,
    });
  });

  it("anchors 90-day retention to payment even when the 30-day observation was late", () => {
    const subjectKey = "late-thirty-day-observation";
    const report = generateReportingSnapshot(
      {
        ...seedFacts(),
        funnelEvents: [
          { subjectKey, stage: "visitor", occurredAt: at("2026-01-01") },
          { subjectKey, stage: "consultation", occurredAt: at("2026-01-02") },
          { subjectKey, stage: "trial", occurredAt: at("2026-01-03") },
          { subjectKey, stage: "paid", occurredAt: at("2026-01-04") },
          { subjectKey, stage: "retained_30d", occurredAt: at("2026-03-05") },
          { subjectKey, stage: "retained_90d", occurredAt: at("2026-04-04") },
        ],
      },
      { cadence: "monthly", period, minimumCohortSize: 1 },
    );

    expect(report.funnel.stages.at(-1)?.reached.value).toBe(1);
  });

  it("stores a scheduled period once and returns the append-only snapshot on retry", async () => {
    const stored = new Map<string, ReportingSnapshot>();
    let writes = 0;
    const repository: ReportingRepository = {
      async loadFacts() {
        return seedFacts();
      },
      async getStoredReport(key) {
        return stored.get(key) ?? null;
      },
      async saveReport(key, report) {
        writes += 1;
        stored.set(key, report);
      },
      async recordFunnelEvent() {},
    };

    const generatedAt = new Date("2026-05-01T03:10:00.000Z");
    const first = await generateAndStoreReportingSnapshot(
      repository,
      "monthly",
      period,
      generatedAt,
    );
    const retry = await generateAndStoreReportingSnapshot(
      repository,
      "monthly",
      period,
      new Date("2026-05-01T03:11:00.000Z"),
    );

    expect(writes).toBe(1);
    expect(retry).toBe(first);
  });
});
