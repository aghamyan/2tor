# Backup and restore runbook

**Last drill:** 2026-07-29  
**Drill result:** PASS for a real PostgreSQL restore into a new test database  
**Production-backup readiness:** NOT YET EVIDENCED

This runbook implements the private-beta recovery requirements in spec §12.7: an encrypted
PostgreSQL backup every six hours, a daily full backup, 30-day rolling retention, weekly copies for
three months, an encrypted off-server copy, and a monthly restore test. The private-beta targets
are RPO ≤ 6 hours and RTO ≤ 8 hours.

## Verified restore drill — 2026-07-29

The drill used PostgreSQL 16 in the repository's isolated `docker-compose.test.yml` environment.
It migrated and seeded `app_test`, created a real custom-format `pg_dump`, restored it with
`pg_restore` into a newly created database named `app_restore_gate_20260729`, and compared the
source and restore.

| Evidence                            | Recorded value                                                              |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Repository revision                 | `ee4678bfb2fe17b58430ffb7a0138cb81dc88866`                                  |
| Drill start (UTC)                   | `2026-07-29T00:35:57Z`                                                      |
| Drill completion (UTC)              | `2026-07-29T00:35:58Z`                                                      |
| Measured restore-drill elapsed time | 1 second                                                                    |
| Source / restored database          | `app_test` / `app_restore_gate_20260729`                                    |
| Dump format and size                | PostgreSQL custom format, 321,522 bytes                                     |
| Dump SHA-256                        | `b57f4ec91809587b7d57326d60152961d3299556cb15090d81ff841540b71e53`          |
| Public tables                       | 123 source / 123 restored                                                   |
| Total rows                          | 43 source / 43 restored                                                     |
| Per-table row-count manifest        | Exact match                                                                 |
| Sentinel                            | `usr_demo_parent` restored with `parent@example.com`                        |
| Normalized schema SHA-256           | `ba824c7b70848fb59ebd9bf9885f10ee103b9d0878b36b4bda19c076505dcefa` for both |
| Normalized schema diff              | 0 lines                                                                     |

Raw schema-only dump hashes differed because each `pg_dump` adds a random `\restrict` /
`\unrestrict` token. Excluding only those two generated control lines produced the identical hash
shown above. No schema statements were excluded.

This proves that the current schema and seeded test data can be backed up and restored into a fresh
database. It does **not** prove that production backup scheduling, encryption, off-server
replication, retention, access control, monitoring, or the production dataset are correct. Those
are separate pre-launch checks in [LAUNCH_GATES.md](./LAUNCH_GATES.md).

## Monthly restore procedure

Run this only from an approved recovery host against an approved non-production target.

1. Open an incident/change record and record the operator, source backup identifier, backup
   timestamp, source environment, target database, and expected RPO.
2. Verify the backup is from the intended environment, is encrypted, is stored off-server, and its
   checksum matches the backup catalog. Never restore over an existing database.
3. Create a fresh, access-restricted restore target. Confirm its name and connection string twice.
4. Restore with the PostgreSQL major version used to create the backup:

   ```sh
   createdb "$RESTORE_DATABASE"
   pg_restore --exit-on-error --no-owner --no-privileges \
     --dbname "$RESTORE_DATABASE_URL" "$BACKUP_FILE"
   ```

5. Compare source/catalog expectations with the restore:

   - migration/version table and schema objects;
   - table count and row-count manifest;
   - representative foreign-key joins;
   - a non-sensitive sentinel account or fixture;
   - append-only audit triggers;
   - application read-only smoke checks.

6. Record restore start/end UTC timestamps, checksum, backup age, RPO, measured RTO, validation
   output, and any exceptions. Store the evidence in the incident/change record.
7. Destroy the isolated restore target according to the approved data-handling procedure.
8. Escalate a failed checksum, failed restore, missing object, manifest difference, or RPO/RTO miss
   as a P0 recovery-control incident under [RUNBOOK_INCIDENT.md](./RUNBOOK_INCIDENT.md).

Use task-specific variables such as `RESTORE_DATABASE` and `RESTORE_DATABASE_URL`; never reuse
`HOME` or point a destructive command at a server-wide or unresolved target.

## Production evidence required before GO

- Backup job logs show encrypted backups at least every six hours.
- A daily full, 30-day rolling retention, weekly three-month retention, and an encrypted
  off-server copy are configured and access-restricted.
- Backup age, job failures, checksum failures, and restore-verification failures alert the on-call
  owner.
- A production-derived backup has been restored into an isolated test environment and validated
  without exposing personal data.
- The measured drill meets RPO ≤ 6 hours and RTO ≤ 8 hours.
- A named owner and monthly calendar recurrence exist; missed drills block release.

The founder/infrastructure owner must supply this deployment evidence. The 2026-07-29 repository
drill closes the “backup restored in test” implementation gate, but not the production operations
gate.
