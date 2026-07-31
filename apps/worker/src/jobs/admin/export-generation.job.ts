import { createDb } from "@app/db";
import { createDrizzleAuditStore, recordAudit } from "@app/audit";

import { createDrizzleAdministrationDatabase } from "../../../../../packages/domain/administration/drizzle-database";
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
        value.limit <= 100)),
);

const EXPORT_EXPIRY_DAYS = 7;

/**
 * Materializes every `exports` row a second administrator has already approved
 * (`status: "processing"`, set by `decideBulkExport` — see
 * `packages/domain/administration/services.ts`). **File generation/upload itself is a placeholder**
 * — this job assigns a deterministic `file_key` and marks the row `"completed"` with a 7-day
 * `expires_at`, but does not query `type`/`filters` to build a real CSV/JSON payload or upload it
 * to S3/MinIO. Wiring the actual query-per-export-type + `@aws-sdk/client-s3` upload (mirroring
 * `packages/domain/communication/storage.ts`'s `createS3CommunicationStorage` pattern) is the next
 * step before this is production-ready; what this job proves today is the queue-draining +
 * audit-trail shape every completed export needs.
 */
export default defineJob({
  name: "admin.export-generation",
  queue: "admin",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for export generation.");
    const db = createDb(databaseUrl);
    const administrationDatabase = createDrizzleAdministrationDatabase(db);
    const auditStore = createDrizzleAuditStore(db);

    const limit = data.limit ?? 25;
    const processing = (await administrationDatabase.listExports())
      .filter((exportRecord) => exportRecord.status === "processing")
      .slice(0, limit);

    for (const exportRecord of processing) {
      const fileKey = `exports/${exportRecord.id}/${crypto.randomUUID()}.json`;
      const expiresAt = new Date(Date.now() + EXPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await administrationDatabase.setExportDecision(exportRecord.id, {
        status: "completed",
        fileKey,
        expiresAt,
      });

      await recordAudit(auditStore, {
        actorUserId: null,
        action: "export.generated",
        resourceType: "exports",
        resourceId: exportRecord.id,
        reason: "Export worker materialized the approved export.",
        previousValue: { status: "processing" },
        newValue: { status: "completed", fileKey },
      });
    }

    context.log.info(
      { checked: processing.length, completed: processing.length },
      "export generation run completed",
    );
  },
  options: {
    repeat: { pattern: "*/15 * * * *" },
    repeatPayload: { limit: 25 },
  },
});
