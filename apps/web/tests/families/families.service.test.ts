import { authorize } from "@app/auth";
import { describe, expect, it } from "vitest";

import { FamilyError } from "../../../../packages/domain/families/errors";
import {
  createStudentInputSchema,
  type CreateStudentInput,
} from "../../../../packages/domain/families/schemas";
import {
  correctStudentInfo,
  createParentProfile,
  createStudentUnderParent,
  familyReadyForActivation,
  getFamilyStudent,
  listFamilyStudents,
  replaceStudentInterests,
  unlinkStudent,
} from "../../../../packages/domain/families/services";
import { InMemoryFamilyDatabase } from "./support/in-memory-family-database";

const parentActor = { userId: "parent-user-1", roles: ["parent"] as const };
const otherParentActor = { userId: "parent-user-2", roles: ["parent"] as const };
const studentActor = { userId: "student-user", roles: ["student"] as const };

function studentInput(username: string, preferredName: string): CreateStudentInput {
  return {
    username,
    preferredName,
    gradeLevel: "6",
    isAdultLearner: false,
    usState: "CA",
    dobYearMonth: null,
    ageBand: "11-12",
    primaryTimezone: "America/Los_Angeles",
    locale: "en",
    relationship: "parent",
  };
}

async function familyWithParent() {
  const database = new InMemoryFamilyDatabase();
  const parent = await createParentProfile(database, parentActor, {
    fullName: "Parent One",
    phone: "+1 555 0100",
    contentLanguagePreference: "en",
  });
  return { database, parent };
}

describe("families services", () => {
  it("lets one parent create and manage multiple linked students", async () => {
    const { database, parent } = await familyWithParent();
    const first = await createStudentUnderParent(
      database,
      parentActor,
      studentInput("learner.one", "Mina"),
    );
    const second = await createStudentUnderParent(
      database,
      parentActor,
      studentInput("learner.two", "Aram"),
    );

    const page = await listFamilyStudents(database, parentActor);
    expect(page.items.map((student) => student.id).sort()).toEqual([first.id, second.id].sort());
    expect(page.items.every((student) => student.parentProfileId === parent.id)).toBe(true);
    expect(first.status).toBe("inactive");
    expect(
      database.audits.filter((audit) => audit.action === "family.student.linked"),
    ).toHaveLength(2);
  });

  it("does not reveal a student to an unrelated parent", async () => {
    const { database } = await familyWithParent();
    const student = await createStudentUnderParent(
      database,
      parentActor,
      studentInput("private.learner", "Nare"),
    );
    await createParentProfile(database, otherParentActor, {
      fullName: "Parent Two",
      phone: null,
      contentLanguagePreference: null,
    });

    const otherList = await listFamilyStudents(database, otherParentActor);
    expect(otherList.items).toEqual([]);
    await expect(getFamilyStudent(database, otherParentActor, student.id)).rejects.toMatchObject({
      code: "STUDENT_NOT_FOUND",
      status: 404,
    });
  });

  it("denies creation without an authenticated parent actor", async () => {
    const { database } = await familyWithParent();
    await expect(
      createStudentUnderParent(database, null, studentInput("no.actor", "No Actor")),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
    await expect(
      createStudentUnderParent(database, studentActor, studentInput("self.signup", "Self")),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      createStudentUnderParent(
        database,
        { userId: parentActor.userId, roles: ["parent", "student"] },
        studentInput("mixed.role", "Mixed"),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(database.students.size).toBe(0);

    expect(
      authorize(studentActor, "account.create", {
        kind: "user_account",
        targetRole: "student",
      }),
    ).toEqual({ allowed: false, reason: "students_cannot_create_accounts" });
  });

  it("accepts only minimized age data and rejects unrecognized address or exact-DOB fields", () => {
    expect(
      createStudentInputSchema.safeParse({
        ...studentInput("safe.profile", "Safe"),
        homeAddress: "Never stored",
      }).success,
    ).toBe(false);
    expect(
      createStudentInputSchema.safeParse({
        ...studentInput("safe.profile", "Safe"),
        dobExact: "2014-05-12",
      }).success,
    ).toBe(false);
    expect(
      createStudentInputSchema.safeParse({
        ...studentInput("safe.profile", "Safe"),
        dobYearMonth: "2014-05",
        ageBand: "11-12",
      }).success,
    ).toBe(false);
  });

  it("audits parent corrections and interest changes", async () => {
    const { database } = await familyWithParent();
    const student = await createStudentUnderParent(
      database,
      parentActor,
      studentInput("correct.me", "Ani"),
    );
    await correctStudentInfo(
      database,
      parentActor,
      student.id,
      {
        preferredName: "Annie",
        gradeLevel: "7",
        isAdultLearner: false,
        usState: "CA",
        dobYearMonth: null,
        ageBand: "11-12",
      },
      "Parent reviewed the new school year.",
    );
    await replaceStudentInterests(database, parentActor, student.id, {
      interests: ["Robotics", "Chess", "Chess"],
      reason: "Reviewed together.",
    });

    expect(database.audits.map((audit) => audit.action)).toContain(
      "family.student_profile.corrected",
    );
    expect(database.audits.map((audit) => audit.action)).toContain(
      "family.student_interests.corrected",
    );
    expect(await database.listInterests(student.id)).toEqual(["Robotics", "Chess"]);
  });

  it("will not remove the last parent link from a minor", async () => {
    const { database, parent } = await familyWithParent();
    const student = await createStudentUnderParent(
      database,
      parentActor,
      studentInput("linked.minor", "Levon"),
    );
    await expect(
      unlinkStudent(database, parentActor, {
        parentProfileId: parent.id,
        studentProfileId: student.id,
        reason: "Testing the invariant.",
      }),
    ).rejects.toMatchObject({ code: "LAST_PARENT_LINK", status: 409 });
    expect(await database.findLink(parent.id, student.id)).not.toBeNull();
  });

  it("exposes family-only activation readiness without implementing consent", async () => {
    const { database } = await familyWithParent();
    const student = await createStudentUnderParent(
      database,
      parentActor,
      studentInput("ready.structurally", "Tigran"),
    );
    await expect(familyReadyForActivation(database, student.id)).resolves.toEqual({
      ready: true,
      studentId: student.id,
      blockers: [],
    });
    await expect(familyReadyForActivation(database, "missing")).resolves.toEqual({
      ready: false,
      studentId: "missing",
      blockers: ["student_not_found"],
    });
  });

  it("uses typed family errors for authorization failures", () => {
    const error = new FamilyError("FORBIDDEN", "denied", 403);
    expect(error).toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
