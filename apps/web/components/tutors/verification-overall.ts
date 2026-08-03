import type { TutorSuspensionRecord, TutorVerificationRecord } from "../../../../packages/domain/tutors/models";

export type OverallVerificationStatus =
  | "restricted"
  | "notStarted"
  | "actionRequired"
  | "inProgress"
  | "verified";

/** Shared by `VerificationStatus` (the timeline card) and `ProfileCompletionCard` (the summary
 * badge), so the two never disagree about what "verified" means. */
export function overallVerificationStatus(
  verifications: readonly TutorVerificationRecord[],
  suspensions: readonly TutorSuspensionRecord[],
  now = new Date(),
): OverallVerificationStatus {
  const hasActiveSuspension = suspensions.some(
    (suspension) => !suspension.liftedAt && (!suspension.endAt || suspension.endAt > now),
  );
  if (hasActiveSuspension) return "restricted";
  if (verifications.length === 0) return "notStarted";
  if (verifications.some((record) => record.status === "failed")) return "actionRequired";
  if (verifications.some((record) => record.status === "pending")) return "inProgress";
  const hasExpired = verifications.some(
    (record) => record.status === "passed" && record.expiresAt && record.expiresAt < now,
  );
  return hasExpired ? "actionRequired" : "verified";
}
