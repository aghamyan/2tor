import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  decideBulkExport,
  requestBulkExport,
} from "../../../../packages/domain/administration/services";
import { FakeAuditPort } from "./support/fake-audit-port";
import { InMemoryAdministrationDatabase } from "./support/in-memory-administration-database";

const FRESH_MFA = new Date("2026-07-29T11:55:00.000Z");
const NOW = new Date("2026-07-29T12:00:00.000Z");

function staffActor(userId: string, mfaVerifiedAt: Date | null = FRESH_MFA) {
  return { userId, roles: ["administrator"] as const, mfaVerifiedAt };
}

describe("bulk export two-person approval", () => {
  // requireStepUpFresh() checks mfaVerifiedAt against a live `new Date()`, so FRESH_MFA only
  // stays within its 15-minute window if the clock is pinned to NOW for the test's duration.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets a different administrator approve the export", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const requester = staffActor("admin-a");
    const approver = staffActor("admin-b");

    const { export: created, approvalRequestId } = await requestBulkExport(
      database,
      audit,
      requester,
      {
        type: "users",
        filters: {},
        reason: "Quarterly compliance export.",
      },
    );
    expect(created.status).toBe("pending");
    expect(created.requestedByUserId).toBe("admin-a");

    audit.approveHighRiskActionResult = {
      decision: "approved",
      requestedByUserId: "admin-a",
      approvedByUserId: "admin-b",
      action: "bulk_export",
      targetResourceType: "exports",
      targetResourceId: created.id,
      payload: null,
      decidedAt: NOW,
    };

    const updated = await decideBulkExport(database, audit, approver, {
      exportId: created.id,
      approvalRequestId,
      decision: "approved",
      reason: "Reviewed and looks correct.",
    });

    expect(updated.status).toBe("processing");
    expect(updated.approvedByUserId).toBe("admin-b");
    expect(audit.approveCalls).toHaveLength(1);
  });

  it("rejects the requester approving their own export — via the schema-native requested_by_user_id column, before the audit port is even consulted", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const requester = staffActor("admin-a");

    const { export: created, approvalRequestId } = await requestBulkExport(
      database,
      audit,
      requester,
      {
        type: "users",
        filters: {},
        reason: "Self-service export.",
      },
    );

    await expect(
      decideBulkExport(database, audit, requester, {
        exportId: created.id,
        approvalRequestId,
        decision: "approved",
        reason: "Approving my own request.",
      }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });

    // The defense-in-depth check in `decideBulkExport` must short-circuit before ever calling
    // into the audit port's own (separately, and really, tested in packages/audit) self-approval
    // check — proving this really is a second, independent layer, not just a relabeled call.
    expect(audit.approveCalls).toHaveLength(0);
    // And the export itself must not have been silently approved.
    const stillPending = await database.findExportById(created.id);
    expect(stillPending?.status).toBe("pending");
    expect(stillPending?.approvedByUserId).toBeNull();
  });

  it("rejects deciding an export that is not pending", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const requester = staffActor("admin-a");
    const approver = staffActor("admin-b");
    const { export: created, approvalRequestId } = await requestBulkExport(
      database,
      audit,
      requester,
      {
        type: "users",
        filters: {},
        reason: "Export.",
      },
    );
    await database.setExportDecision(created.id, { status: "completed" });

    await expect(
      decideBulkExport(database, audit, approver, {
        exportId: created.id,
        approvalRequestId,
        decision: "approved",
        reason: "Too late.",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("requires fresh step-up MFA to decide an export", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const requester = staffActor("admin-a");
    const staleApprover = staffActor("admin-b", null);
    const { export: created, approvalRequestId } = await requestBulkExport(
      database,
      audit,
      requester,
      {
        type: "users",
        filters: {},
        reason: "Export.",
      },
    );

    await expect(
      decideBulkExport(database, audit, staleApprover, {
        exportId: created.id,
        approvalRequestId,
        decision: "approved",
        reason: "No fresh MFA.",
      }),
    ).rejects.toMatchObject({ code: "STEP_UP_REQUIRED" });
  });

  it("requires staff role to request or decide an export", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    const parent = { userId: "parent-1", roles: ["parent"] as const };

    await expect(
      requestBulkExport(database, audit, parent, { type: "users", filters: {}, reason: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
