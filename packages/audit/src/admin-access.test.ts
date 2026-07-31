import { describe, expect, it } from "vitest";

import { recordAdminAccessReason } from "./admin-access";
import { createInMemoryAuditStore } from "./in-memory-store";

describe("recordAdminAccessReason", () => {
  it("writes both an admin_access_reasons row and an audit_events row for the same access", async () => {
    const store = createInMemoryAuditStore();
    const { accessReason, auditEvent } = await recordAdminAccessReason(store, {
      adminUserId: "admin-1",
      targetEntityType: "conversations",
      targetEntityId: "conversation-1",
      reason: "Investigating a safety report.",
      action: "staff.message_access",
    });

    expect(accessReason.adminUserId).toBe("admin-1");
    expect(accessReason.targetEntityType).toBe("conversations");
    expect(accessReason.targetEntityId).toBe("conversation-1");
    expect(accessReason.reason).toBe("Investigating a safety report.");

    expect(auditEvent.actorUserId).toBe("admin-1");
    expect(auditEvent.action).toBe("staff.message_access");
    expect(auditEvent.resourceType).toBe("conversations");
    expect(auditEvent.resourceId).toBe("conversation-1");
    expect(auditEvent.reason).toBe("Investigating a safety report.");
  });

  it("defaults the audit action to staff.record_access when none is given", async () => {
    const store = createInMemoryAuditStore();
    const { auditEvent } = await recordAdminAccessReason(store, {
      adminUserId: "admin-1",
      targetEntityType: "student_profiles",
      targetEntityId: "student-1",
      reason: "Support ticket #42 follow-up.",
    });
    expect(auditEvent.action).toBe("staff.record_access");
  });
});
