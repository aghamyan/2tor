import { createDb } from "@app/db";
import { createDrizzleAuditStore, recordAudit } from "@app/audit";

import { createDrizzleDeletionExecutor } from "../../../../../packages/domain/administration/deletion-executor";
import { createDrizzleAdministrationDatabase } from "../../../../../packages/domain/administration/drizzle-database";
import { runDeletionJob } from "../../../../../packages/domain/administration/retention";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = { limit?: number };
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.limit === undefined ||
      (typeof value.limit === "number" &&
        Number.isInteger(value.limit) &&
        value.limit >= 1 &&
        value.limit <= 500)),
);

/**
 * Executes every due `deletion_jobs` row (`status: "scheduled"`, `scheduledFor` null or in the
 * past — these are only ever set that way by `decideMassDeletion`, i.e. after a *different*
 * administrator approved the request; see `packages/domain/administration/services.ts`).
 * `runDeletionJob` (`packages/domain/administration/retention.ts`) is the single decision point:
 * a legal-retention or unclassified entity type is left `"blocked"` and the executor above is
 * never invoked for it — an optional-content type is actually deleted via
 * `createDrizzleDeletionExecutor`. Every outcome, blocked or completed, is written back to
 * `deletion_jobs` and recorded as an `audit_events` row with no human actor
 * (`actorUserId: null` — this is a scheduled job, not a staff action).
 *
 * "Deletion ages files out of backups on a documented schedule" (spec) is a backup-retention
 * policy, not something this job enforces directly — see
 * `backup-verification-alert.job.ts` and this module's README for where that's documented.
 */
export default defineJob({
  name: "admin.retention-deletion",
  queue: "admin",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for retention deletion.");
    const db = createDb(databaseUrl);
    const administrationDatabase = createDrizzleAdministrationDatabase(db);
    const auditStore = createDrizzleAuditStore(db);
    const executor = createDrizzleDeletionExecutor(db);

    const limit = data.limit ?? 50;
    const now = Date.now();
    // `listDeletionJobs` returns the most recent 100 jobs of any status (see
    // packages/domain/administration/models.ts) — filtered here rather than at the query layer.
    // Fine for MVP volume; a dedicated `status = 'scheduled' AND scheduled_for <= now()` query is
    // the first thing to add once job volume grows past one page.
    const due = (await administrationDatabase.listDeletionJobs())
      .filter(
        (job) =>
          job.status === "scheduled" &&
          (job.scheduledFor === null || job.scheduledFor.getTime() <= now),
      )
      .slice(0, limit);

    let completed = 0;
    let blocked = 0;

    for (const job of due) {
      const outcome = await runDeletionJob(job, executor);

      if (outcome.status === "completed") {
        await administrationDatabase.setDeletionJobStatus(job.id, {
          status: "completed",
          blockReason: null,
          completedAt: outcome.completedAt,
        });
        completed += 1;
      } else {
        await administrationDatabase.setDeletionJobStatus(job.id, {
          status: "blocked",
          blockReason: outcome.blockReason,
        });
        blocked += 1;
      }

      await recordAudit(auditStore, {
        actorUserId: null,
        action: outcome.status === "completed" ? "deletion_job.completed" : "deletion_job.blocked",
        resourceType: "deletion_jobs",
        resourceId: job.id,
        reason:
          outcome.status === "completed"
            ? "Retention worker completed the scheduled deletion."
            : outcome.blockReason,
        previousValue: { status: job.status },
        newValue: { status: outcome.status },
      });
    }

    context.log.info(
      { checked: due.length, completed, blocked },
      "retention deletion run completed",
    );
  },
  options: {
    repeat: { pattern: "0 4 * * *" },
    repeatPayload: { limit: 50 },
  },
});
