import { describe, expect, it } from "vitest";

import { approveHighRiskAction, requestApproval } from "./approval";
import { isAuditError } from "./errors";
import { createInMemoryAuditStore } from "./in-memory-store";

describe("requestApproval / approveHighRiskAction", () => {
  it("lets a different actor approve a high-risk request", async () => {
    const store = createInMemoryAuditStore();
    const request = await requestApproval(store, {
      actorUserId: "admin-a",
      action: "role_elevation",
      resourceType: "user_roles",
      resourceId: "grant-1",
      reason: "Promote to finance for payout coverage.",
      payload: { userId: "user-9", roleKey: "finance" },
    });

    const decision = await approveHighRiskAction(store, {
      approvalRequestId: request.approvalRequestId,
      approverUserId: "admin-b",
      decision: "approved",
      reason: "Confirmed with people ops.",
    });

    expect(decision.decision).toBe("approved");
    expect(decision.requestedByUserId).toBe("admin-a");
    expect(decision.approvedByUserId).toBe("admin-b");
    expect(decision.action).toBe("role_elevation");
    expect(decision.targetResourceType).toBe("user_roles");
    expect(decision.targetResourceId).toBe("grant-1");
    expect(decision.payload).toEqual({ userId: "user-9", roleKey: "finance" });
  });

  it("rejects self-approval — a super-admin cannot approve their own high-risk request", async () => {
    const store = createInMemoryAuditStore();
    const request = await requestApproval(store, {
      actorUserId: "super-admin-1",
      action: "mass_deletion",
      resourceType: "deletion_jobs",
      resourceId: "job-1",
      reason: "Purge stale trial accounts.",
    });

    await expect(
      approveHighRiskAction(store, {
        approvalRequestId: request.approvalRequestId,
        approverUserId: "super-admin-1",
        decision: "approved",
        reason: "Approving my own request.",
      }),
    ).rejects.toSatisfy(
      (error: unknown) => isAuditError(error) && error.code === "SELF_APPROVAL_FORBIDDEN",
    );
  });

  it("rejects self-approval even when the same actor is the only super-administrator", async () => {
    // Same guarantee, phrased the way the spec states it: holding the highest role does not grant
    // an exception. There is no role/flag parameter anywhere in this function's signature that
    // could let it through.
    const store = createInMemoryAuditStore();
    const request = await requestApproval(store, {
      actorUserId: "solo-super-admin",
      action: "disable_security_control",
      resourceType: "system_settings",
      resourceId: "security.require_mfa_for_admins",
      reason: "Temporarily disabling MFA enforcement for a migration.",
    });

    await expect(
      approveHighRiskAction(store, {
        approvalRequestId: request.approvalRequestId,
        approverUserId: "solo-super-admin",
        decision: "approved",
        reason: "No one else available.",
      }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });
  });

  it("rejects deciding a request that was already decided", async () => {
    const store = createInMemoryAuditStore();
    const request = await requestApproval(store, {
      actorUserId: "admin-a",
      action: "bulk_export",
      resourceType: "exports",
      resourceId: "export-1",
      reason: "Quarterly compliance export.",
    });
    await approveHighRiskAction(store, {
      approvalRequestId: request.approvalRequestId,
      approverUserId: "admin-b",
      decision: "approved",
      reason: "Looks right.",
    });

    await expect(
      approveHighRiskAction(store, {
        approvalRequestId: request.approvalRequestId,
        approverUserId: "admin-c",
        decision: "rejected",
        reason: "Too late, changed my mind.",
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_ALREADY_RESOLVED" });
  });

  it("rejects an unknown approval request id", async () => {
    const store = createInMemoryAuditStore();
    await expect(
      approveHighRiskAction(store, {
        approvalRequestId: "does-not-exist",
        approverUserId: "admin-b",
        decision: "approved",
        reason: "N/A",
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_NOT_FOUND" });
  });

  it("records both the request and the decision as separate, independently readable audit events", async () => {
    const store = createInMemoryAuditStore();
    const request = await requestApproval(store, {
      actorUserId: "admin-a",
      action: "role_elevation",
      resourceType: "user_roles",
      resourceId: "grant-2",
      reason: "Two-person review.",
    });
    await approveHighRiskAction(store, {
      approvalRequestId: request.approvalRequestId,
      approverUserId: "admin-b",
      decision: "rejected",
      reason: "Not justified.",
    });

    const page = await store.queryEvents({ resourceType: "approval_request", limit: 10 });
    const actions = page.items.map((event) => event.action).sort();
    expect(actions).toEqual(["approval.decided", "approval.requested"]);
  });
});
