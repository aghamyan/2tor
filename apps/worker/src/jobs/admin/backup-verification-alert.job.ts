import { createDb } from "@app/db";
import { createDrizzleAuditStore, recordAudit as auditRecordAudit } from "@app/audit";

import { createDrizzleAdministrationDatabase } from "../../../../../packages/domain/administration/drizzle-database";
import { raiseSystemIncident } from "../../../../../packages/domain/administration/services";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";

type Payload = Record<string, never>;
const schema = objectSchema<Payload>((value): value is Payload => isObject(value));

/** `system_settings.key` a backup-verification process is expected to update after each successful run. */
const BACKUP_LAST_VERIFIED_SETTING_KEY = "backup.last_verified_at";
/**
 * How stale the last verification signal may be before this raises an incident. Deliberately
 * longer than the presumed backup cadence so a single delayed run doesn't page anyone — tune once
 * the real backup schedule (spec: "deletion ages files out of backups on a documented schedule")
 * is decided; this job only *alerts on silence*, it doesn't run or verify backups itself.
 */
const STALE_THRESHOLD_HOURS = 48;

/**
 * Spec §16.4-adjacent requirement: staff must be alerted if backup verification stops happening,
 * since that's exactly the signal that would reveal a retention-deletion job "succeeding" on the
 * live database while a stale backup silently keeps the deleted data around past its documented
 * retention window. This job does not perform or verify backups itself — it only checks that
 * *something else* recently claimed to have, via `system_settings['backup.last_verified_at']`
 * (`AdministrationDatabase.findSystemSetting`), and raises an `incidents` row
 * (`severity: "high"`, via `raiseSystemIncident`) plus an audit event when that signal is missing
 * or older than `STALE_THRESHOLD_HOURS`. Wiring the real verification producer (an
 * infrastructure-level backup job writing this setting after each successful, checksum-verified
 * backup) is outside this module's file scope — see `packages/domain/administration/README.md`.
 */
export default defineJob({
  name: "admin.backup-verification-alert",
  queue: "admin",
  schema,
  async handler(_data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl)
      throw new Error("DATABASE_URL is required for the backup-verification alert.");
    const db = createDb(databaseUrl);
    const administrationDatabase = createDrizzleAdministrationDatabase(db);
    const auditStore = createDrizzleAuditStore(db);
    const audit = {
      async recordAudit(values: Parameters<typeof auditRecordAudit>[1]) {
        await auditRecordAudit(auditStore, values);
      },
    };

    const setting = await administrationDatabase.findSystemSetting(
      BACKUP_LAST_VERIFIED_SETTING_KEY,
    );
    const lastVerifiedAt =
      setting && typeof setting.value === "string" ? new Date(setting.value) : null;
    const staleMs = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
    const isStale =
      !lastVerifiedAt ||
      Number.isNaN(lastVerifiedAt.getTime()) ||
      Date.now() - lastVerifiedAt.getTime() > staleMs;

    if (!isStale) {
      context.log.info(
        { lastVerifiedAt },
        "backup verification signal is current; no alert raised",
      );
      return;
    }

    const description = lastVerifiedAt
      ? `Last verified at ${lastVerifiedAt.toISOString()}, older than ${STALE_THRESHOLD_HOURS}h.`
      : `No "${BACKUP_LAST_VERIFIED_SETTING_KEY}" system setting has ever been recorded.`;

    const incident = await raiseSystemIncident(administrationDatabase, audit, {
      title: "Backup verification signal is missing or stale",
      description,
      severity: "high",
      relatedEntityType: "system_settings",
      relatedEntityId: BACKUP_LAST_VERIFIED_SETTING_KEY,
    });

    context.log.warn(
      { incidentId: incident.id, lastVerifiedAt },
      "backup verification alert raised",
    );
  },
  options: {
    repeat: { pattern: "0 * * * *" },
  },
});
