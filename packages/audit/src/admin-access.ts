import { ulid } from "ulid";

import { recordAdminAccessInputSchema, type RecordAdminAccessInput } from "./schemas";
import type { AdminAccessReasonRecord, AuditEventRecord, AuditStore } from "./types";

/**
 * Implements spec §4.5 / CONVENTIONS.md's "staff message access requires admin_access_reasons +
 * audit": every staff read of a protected record for an operational/safety reason writes BOTH an
 * `admin_access_reasons` row (the reason, tied to the specific target) AND an `audit_events` row
 * (the general trail), in one transaction — a caller cannot accidentally write one without the
 * other. `action` defaults to `"staff.record_access"`; pass a more specific action
 * (e.g. `"staff.message_access"`) when the caller knows the resource kind.
 */
export async function recordAdminAccessReason(
  store: AuditStore,
  input: RecordAdminAccessInput,
): Promise<{ accessReason: AdminAccessReasonRecord; auditEvent: AuditEventRecord }> {
  const values = recordAdminAccessInputSchema.parse(input);

  return store.transaction(async (transaction) => {
    const accessReason = await transaction.insertAdminAccessReason({
      id: ulid(),
      adminUserId: values.adminUserId,
      targetEntityType: values.targetEntityType,
      targetEntityId: values.targetEntityId,
      reason: values.reason,
    });
    const auditEvent = await transaction.insertEvent({
      id: ulid(),
      actorUserId: values.adminUserId,
      action: values.action ?? "staff.record_access",
      resourceType: values.targetEntityType,
      resourceId: values.targetEntityId,
      reason: values.reason,
    });
    return { accessReason, auditEvent };
  });
}
