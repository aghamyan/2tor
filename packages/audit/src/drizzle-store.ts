import { adminAccessReasons, auditEvents, type Database, type Transaction } from "@app/db";
import { and, desc, eq, gte, lte, lt, type SQL } from "drizzle-orm";

import type {
  AdminAccessReasonRecord,
  AuditEventRecord,
  AuditQueryFilters,
  AuditQueryPage,
  AuditStore,
  InsertAdminAccessReasonValues,
  InsertAuditEventValues,
} from "./types";

type Executor = Database | Transaction;

function mapEvent(row: typeof auditEvents.$inferSelect): AuditEventRecord {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    reason: row.reason,
    previousValue: row.previousValue,
    newValue: row.newValue,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
  };
}

function mapAccessReason(row: typeof adminAccessReasons.$inferSelect): AdminAccessReasonRecord {
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    targetEntityType: row.targetEntityType,
    targetEntityId: row.targetEntityId,
    reason: row.reason,
    accessedAt: row.accessedAt,
  };
}

/**
 * Real, Postgres-backed `AuditStore`. Note what's absent: no `update`, no `delete`, no raw `sql`
 * escape hatch that could reach either. Combined with migration 0001's `BEFORE UPDATE OR DELETE`
 * trigger on `audit_events`, immutability holds both at this package's API surface and at the
 * database itself — see README, "Why there is no updateEvent/deleteEvent".
 */
function repository(executor: Executor, root: Database, insideTransaction: boolean): AuditStore {
  return {
    async transaction<T>(operation: (store: AuditStore) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async insertEvent(values: InsertAuditEventValues): Promise<AuditEventRecord> {
      const [row] = await executor
        .insert(auditEvents)
        .values({
          id: values.id,
          actorUserId: values.actorUserId,
          action: values.action,
          resourceType: values.resourceType,
          resourceId: values.resourceId ?? null,
          reason: values.reason ?? null,
          previousValue: values.previousValue ?? null,
          newValue: values.newValue ?? null,
          ipAddress: values.ipAddress ?? null,
        })
        .returning();
      if (!row) throw new Error("audit_events insert did not return a row.");
      return mapEvent(row);
    },

    async findEventById(id: string): Promise<AuditEventRecord | null> {
      const [row] = await executor
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.id, id))
        .limit(1);
      return row ? mapEvent(row) : null;
    },

    async findDecisionForRequest(approvalRequestId: string): Promise<AuditEventRecord | null> {
      const [row] = await executor
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.action, "approval.decided"),
            eq(auditEvents.resourceType, "approval_request"),
            eq(auditEvents.resourceId, approvalRequestId),
          ),
        )
        .orderBy(desc(auditEvents.id))
        .limit(1);
      return row ? mapEvent(row) : null;
    },

    async queryEvents(filters: AuditQueryFilters): Promise<AuditQueryPage> {
      const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
      const conditions: SQL[] = [];
      if (filters.actorUserId !== undefined)
        conditions.push(eq(auditEvents.actorUserId, filters.actorUserId));
      if (filters.action !== undefined) conditions.push(eq(auditEvents.action, filters.action));
      if (filters.resourceType !== undefined)
        conditions.push(eq(auditEvents.resourceType, filters.resourceType));
      if (filters.resourceId !== undefined)
        conditions.push(eq(auditEvents.resourceId, filters.resourceId));
      if (filters.from !== undefined) conditions.push(gte(auditEvents.createdAt, filters.from));
      if (filters.to !== undefined) conditions.push(lte(auditEvents.createdAt, filters.to));
      if (filters.cursor !== undefined) conditions.push(lt(auditEvents.id, filters.cursor));

      const rows = await executor
        .select()
        .from(auditEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditEvents.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return { items: page.map(mapEvent), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
    },

    async insertAdminAccessReason(
      values: InsertAdminAccessReasonValues,
    ): Promise<AdminAccessReasonRecord> {
      const [row] = await executor
        .insert(adminAccessReasons)
        .values({
          id: values.id,
          adminUserId: values.adminUserId,
          targetEntityType: values.targetEntityType,
          targetEntityId: values.targetEntityId,
          reason: values.reason,
          accessedAt: values.accessedAt ?? new Date(),
        })
        .returning();
      if (!row) throw new Error("admin_access_reasons insert did not return a row.");
      return mapAccessReason(row);
    },
  };
}

export function createDrizzleAuditStore(database: Database): AuditStore {
  return repository(database, database, false);
}
