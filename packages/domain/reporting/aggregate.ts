import { MINIMUM_REPORTING_COHORT_SIZE } from "./privacy";
import { FUNNEL_STAGES } from "./models";
import type {
  AcademicMeasurementFact,
  AggregateMetric,
  FunnelEventFact,
  FunnelStageMetric,
  MetricUnit,
  MoneyMetric,
  ReportPeriod,
  ReportingCadence,
  ReportingFactSet,
  ReportingSnapshot,
  RubricMeasurementFact,
} from "./models";

const DAY_MS = 24 * 60 * 60 * 1_000;

interface MetricInput {
  value: number | null;
  numerator?: number | null;
  denominator?: number | null;
  unit: MetricUnit;
  sampleSize: number;
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function percent(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round((numerator / denominator) * 100);
}

function metric(input: MetricInput, minimumCohortSize: number): AggregateMetric {
  const suppressed = input.sampleSize > 0 && input.sampleSize < minimumCohortSize;
  if (suppressed) {
    return {
      value: null,
      numerator: null,
      denominator: null,
      unit: input.unit,
      suppressed: true,
      sampleSize: null,
    };
  }
  return {
    value: input.value === null ? null : round(input.value),
    numerator: input.numerator === undefined ? null : input.numerator,
    denominator: input.denominator === undefined ? null : input.denominator,
    unit: input.unit,
    suppressed: false,
    sampleSize: input.sampleSize,
  };
}

function inPeriod(date: Date, period: ReportPeriod): boolean {
  return date >= period.start && date < period.end;
}

function sequentialFunnelCounts(
  events: readonly FunnelEventFact[],
  period: ReportPeriod,
): number[] {
  const eventsBySubject = new Map<string, FunnelEventFact[]>();
  for (const event of events) {
    const subjectEvents = eventsBySubject.get(event.subjectKey) ?? [];
    subjectEvents.push(event);
    eventsBySubject.set(event.subjectKey, subjectEvents);
  }

  const reachedInPeriod = FUNNEL_STAGES.map(() => new Set<string>());
  for (const [subjectKey, subjectEvents] of eventsBySubject) {
    const sorted = [...subjectEvents].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );
    let previousAt: Date | null = null;
    let paidAt: Date | null = null;
    for (const [stageIndex, stage] of FUNNEL_STAGES.entries()) {
      const minimumAt: Date | null =
        stage === "retained_30d" && paidAt
          ? new Date(paidAt.getTime() + 30 * DAY_MS)
          : stage === "retained_90d" && paidAt
            ? new Date(Math.max(paidAt.getTime() + 90 * DAY_MS, previousAt?.getTime() ?? 0))
            : previousAt;
      const event: FunnelEventFact | undefined = sorted.find(
        (candidate) =>
          candidate.stage === stage && (!minimumAt || candidate.occurredAt >= minimumAt),
      );
      if (!event) break;
      previousAt = event.occurredAt;
      if (stage === "paid") paidAt = event.occurredAt;
      if (inPeriod(event.occurredAt, period)) reachedInPeriod[stageIndex]?.add(subjectKey);
    }
  }
  return reachedInPeriod.map((subjects) => subjects.size);
}

function funnelMetrics(
  facts: ReportingFactSet,
  period: ReportPeriod,
  minimumCohortSize: number,
): FunnelStageMetric[] {
  const counts = sequentialFunnelCounts(facts.funnelEvents, period);
  return FUNNEL_STAGES.map((stage, index) => {
    const count = counts[index] ?? 0;
    const prior = index > 0 ? (counts[index - 1] ?? 0) : null;
    return {
      stage,
      reached: metric(
        { value: count, numerator: count, unit: "count", sampleSize: count },
        minimumCohortSize,
      ),
      conversionFromPrior:
        prior === null
          ? null
          : metric(
              {
                value: percent(count, prior),
                numerator: count,
                denominator: prior,
                unit: "percent",
                sampleSize: prior,
              },
              minimumCohortSize,
            ),
    };
  });
}

function distinctCount<T>(items: readonly T[], key: (item: T) => string): number {
  return new Set(items.map(key)).size;
}

function pairedMeasurements<T extends AcademicMeasurementFact | RubricMeasurementFact>(
  items: readonly T[],
  pairKey: (item: T) => string,
): { first: T; latest: T }[] {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = pairKey(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }
  return [...grouped.values()].flatMap((group) => {
    const ordered = [...group].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
    const first = ordered[0];
    const latest = ordered.at(-1);
    return first && latest && first !== latest ? [{ first, latest }] : [];
  });
}

function averageMetric(
  values: readonly number[],
  sampleSize: number,
  unit: MetricUnit,
  minimumCohortSize: number,
): AggregateMetric {
  const sum = values.reduce((total, value) => total + value, 0);
  return metric(
    {
      value: values.length ? sum / values.length : null,
      numerator: values.length ? round(sum) : 0,
      denominator: values.length,
      unit,
      sampleSize,
    },
    minimumCohortSize,
  );
}

function academicMetrics(
  facts: ReportingFactSet,
  minimumCohortSize: number,
): ReportingSnapshot["academic"] {
  const diagnosticPairs = pairedMeasurements(
    facts.academicMeasurements.filter((item) => item.kind === "diagnostic"),
    (item) => `${item.studentKey}:${item.subjectKey}`,
  );
  const diagnosticStudents = distinctCount(diagnosticPairs, (pair) => pair.first.studentKey);
  const baseline = diagnosticPairs.map((pair) => pair.first.percent);
  const followUp = diagnosticPairs.map((pair) => pair.latest.percent);
  const diagnosticChanges = diagnosticPairs.map((pair) => pair.latest.percent - pair.first.percent);

  const assessmentPairs = pairedMeasurements(
    facts.academicMeasurements,
    (item) => `${item.studentKey}:${item.subjectKey}`,
  );
  const assessmentStudents = distinctCount(assessmentPairs, (pair) => pair.first.studentKey);
  const rubricPairs = pairedMeasurements(
    facts.rubricMeasurements,
    (item) => `${item.studentKey}:${item.criterionKey}`,
  );
  const rubricStudents = distinctCount(rubricPairs, (pair) => pair.first.studentKey);

  const milestoneCompleted = facts.milestones.filter((item) => item.completed).length;
  const milestoneStudents = distinctCount(facts.milestones, (item) => item.studentKey);
  const completedPlanItems = facts.planProgress.reduce(
    (total, item) => total + item.completedItems,
    0,
  );
  const totalPlanItems = facts.planProgress.reduce((total, item) => total + item.totalItems, 0);
  const planStudents = distinctCount(facts.planProgress, (item) => item.studentKey);
  const schoolStudents = distinctCount(facts.schoolPerformance, (item) => item.studentKey);

  return {
    baselineScore: averageMetric(baseline, diagnosticStudents, "percent", minimumCohortSize),
    followUpScore: averageMetric(followUp, diagnosticStudents, "percent", minimumCohortSize),
    baselineToFollowUpChange: averageMetric(
      diagnosticChanges,
      diagnosticStudents,
      "percentage_points",
      minimumCohortSize,
    ),
    milestoneCompletionRate: metric(
      {
        value: percent(milestoneCompleted, facts.milestones.length),
        numerator: milestoneCompleted,
        denominator: facts.milestones.length,
        unit: "percent",
        sampleSize: milestoneStudents,
      },
      minimumCohortSize,
    ),
    planProgressRate: metric(
      {
        value: percent(completedPlanItems, totalPlanItems),
        numerator: completedPlanItems,
        denominator: totalPlanItems,
        unit: "percent",
        sampleSize: planStudents,
      },
      minimumCohortSize,
    ),
    accuracyTrend: averageMetric(
      assessmentPairs.map((pair) => pair.latest.percent - pair.first.percent),
      assessmentStudents,
      "percentage_points",
      minimumCohortSize,
    ),
    rubricImprovement: averageMetric(
      rubricPairs.map((pair) => pair.latest.percent - pair.first.percent),
      rubricStudents,
      "percentage_points",
      minimumCohortSize,
    ),
    selfReportedSchoolPerformance: averageMetric(
      facts.schoolPerformance.map((item) => item.percent),
      schoolStudents,
      "percent",
      minimumCohortSize,
    ),
    selfReportedSchoolPerformanceLabel: "Self-reported school performance",
  };
}

function marginMetrics(facts: ReportingFactSet, minimumCohortSize: number): MoneyMetric[] {
  const byCurrency = new Map<string, { margin: number; lessons: number }>();
  for (const lesson of facts.lessons) {
    if (
      lesson.status !== "completed" ||
      lesson.revenueMinor === null ||
      lesson.tutorCostMinor === null ||
      !lesson.currency
    ) {
      continue;
    }
    const totals = byCurrency.get(lesson.currency) ?? { margin: 0, lessons: 0 };
    totals.margin += lesson.revenueMinor - lesson.tutorCostMinor;
    totals.lessons += 1;
    byCurrency.set(lesson.currency, totals);
  }
  return [...byCurrency.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, totals]) => ({
      ...metric(
        {
          value: totals.margin / totals.lessons,
          numerator: totals.margin,
          denominator: totals.lessons,
          unit: "minor_currency_units",
          sampleSize: totals.lessons,
        },
        minimumCohortSize,
      ),
      currency,
    }));
}

function operationalMetrics(
  facts: ReportingFactSet,
  minimumCohortSize: number,
): ReportingSnapshot["operational"] {
  const dueLessons = facts.lessons.filter((lesson) => lesson.status !== "rescheduled");
  const tutorExpected = dueLessons.filter(
    (lesson) => lesson.tutorExpected && lesson.status !== "canceled",
  );
  const tutorAttended = tutorExpected.filter((lesson) => lesson.tutorAttended).length;
  const studentPlaces = dueLessons
    .filter((lesson) => lesson.status !== "canceled")
    .reduce((total, lesson) => total + lesson.expectedStudentCount, 0);
  const studentAttended = dueLessons
    .filter((lesson) => lesson.status !== "canceled")
    .reduce((total, lesson) => total + lesson.attendedStudentCount, 0);
  const completed = facts.lessons.filter((lesson) => lesson.status === "completed");
  const missingFeedback = completed.filter((lesson) => !lesson.hasPublishedFeedback).length;
  const cancellations = dueLessons.filter((lesson) => lesson.status === "canceled").length;
  const resolved = facts.supportTickets.filter((ticket) => ticket.resolvedAt !== null);
  const resolutionHours = resolved.map(
    (ticket) =>
      ((ticket.resolvedAt?.getTime() ?? ticket.openedAt.getTime()) - ticket.openedAt.getTime()) /
      3_600_000,
  );
  const deliveredMinutes = completed.reduce((total, lesson) => total + lesson.scheduledMinutes, 0);
  const availableMinutes = facts.capacity.reduce((total, item) => total + item.availableMinutes, 0);
  const completedOrFailedPayments = facts.paymentAttempts.filter(
    (payment) => payment.status === "succeeded" || payment.status === "failed",
  );
  const successfulPayments = facts.paymentAttempts.filter(
    (payment) => payment.status === "succeeded",
  );
  const failedPayments = completedOrFailedPayments.filter(
    (payment) => payment.status === "failed",
  ).length;
  const completedRefunds = facts.refunds.filter((refund) => refund.status === "completed").length;

  return {
    tutorAttendanceRate: metric(
      {
        value: percent(tutorAttended, tutorExpected.length),
        numerator: tutorAttended,
        denominator: tutorExpected.length,
        unit: "percent",
        sampleSize: tutorExpected.length,
      },
      minimumCohortSize,
    ),
    studentAttendanceRate: metric(
      {
        value: percent(studentAttended, studentPlaces),
        numerator: studentAttended,
        denominator: studentPlaces,
        unit: "percent",
        sampleSize: studentPlaces,
      },
      minimumCohortSize,
    ),
    missingFeedbackRate: metric(
      {
        value: percent(missingFeedback, completed.length),
        numerator: missingFeedback,
        denominator: completed.length,
        unit: "percent",
        sampleSize: completed.length,
      },
      minimumCohortSize,
    ),
    cancellationRate: metric(
      {
        value: percent(cancellations, dueLessons.length),
        numerator: cancellations,
        denominator: dueLessons.length,
        unit: "percent",
        sampleSize: dueLessons.length,
      },
      minimumCohortSize,
    ),
    supportResolutionRate: metric(
      {
        value: percent(resolved.length, facts.supportTickets.length),
        numerator: resolved.length,
        denominator: facts.supportTickets.length,
        unit: "percent",
        sampleSize: facts.supportTickets.length,
      },
      minimumCohortSize,
    ),
    supportResolutionHours: averageMetric(
      resolutionHours,
      resolved.length,
      "hours",
      minimumCohortSize,
    ),
    utilizationRate: metric(
      {
        value: percent(deliveredMinutes, availableMinutes),
        numerator: deliveredMinutes,
        denominator: availableMinutes,
        unit: "percent",
        sampleSize: completed.length,
      },
      minimumCohortSize,
    ),
    marginPerLesson: marginMetrics(facts, minimumCohortSize),
    paymentFailureRate: metric(
      {
        value: percent(failedPayments, completedOrFailedPayments.length),
        numerator: failedPayments,
        denominator: completedOrFailedPayments.length,
        unit: "percent",
        sampleSize: completedOrFailedPayments.length,
      },
      minimumCohortSize,
    ),
    refundRate: metric(
      {
        value: percent(completedRefunds, successfulPayments.length),
        numerator: completedRefunds,
        denominator: successfulPayments.length,
        unit: "percent",
        sampleSize: successfulPayments.length,
      },
      minimumCohortSize,
    ),
  };
}

export interface GenerateReportOptions {
  cadence: ReportingCadence;
  period: ReportPeriod;
  generatedAt?: Date;
  minimumCohortSize?: number;
}

export function generateReportingSnapshot(
  facts: ReportingFactSet,
  options: GenerateReportOptions,
): ReportingSnapshot {
  const minimumCohortSize = options.minimumCohortSize ?? MINIMUM_REPORTING_COHORT_SIZE;
  if (!Number.isInteger(minimumCohortSize) || minimumCohortSize < 1) {
    throw new Error("minimumCohortSize must be a positive integer.");
  }
  return {
    schemaVersion: 1,
    cadence: options.cadence,
    period: {
      start: options.period.start.toISOString(),
      end: options.period.end.toISOString(),
      timezone: "UTC",
    },
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    privacy: {
      firstPartyOnly: true,
      minimumCohortSize,
      containsDirectIdentifiers: false,
      advertisingProfileCombined: false,
    },
    funnel: {
      stages: funnelMetrics(facts, options.period, minimumCohortSize),
    },
    operational: operationalMetrics(facts, minimumCohortSize),
    academic: academicMetrics(facts, minimumCohortSize),
  };
}
