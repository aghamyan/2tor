import type {
  AdminAccessReasonRecord,
  AuditEventRecord,
  AuditQueryFilters,
  AuditQueryPage,
  AuditStore,
  InsertAdminAccessReasonValues,
  InsertAuditEventValues,
} from "./types";

function paginate(events: AuditEventRecord[], filters: AuditQueryFilters): AuditQueryPage {
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));

  const filtered = events
    .filter(
      (event) => filters.actorUserId === undefined || event.actorUserId === filters.actorUserId,
    )
    .filter((event) => filters.action === undefined || event.action === filters.action)
    .filter(
      (event) => filters.resourceType === undefined || event.resourceType === filters.resourceType,
    )
    .filter((event) => filters.resourceId === undefined || event.resourceId === filters.resourceId)
    .filter((event) => filters.from === undefined || event.createdAt >= filters.from)
    .filter((event) => filters.to === undefined || event.createdAt <= filters.to)
    // Newest first, matching the drizzle adapter's `orderBy(desc(id))` — ULIDs sort lexicographically
    // by creation time, so id order and createdAt order agree.
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
    .filter((event) => filters.cursor === undefined || event.id < filters.cursor);

  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  return { items: page, nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
}

/**
 * Pure, in-process `AuditStore` for unit tests (see `approval.test.ts`) — no Postgres required.
 * Exposes no update/delete method, same as the real drizzle-backed store: this is what makes the
 * self-approval and immutability guarantees in `approval.ts`/`record-audit.ts` testable against
 * the *real* logic rather than a hand-rolled fake of the whole port (see README, "Testing").
 */
export function createInMemoryAuditStore(): AuditStore {
  const events: AuditEventRecord[] = [];
  const accessReasons: AdminAccessReasonRecord[] = [];

  function repository(): AuditStore {
    return {
      async transaction<T>(operation: (store: AuditStore) => Promise<T>): Promise<T> {
        // No real transactional isolation needed for an in-process array — operations are
        // synchronous with respect to each other since nothing here awaits external I/O.
        return operation(repository());
      },

      async insertEvent(values: InsertAuditEventValues): Promise<AuditEventRecord> {
        const record: AuditEventRecord = {
          id: values.id,
          actorUserId: values.actorUserId,
          action: values.action,
          resourceType: values.resourceType,
          resourceId: values.resourceId ?? null,
          reason: values.reason ?? null,
          previousValue: values.previousValue ?? null,
          newValue: values.newValue ?? null,
          ipAddress: values.ipAddress ?? null,
          createdAt: new Date(),
        };
        events.push(record);
        return record;
      },

      async findEventById(id: string): Promise<AuditEventRecord | null> {
        return events.find((event) => event.id === id) ?? null;
      },

      async findDecisionForRequest(approvalRequestId: string): Promise<AuditEventRecord | null> {
        const matches = events.filter(
          (event) =>
            event.action === "approval.decided" &&
            event.resourceType === "approval_request" &&
            event.resourceId === approvalRequestId,
        );
        return matches.at(-1) ?? null;
      },

      async queryEvents(filters: AuditQueryFilters): Promise<AuditQueryPage> {
        return paginate(events, filters);
      },

      async insertAdminAccessReason(
        values: InsertAdminAccessReasonValues,
      ): Promise<AdminAccessReasonRecord> {
        const record: AdminAccessReasonRecord = {
          id: values.id,
          adminUserId: values.adminUserId,
          targetEntityType: values.targetEntityType,
          targetEntityId: values.targetEntityId,
          reason: values.reason,
          accessedAt: values.accessedAt ?? new Date(),
        };
        accessReasons.push(record);
        return record;
      },
    };
  }

  return repository();
}
