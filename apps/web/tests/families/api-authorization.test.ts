import { describe, expect, it } from "vitest";

import {
  createParentProfile,
  createStudentUnderParent,
} from "../../../../packages/domain/families/services";
import { authorizeStudentRelationship } from "../../app/(app)/families/authorization";
import { InMemoryFamilyDatabase } from "./support/in-memory-family-database";

describe("families API relationship authorization", () => {
  it("denies cross-family student access before a route calls its service", async () => {
    const database = new InMemoryFamilyDatabase();
    const owner = { userId: "owner", roles: ["parent"] as const };
    const unrelated = { userId: "unrelated", roles: ["parent"] as const };
    await createParentProfile(database, owner, {
      fullName: "Owner",
      phone: null,
      contentLanguagePreference: "en",
    });
    await createParentProfile(database, unrelated, {
      fullName: "Unrelated",
      phone: null,
      contentLanguagePreference: "en",
    });
    const student = await createStudentUnderParent(database, owner, {
      username: "owned.student",
      preferredName: "Owned",
      gradeLevel: "5",
      isAdultLearner: false,
      usState: null,
      dobYearMonth: null,
      ageBand: "8-10",
      primaryTimezone: "Asia/Yerevan",
      locale: "en",
      relationship: "parent",
    });

    await expect(
      authorizeStudentRelationship(database, unrelated, student.id, "student.view_profile"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      authorizeStudentRelationship(database, owner, student.id, "student.manage_profile"),
    ).resolves.toBeUndefined();
  });
});
