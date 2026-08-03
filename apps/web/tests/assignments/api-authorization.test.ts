import { describe, expect, it } from "vitest";

import { authorizeAssignmentAccess } from "../../app/(app)/assignments/authorization";
import { InMemoryAssignmentDatabase } from "./support/in-memory-assignment-database";

describe("assignments API relationship authorization", () => {
  it("denies an unrelated parent and an unassigned tutor before a route calls its service", async () => {
    const database = new InMemoryAssignmentDatabase();
    database.tutorAssignments.add("tutor-assigned:student-1");
    database.parentLinks.add("parent-linked:student-1");

    const unrelatedParent = { userId: "parent-unrelated", roles: ["parent"] as const };
    const unassignedTutor = { userId: "tutor-unassigned", roles: ["tutor"] as const };
    const linkedParent = { userId: "parent-linked", roles: ["parent"] as const };
    const assignedTutor = { userId: "tutor-assigned", roles: ["tutor"] as const };

    await expect(
      authorizeAssignmentAccess(database, unrelatedParent, "student-1", "academic.view_record"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      authorizeAssignmentAccess(database, unassignedTutor, "student-1", "academic.view_record"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    await expect(
      authorizeAssignmentAccess(database, linkedParent, "student-1", "academic.view_record"),
    ).resolves.toBeUndefined();
    await expect(
      authorizeAssignmentAccess(database, assignedTutor, "student-1", "academic.view_record"),
    ).resolves.toBeUndefined();
  });

  it("never grants a parent the tutor-only edit_learning_plan action, even when linked", async () => {
    const database = new InMemoryAssignmentDatabase();
    database.parentLinks.add("parent-linked:student-1");
    const linkedParent = { userId: "parent-linked", roles: ["parent"] as const };

    await expect(
      authorizeAssignmentAccess(database, linkedParent, "student-1", "academic.edit_learning_plan"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
