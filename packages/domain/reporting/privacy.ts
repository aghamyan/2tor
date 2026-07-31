import { ReportingError } from "./errors";
import type { FunnelEventFact, FunnelStage } from "./models";

export const MINIMUM_REPORTING_COHORT_SIZE = 5;

/**
 * Fields that are incompatible with the analytics boundary even when nested in an otherwise
 * acceptable payload. Matching is normalized so casing, hyphens, and underscores cannot bypass it.
 */
export const FORBIDDEN_ANALYTICS_FIELDS = [
  "adid",
  "advertisingid",
  "advertisingprofile",
  "idfa",
  "gaid",
  "gclid",
  "fbclid",
  "devicefingerprint",
  "latitude",
  "longitude",
  "preciselocation",
  "biometric",
  "faceprint",
  "voiceprint",
  "scroll",
  "dwelltime",
  "attention",
  "engagementscore",
] as const;

const stageSet = new Set<FunnelStage>([
  "visitor",
  "consultation",
  "trial",
  "paid",
  "retained_30d",
  "retained_90d",
]);

function normalizedField(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function inspectFields(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectFields(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedField(key);
    if (FORBIDDEN_ANALYTICS_FIELDS.some((field) => normalized.includes(field))) {
      throw new ReportingError(
        "FORBIDDEN_ANALYTICS_FIELD",
        `Analytics field "${path}.${key}" is outside the first-party privacy boundary.`,
        422,
      );
    }
    inspectFields(child, `${path}.${key}`);
  }
}

export interface FunnelEventInput {
  accountContext: "adult_or_unknown" | "child";
  subjectKey: string;
  stage: FunnelStage;
  occurredAt: string;
}

/**
 * Product-funnel collection is unavailable to child accounts. Academic records are aggregated
 * separately from transactional learning data and never pass through this event collector.
 */
export function parsePrivacySafeFunnelEvent(input: unknown): FunnelEventFact {
  inspectFields(input);
  if (typeof input !== "object" || input === null) {
    throw new ReportingError("INVALID_EVENT", "A reporting event object is required.");
  }

  const candidate = input as Partial<FunnelEventInput>;
  if (candidate.accountContext === "child") {
    throw new ReportingError(
      "CHILD_PRODUCT_ANALYTICS_DISABLED",
      "Product analytics collection is disabled for child accounts.",
      403,
    );
  }
  if (candidate.accountContext !== "adult_or_unknown") {
    throw new ReportingError("INVALID_ACCOUNT_CONTEXT", "A valid account context is required.");
  }
  if (
    typeof candidate.subjectKey !== "string" ||
    !/^[A-Za-z0-9_-]{20,96}$/.test(candidate.subjectKey)
  ) {
    throw new ReportingError(
      "INVALID_SUBJECT_KEY",
      "Use a 20–96 character rotating, one-way first-party subject key.",
    );
  }
  if (!candidate.stage || !stageSet.has(candidate.stage)) {
    throw new ReportingError("INVALID_FUNNEL_STAGE", "A valid funnel stage is required.");
  }
  if (typeof candidate.occurredAt !== "string") {
    throw new ReportingError("INVALID_EVENT_TIME", "An ISO event timestamp is required.");
  }
  const occurredAt = new Date(candidate.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new ReportingError("INVALID_EVENT_TIME", "The event timestamp is invalid.");
  }

  return {
    subjectKey: candidate.subjectKey,
    stage: candidate.stage,
    occurredAt,
  };
}
