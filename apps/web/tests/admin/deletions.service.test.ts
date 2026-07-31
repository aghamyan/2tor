import { describe, expect, it } from "vitest";

import {
  decideMassDeletion,
  requestMassDeletion,
} from "../../../../packages/domain/administration/services";
import { FakeAuditPort } from "./support/fake-audit-port";
import { InMemoryAdministrationDatabase } from "./support/in-memory-administration-database";

const FRESH_MFA = new Date("2026-07-29T11:55:00.000Z");

function staffActor(userId: string, mfaVerifiedAt: Date | null = FRESH_MFA) {
  return { userId, roles: ["administrator"] as const, mfaVerifiedAt };
}

describe("mass deletion two-person approval", () => {
  it("creates the job already blocked, pending a second administrator's approval", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const requester = staffActor("admin-a");

    const { job } = await requestMassDeletion(database, audit, requester, {
      targetEntityType: "bookmarks",
      targetEntityId: "bookmark-1",
      scope: "full_erase",
      reason: "Parent requested deletion.",
    });

    expect(job.status).toBe("blocked");
    expect(job.blockReason).toBe("pending_approval");
    expect(job.createdByUserId).toBe("admin-a");
  });

  it("rejects the requester approving their own deletion job — via created_by_user_id, before the audit port is consulted", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const requester = staffActor("admin-a");
    const { job, approvalRequestId } = await requestMassDeletion(database, audit, requester, {
      targetEntityType: "bookmarks",
      targetEntityId: "bookmark-1",
      scope: "full_erase",
      reason: "Requested deletion.",
    });

    await expect(
      decideMassDeletion(database, audit, requester, {
        deletionJobId: job.id,
        approvalRequestId,
        decision: "approved",
        reason: "Approving my own request.",
      }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });

    expect(audit.approveCalls).toHaveLength(0);
    const stillBlocked = await database.findDeletionJobById(job.id);
    expect(stillBlocked?.status).toBe("blocked");
    expect(stillBlocked?.blockReason).toBe("pending_approval");
  });

  it("a different administrator can approve, flipping the job to scheduled", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const requester = staffActor("admin-a");
    const approver = staffActor("admin-b");
    const { job, approvalRequestId } = await requestMassDeletion(database, audit, requester, {
      targetEntityType: "bookmarks",
      targetEntityId: "bookmark-1",
      scope: "full_erase",
      reason: "Requested deletion.",
    });
    audit.approveHighRiskActionResult = {
      decision: "approved",
      requestedByUserId: "admin-a",
      approvedByUserId: "admin-b",
      action: "mass_deletion",
      targetResourceType: "deletion_jobs",
      targetResourceId: job.id,
      payload: null,
      decidedAt: new Date("2026-07-29T12:00:00.000Z"),
    };

    const updated = await decideMassDeletion(database, audit, approver, {
      deletionJobId: job.id,
      approvalRequestId,
      decision: "approved",
      reason: "Reviewed.",
    });

    expect(updated.status).toBe("scheduled");
    expect(updated.blockReason).toBeNull();
  });

  it("rejecting leaves the job blocked with a rejected reason, not eligible for the worker", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const requester = staffActor("admin-a");
    const approver = staffActor("admin-b");
    const { job, approvalRequestId } = await requestMassDeletion(database, audit, requester, {
      targetEntityType: "bookmarks",
      targetEntityId: "bookmark-1",
      scope: "full_erase",
      reason: "Requested deletion.",
    });
    audit.approveHighRiskActionResult = {
      decision: "rejected",
      requestedByUserId: "admin-a",
      approvedByUserId: "admin-b",
      action: "mass_deletion",
      targetResourceType: "deletion_jobs",
      targetResourceId: job.id,
      payload: null,
      decidedAt: new Date("2026-07-29T12:00:00.000Z"),
    };

    const updated = await decideMassDeletion(database, audit, approver, {
      deletionJobId: job.id,
      approvalRequestId,
      decision: "rejected",
      reason: "Not justified.",
    });

    expect(updated.status).toBe("blocked");
    expect(updated.blockReason).toBe("rejected");
  });
});
