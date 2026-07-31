export type ReportingCadence = "weekly" | "monthly";
export type ReportingRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface ReportingActor {
  userId: string;
  roles: readonly ReportingRole[];
}

export interface ReportPeriod {
  /** Inclusive UTC boundary. */
  start: Date;
  /** Exclusive UTC boundary. */
  end: Date;
}

export const FUNNEL_STAGES = [
  "visitor",
  "consultation",
  "trial",
  "paid",
  "retained_30d",
  "retained_90d",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/**
 * A rotating, one-way first-party subject key joins legitimate product events.
 * It is not an advertising identifier and must not be shared with another service.
 */
export interface FunnelEventFact {
  subjectKey: string;
  stage: FunnelStage;
  occurredAt: Date;
}

export interface LessonFact {
  lessonKey: string;
  occurredAt: Date;
  status:
    "scheduled" | "completed" | "canceled" | "no_show_student" | "no_show_tutor" | "rescheduled";
  scheduledMinutes: number;
  expectedStudentCount: number;
  attendedStudentCount: number;
  tutorExpected: boolean;
  tutorAttended: boolean;
  hasPublishedFeedback: boolean;
  revenueMinor: number | null;
  tutorCostMinor: number | null;
  currency: string | null;
}

export interface CapacityFact {
  occurredAt: Date;
  availableMinutes: number;
}

export interface SupportTicketFact {
  openedAt: Date;
  resolvedAt: Date | null;
}

export interface PaymentAttemptFact {
  occurredAt: Date;
  status: "succeeded" | "failed" | "pending" | "canceled";
}

export interface RefundFact {
  occurredAt: Date;
  status: "completed" | "pending" | "processing" | "failed";
}

export interface AcademicMeasurementFact {
  studentKey: string;
  subjectKey: string;
  measuredAt: Date;
  percent: number;
  kind: "diagnostic" | "assessment";
}

export interface MilestoneFact {
  studentKey: string;
  occurredAt: Date;
  completed: boolean;
}

export interface PlanProgressFact {
  studentKey: string;
  occurredAt: Date;
  completedItems: number;
  totalItems: number;
}

export interface RubricMeasurementFact {
  studentKey: string;
  criterionKey: string;
  measuredAt: Date;
  percent: number;
}

export interface SchoolPerformanceFact {
  studentKey: string;
  measuredAt: Date;
  /** Self-reported value normalized to 0–100; it is never presented as an observed grade. */
  percent: number;
}

export interface ReportingFactSet {
  funnelEvents: readonly FunnelEventFact[];
  lessons: readonly LessonFact[];
  capacity: readonly CapacityFact[];
  supportTickets: readonly SupportTicketFact[];
  paymentAttempts: readonly PaymentAttemptFact[];
  refunds: readonly RefundFact[];
  academicMeasurements: readonly AcademicMeasurementFact[];
  milestones: readonly MilestoneFact[];
  planProgress: readonly PlanProgressFact[];
  rubricMeasurements: readonly RubricMeasurementFact[];
  schoolPerformance: readonly SchoolPerformanceFact[];
}

export type MetricUnit =
  "count" | "percent" | "percentage_points" | "hours" | "minutes" | "minor_currency_units";

export interface AggregateMetric {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  unit: MetricUnit;
  suppressed: boolean;
  sampleSize: number | null;
}

export interface FunnelStageMetric {
  stage: FunnelStage;
  reached: AggregateMetric;
  conversionFromPrior: AggregateMetric | null;
}

export interface MoneyMetric extends AggregateMetric {
  currency: string;
}

export interface ReportingSnapshot {
  schemaVersion: 1;
  cadence: ReportingCadence;
  period: {
    start: string;
    end: string;
    timezone: "UTC";
  };
  generatedAt: string;
  privacy: {
    firstPartyOnly: true;
    minimumCohortSize: number;
    containsDirectIdentifiers: false;
    advertisingProfileCombined: false;
  };
  funnel: {
    stages: FunnelStageMetric[];
  };
  operational: {
    tutorAttendanceRate: AggregateMetric;
    studentAttendanceRate: AggregateMetric;
    missingFeedbackRate: AggregateMetric;
    cancellationRate: AggregateMetric;
    supportResolutionRate: AggregateMetric;
    supportResolutionHours: AggregateMetric;
    utilizationRate: AggregateMetric;
    marginPerLesson: MoneyMetric[];
    paymentFailureRate: AggregateMetric;
    refundRate: AggregateMetric;
  };
  academic: {
    baselineScore: AggregateMetric;
    followUpScore: AggregateMetric;
    baselineToFollowUpChange: AggregateMetric;
    milestoneCompletionRate: AggregateMetric;
    planProgressRate: AggregateMetric;
    accuracyTrend: AggregateMetric;
    rubricImprovement: AggregateMetric;
    selfReportedSchoolPerformance: AggregateMetric;
    selfReportedSchoolPerformanceLabel: "Self-reported school performance";
  };
}

export interface StoredReportingSnapshot {
  reportKey: string;
  snapshot: ReportingSnapshot;
}

export interface ReportingRepository {
  loadFacts(period: ReportPeriod): Promise<ReportingFactSet>;
  getStoredReport(reportKey: string): Promise<ReportingSnapshot | null>;
  saveReport(reportKey: string, snapshot: ReportingSnapshot): Promise<void>;
  recordFunnelEvent(event: FunnelEventFact): Promise<void>;
}
