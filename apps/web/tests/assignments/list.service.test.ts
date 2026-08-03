import { describe, expect, it, vi } from "vitest";

import {
  createAssignment,
  listAssignmentsForActor,
} from "../../../../packages/domain/assignments/services";
import { InMemoryAssignmentDatabase } from "./support/in-memory-assignment-database";

const staff = { userId: "admin-1", roles: ["administrator"] as const };
const tutorA = { userId: "tutor-a", roles: ["tutor"] as const };
const tutorB = { userId: "tutor-b", roles: ["tutor"] as const };
const parentA = { userId: "parent-a", roles: ["parent"] as const };
const parentB = { userId: "parent-b", roles: ["parent"] as const };
const studentA = {
  userId: "student-a-user",
  studentProfileId: "student-a",
  roles: ["student"] as const,
};
const studentB = {
  userId: "student-b-user",
  studentProfileId: "student-b",
  roles: ["student"] as const,
};

async function seed() {
  const database = new InMemoryAssignmentDatabase();
  database.tutorAssignments.add("tutor-a:student-a");
  database.tutorAssignments.add("tutor-b:student-b");
  database.parentLinks.add("parent-a:student-a");
  database.parentLinks.add("parent-b:student-b");
  database.studentNames.set("student-a", "Student A");
  database.studentNames.set("student-b", "Student B");

  const assignmentA = await createAssignment(database, tutorA, {
    studentProfileId: "student-a",
    subjectId: null,
    lessonId: null,
    title: "For student A",
    instructions: null,
    dueAt: null,
    status: "published",
    maxScore: 10,
    questions: [{ type: "short_answer", prompt: "Q", options: null, points: 10 }],
  });
  const assignmentB = await createAssignment(database, tutorB, {
    studentProfileId: "student-b",
    subjectId: null,
    lessonId: null,
    title: "For student B",
    instructions: null,
    dueAt: null,
    status: "published",
    maxScore: 10,
    questions: [{ type: "short_answer", prompt: "Q", options: null, points: 10 }],
  });
  return { database, assignmentA, assignmentB };
}

describe("listAssignmentsForActor", () => {
  it("lets staff see every assignment", async () => {
    const { database, assignmentA, assignmentB } = await seed();
    const page = await listAssignmentsForActor(database, staff, {});
    expect(page.items.map((item) => item.id).sort()).toEqual(
      [assignmentA.id, assignmentB.id].sort(),
    );
  });

  it("scopes a tutor to only their actively assigned students and denies the rest", async () => {
    const { database, assignmentA, assignmentB } = await seed();
    const page = await listAssignmentsForActor(database, tutorA, {});
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(assignmentA.id);
    expect(page.items.some((item) => item.id === assignmentB.id)).toBe(false);
  });

  it("scopes a parent to only their linked children and denies the rest", async () => {
    const { database, assignmentA, assignmentB } = await seed();
    const page = await listAssignmentsForActor(database, parentA, {});
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(assignmentA.id);
    expect(page.items.some((item) => item.id === assignmentB.id)).toBe(false);

    const otherParentPage = await listAssignmentsForActor(database, parentB, {});
    expect(otherParentPage.items.map((item) => item.id)).toEqual([assignmentB.id]);
  });

  it("scopes a student to only their own assignments", async () => {
    const { database, assignmentA, assignmentB } = await seed();
    const page = await listAssignmentsForActor(database, studentA, {});
    expect(page.items.map((item) => item.id)).toEqual([assignmentA.id]);
    const otherStudentPage = await listAssignmentsForActor(database, studentB, {});
    expect(otherStudentPage.items.map((item) => item.id)).toEqual([assignmentB.id]);
  });

  it("short-circuits an empty relationship scope instead of querying the database", async () => {
    const database = new InMemoryAssignmentDatabase();
    const unrelatedTutor = { userId: "tutor-unrelated", roles: ["tutor"] as const };
    const unrelatedParent = { userId: "parent-unrelated", roles: ["parent"] as const };
    const listSpy = vi.spyOn(database, "listAssignments");

    const tutorPage = await listAssignmentsForActor(database, unrelatedTutor, {});
    expect(tutorPage).toEqual({ items: [], nextCursor: null });

    const parentPage = await listAssignmentsForActor(database, unrelatedParent, {});
    expect(parentPage).toEqual({ items: [], nextCursor: null });

    expect(listSpy).not.toHaveBeenCalled();
  });
});
