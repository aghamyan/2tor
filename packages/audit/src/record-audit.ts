import { ulid } from "ulid";

import { recordAuditInputSchema, type RecordAuditInput } from "./schemas";
import type { AuditEventRecord, AuditStore } from "./types";

/**
 * The canonical way for any module to append an `audit_events` row. Validates the input, mints
 * the id, and inserts it via `store.insertEvent` — which, by construction (see `types.ts`), has
 * no corresponding update/delete method. There is no other function in this package, and no
 * method on `AuditStore`, that can alter or remove a row once `recordAudit` returns.
 *
 * Every module wires this against `createDrizzleAuditStore(db)` at its composition root
 * (`runtime.ts`) and against `createInMemoryAuditStore()` in tests — see `packages/audit/README.md`.
 */
export async function recordAudit(
  store: AuditStore,
  input: RecordAuditInput,
): Promise<AuditEventRecord> {
  const values = recordAuditInputSchema.parse(input);
  return store.insertEvent({ id: ulid(), ...values });
}
