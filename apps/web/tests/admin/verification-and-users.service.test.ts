import { describe, expect, it } from "vitest";

import {
  approveUserAccount,
  decideTutorVerification,
  suspendUserAccount,
} from "../../../../packages/domain/administration/services";
import { FakeAuditPort } from "./support/fake-audit-port";
import { InMemoryAdministrationDatabase } from "./support/in-memory-administration-database";

function staffActor(userId: string) {
  return { userId, roles: ["administrator"] as const, mfaVerifiedAt: null };
}

describe("user approval", () => {
  it("approves a pending account and records an audit event", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    database.users.set("user-1", {
      id: "user-1",
      email: "new@example.com",
      username: null,
      status: "pending",
      roleKeys: [],
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
    });

    const updated = await approveUserAccount(
      database,
      audit,
      staffActor("admin-1"),
      "user-1",
      "Looks legitimate.",
    );
    expect(updated.status).toBe("active");
    expect(audit.recordedEvents).toHaveLength(1);
    expect(audit.recordedEvents[0]).toMatchObject({
      action: "admin.user_approved",
      resourceId: "user-1",
    });
  });

  it("an admin cannot approve their own account", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    database.users.set("admin-1", {
      id: "admin-1",
      email: "admin@example.com",
      username: null,
      status: "pending",
      roleKeys: ["administrator"],
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
    });

    await expect(
      approveUserAccount(database, audit, staffActor("admin-1"), "admin-1", "Self-approving."),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });
  });

  it("an admin cannot suspend their own account", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    database.users.set("admin-1", {
      id: "admin-1",
      email: "admin@example.com",
      username: null,
      status: "active",
      roleKeys: ["administrator"],
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
    });

    await expect(
      suspendUserAccount(database, audit, staffActor("admin-1"), "admin-1", "Self-suspending."),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("tutor verification review", () => {
  it("a tutor cannot verify their own record", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    database.tutorVerifications.set("verification-1", {
      id: "verification-1",
      tutorProfileId: "tutor-profile-1",
      tutorUserId: "tutor-user-1",
      tutorDisplayName: "Jane Tutor",
      type: "identity",
      status: "pending",
      notes: null,
    });

    await expect(
      decideTutorVerification(
        database,
        audit,
        { userId: "tutor-user-1", roles: ["tutor", "administrator"] as const },
        {
          verificationId: "verification-1",
          decision: "passed",
          notes: null,
        },
      ),
    ).rejects.toMatchObject({ code: "SELF_VERIFICATION_FORBIDDEN" });
  });

  it("a different staff member can decide the verification", async () => {
    const database = new InMemoryAdministrationDatabase();
    const audit = new FakeAuditPort();
    database.tutorVerifications.set("verification-1", {
      id: "verification-1",
      tutorProfileId: "tutor-profile-1",
      tutorUserId: "tutor-user-1",
      tutorDisplayName: "Jane Tutor",
      type: "identity",
      status: "pending",
      notes: null,
    });

    const updated = await decideTutorVerification(
      database,
      audit,
      { userId: "admin-1", roles: ["administrator"] as const },
      {
        verificationId: "verification-1",
        decision: "passed",
        notes: "Documents check out.",
      },
    );
    expect(updated.status).toBe("passed");
  });
});
