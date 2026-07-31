import { createDb, type Database } from "@app/db";
import { sql } from "drizzle-orm";
import { ulid } from "ulid";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Proves the *actual* guarantee behind acceptance criterion 1: not just "this package's own
 * `AuditStore` interface has no update/delete method" (see `record-audit.test.ts`), but that the
 * database itself refuses UPDATE/DELETE against `audit_events`, via the `BEFORE UPDATE OR DELETE`
 * trigger installed by `packages/db/migrations/0001_audit_events_immutable.sql`. That trigger is
 * what makes the guarantee hold even against a client that bypasses this package entirely (a raw
 * SQL console, a different service, a future refactor that adds a method here) — this test talks
 * to Postgres directly with raw SQL for exactly that reason, rather than going through
 * `AuditStore`.
 *
 * Requires a reachable test database (`DATABASE_URL_TEST`, see `.env.example` /
 * `docker-compose.test.yml`); skips cleanly when none is available rather than failing CI runs
 * that don't have Postgres up. The inserted row is deliberately never cleaned up — by design,
 * nothing can delete it, which is exactly the property under test — so run this only against an
 * ephemeral/test database, never prod (see docs/CONVENTIONS.md, "Testing").
 */
const DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:5433/app_test";

describe("audit_events immutability (integration)", () => {
  let db: Database | undefined;

  beforeAll(async () => {
    try {
      const candidate = createDb(DATABASE_URL);
      await candidate.execute(sql`select 1`);
      db = candidate;
    } catch {
      db = undefined;
    }
  });

  it("rejects UPDATE and DELETE against a real audit_events row", async (context) => {
    if (!db) {
      context.skip();
      return;
    }
    const database = db;
    const id = ulid();
    await database.execute(
      sql`insert into audit_events (id, actor_user_id, action, resource_type, resource_id, reason)
          values (${id}, null, 'test.integration', 'audit_events', ${id}, 'immutability integration test row')`,
    );

    await expect(
      database.execute(sql`update audit_events set reason = 'tampered' where id = ${id}`),
    ).rejects.toThrow(/append-only/i);
    await expect(database.execute(sql`delete from audit_events where id = ${id}`)).rejects.toThrow(
      /append-only/i,
    );
  });
});
