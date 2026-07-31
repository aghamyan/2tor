import { getSession, type Actor } from "@app/auth";
import {
  approveHighRiskAction as auditApproveHighRiskAction,
  createDrizzleAuditStore,
  queryAuditEvents as auditQueryEvents,
  recordAdminAccessReason as auditRecordAdminAccessReason,
  recordAudit as auditRecordAudit,
  requestApproval as auditRequestApproval,
} from "@app/audit";
import { createDb, type Database } from "@app/db";
import Redis from "ioredis";

import { createDrizzleAdministrationDatabase } from "./drizzle-database";
import { AdministrationError } from "./errors";
import type {
  AdministrationDatabase,
  AuditPort,
  HighRiskAction,
  PendingApprovalSummary,
} from "./models";

let databaseSingleton: Database | undefined;
let redisSingleton: Redis | undefined;

function database(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for administration operations.");
  databaseSingleton ??= createDb(databaseUrl);
  return databaseSingleton;
}

function redis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for administration authentication.");
  redisSingleton ??= new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  return redisSingleton;
}

interface ApprovalRequestPayload {
  action: HighRiskAction;
  targetResourceType: string;
  targetResourceId: string;
  payload: unknown;
}

function isApprovalRequestPayload(value: unknown): value is ApprovalRequestPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<ApprovalRequestPayload>).action === "string" &&
    typeof (value as Partial<ApprovalRequestPayload>).targetResourceType === "string" &&
    typeof (value as Partial<ApprovalRequestPayload>).targetResourceId === "string"
  );
}

/** Shape of one item from `@app/audit`'s `queryAuditEvents` — narrowed structurally, not by importing its type. */
interface QueriedAuditEvent {
  id: string;
  actorUserId: string | null;
  reason: string | null;
  newValue: unknown;
  createdAt: Date;
}

function toPendingApprovalSummary(event: QueriedAuditEvent): PendingApprovalSummary | null {
  if (event.actorUserId === null || !isApprovalRequestPayload(event.newValue)) return null;
  return {
    approvalRequestId: event.id,
    requestedByUserId: event.actorUserId,
    action: event.newValue.action,
    targetResourceType: event.newValue.targetResourceType,
    targetResourceId: event.newValue.targetResourceId,
    payload: event.newValue.payload,
    reason: event.reason ?? "",
    requestedAt: event.createdAt,
  };
}

/**
 * Binds the real `@app/audit` package to this module's structural `AuditPort` (`models.ts`) — the
 * same composition-root pattern `packages/domain/consent/runtime.ts` uses for `@app/notifications`.
 * Only reached by the real Next.js app (Turbopack resolves `@app/audit` via
 * `tsconfig.base.json`'s path alias across the whole module graph); never imported by `services.ts`
 * or exercised directly by Vitest — see `packages/audit/README.md`, "Wiring note for consumers."
 */
function createAuditPort(db: Database): AuditPort {
  const store = createDrizzleAuditStore(db);

  return {
    async recordAudit(values) {
      await auditRecordAudit(store, values);
    },

    async recordAdminAccessReason(values) {
      await auditRecordAdminAccessReason(store, values);
    },

    async requestApproval(values) {
      const request = await auditRequestApproval(store, values);
      return { approvalRequestId: request.approvalRequestId, requestedAt: request.requestedAt };
    },

    async approveHighRiskAction(values) {
      return auditApproveHighRiskAction(store, values);
    },

    async findPendingApproval(resourceType, resourceId): Promise<PendingApprovalSummary | null> {
      // The wrapper `approval.requested` event's own `resourceType` is always the fixed
      // `"approval_request"` (see @app/audit's `approval.ts`) — the caller's `resourceType`
      // argument identifies the *target* resource instead, matched against `payload.targetResourceType`
      // below as a sanity check, not used in the query itself.
      const page = await auditQueryEvents(store, {
        resourceType: "approval_request",
        resourceId,
        action: "approval.requested",
        limit: 1,
      });
      const [requestEvent] = page.items;
      if (!requestEvent || requestEvent.actorUserId === null) return null;

      const decision = await store.findDecisionForRequest(requestEvent.id);
      if (decision) return null;

      const summary = toPendingApprovalSummary(requestEvent);
      if (!summary || summary.targetResourceType !== resourceType) return null;
      return summary;
    },

    async listPendingApprovals(action): Promise<PendingApprovalSummary[]> {
      const page = await auditQueryEvents(store, {
        action: "approval.requested",
        limit: 200,
      });
      const pending: PendingApprovalSummary[] = [];
      for (const event of page.items) {
        const summary = toPendingApprovalSummary(event);
        if (!summary || summary.action !== action) continue;
        const decision = await store.findDecisionForRequest(summary.approvalRequestId);
        if (!decision) pending.push(summary);
      }
      return pending;
    },

    async queryEvents(filters) {
      return auditQueryEvents(store, filters);
    },
  };
}

export async function administrationRequestContext(
  sessionId: string | null | undefined,
): Promise<{ actor: Actor; database: AdministrationDatabase; audit: AuditPort }> {
  if (!sessionId) throw new AdministrationError("UNAUTHENTICATED", "A session is required.", 401);
  const session = await getSession(redis(), sessionId);
  if (!session) throw new AdministrationError("UNAUTHENTICATED", "The session is invalid.", 401);
  const db = database();
  return {
    actor: {
      userId: session.userId,
      roles: session.roles,
      mfaVerifiedAt: session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt) : null,
    },
    database: createDrizzleAdministrationDatabase(db),
    audit: createAuditPort(db),
  };
}
