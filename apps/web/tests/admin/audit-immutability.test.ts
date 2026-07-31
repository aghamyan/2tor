import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Acceptance criterion: "Audit rows cannot be updated/deleted through the app." Two layers back
 * this, tested in two different places for two different reasons:
 *
 * 1. `packages/audit/src/record-audit.test.ts` proves the `AuditStore` interface itself exposes
 *    no update/delete method — no code path in `@app/audit` can reach one.
 * 2. This test proves the *database itself* rejects UPDATE/DELETE regardless of what calls it —
 *    the actual guarantee, since `AuditStore` merely not offering a method wouldn't stop a raw
 *    SQL client, a future refactor, or a different service from mutating the table directly.
 *    `packages/audit/src/immutability.integration.test.ts` proves this against a real Postgres
 *    (skipped when unreachable); this test is the DB-independent complement — it fails if the
 *    migration file is ever edited to remove or weaken the trigger, without needing Postgres up.
 */
describe("audit_events immutability migration", () => {
  it("installs a BEFORE UPDATE OR DELETE trigger on audit_events that unconditionally rejects both", async () => {
    const path = fileURLToPath(
      new URL(
        "../../../../packages/db/migrations/0001_audit_events_immutable.sql",
        import.meta.url,
      ),
    );
    const sql = await readFile(path, "utf8");

    expect(sql).toMatch(/CREATE TRIGGER\s+audit_events_no_update/i);
    expect(sql).toMatch(/BEFORE UPDATE ON "audit_events"/i);
    expect(sql).toMatch(/CREATE TRIGGER\s+audit_events_no_delete/i);
    expect(sql).toMatch(/BEFORE DELETE ON "audit_events"/i);
    expect(sql).toMatch(/RAISE EXCEPTION/i);
    // No conditional (WHEN clause) narrowing the trigger to specific roles/columns — it must
    // fire for every UPDATE/DELETE attempt, unconditionally.
    expect(sql).not.toMatch(/WHEN\s*\(/i);
  });
});
