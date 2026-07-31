import type { DeletionScope } from "./models";

/**
 * `deletion_jobs.target_entity_type` is a loose pointer (like `admin_access_reasons`/`audit_events`
 * — no DB FK, the target table varies), so the legal/optional split is a hand-maintained catalog,
 * not something derivable from the schema. Legal-retention entity types are records this platform
 * must keep for compliance/financial-audit reasons regardless of a deletion request — consent
 * evidence (`packages/domain/consent/README.md`, "Retention": "never auto-deleted"), money
 * movement, and the safety/verification trail. Optional entity types are educational content a
 * family can ask to have erased outright. Anything not in either list is treated conservatively
 * as `"unknown"` and blocked, not deleted — an unclassified type is a bug to fix (extend one of
 * the lists below), not a reason to guess.
 */
export const LEGAL_RETENTION_ENTITY_TYPES = [
  "consent_records",
  "payment_transactions",
  "invoices",
  "invoice_items",
  "lesson_charges",
  "refunds",
  "tutor_earning_entries",
  "payout_items",
  "payout_batches",
  "tutor_verifications",
  "tutor_documents",
  "tutor_training_records",
  "audit_events",
  "admin_access_reasons",
  "login_events",
] as const;

export const OPTIONAL_CONTENT_ENTITY_TYPES = [
  "bookmarks",
  "resources",
  "resource_links",
  "tutor_content_uploads",
  "discussion_questions",
  "discussion_answers",
  "messages",
  "message_attachments",
  "student_interests",
  "student_preferences",
  "project_files",
  "assignment_submissions",
  "matching_notes",
] as const;

export type RetentionClassification = "legal" | "optional" | "unknown";

export function classifyRetention(targetEntityType: string): RetentionClassification {
  if ((LEGAL_RETENTION_ENTITY_TYPES as readonly string[]).includes(targetEntityType))
    return "legal";
  if ((OPTIONAL_CONTENT_ENTITY_TYPES as readonly string[]).includes(targetEntityType))
    return "optional";
  return "unknown";
}

export interface DeletionJobInput {
  targetEntityType: string;
  targetEntityId: string;
  scope: DeletionScope;
}

/** Performs the actual erase/anonymize for one entity. Never called for a `"legal"` or `"unknown"` classification. */
export interface DeletionExecutor {
  deleteEntity(input: DeletionJobInput): Promise<void>;
}

export type DeletionJobOutcome =
  { status: "completed"; completedAt: Date } | { status: "blocked"; blockReason: string };

/**
 * Pure decision + effect function: classify, then either block (legal/unknown — the executor is
 * never invoked, so a legal record cannot be removed no matter what the executor implementation
 * does) or delegate to `executor.deleteEntity` and report completion. This is what
 * `apps/worker/src/jobs/admin/retention-deletion.job.ts` calls for every due `deletion_jobs` row,
 * and what "Deletion job preserves legal records and removes optional content" is tested against
 * directly (see `apps/web/tests/admin/retention.test.ts`) with a recording in-memory executor —
 * no database required.
 */
export async function runDeletionJob(
  job: DeletionJobInput,
  executor: DeletionExecutor,
  now: Date = new Date(),
): Promise<DeletionJobOutcome> {
  const classification = classifyRetention(job.targetEntityType);

  if (classification === "legal") {
    return { status: "blocked", blockReason: `legal_retention_required:${job.targetEntityType}` };
  }
  if (classification === "unknown") {
    return { status: "blocked", blockReason: `unclassified_entity_type:${job.targetEntityType}` };
  }

  await executor.deleteEntity(job);
  return { status: "completed", completedAt: now };
}
