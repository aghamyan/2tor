import { describe, expect, it } from "vitest";

import {
  createParentProfile,
  createStudentUnderParent,
} from "../../../../packages/domain/families/services";
import { authorizeConsentAction } from "../../app/(app)/consent/authorization";
import { InMemoryFamilyDatabase } from "../families/support/in-memory-family-database";

describe("consent API relationship authorization", () => {
  it("denies cross-family student access before a route calls its service", async () => {
    const familyDatabase = new InMemoryFamilyDatabase();
    const owner = { userId: "owner", roles: ["parent"] as const };
    const unrelated = { userId: "unrelated", roles: ["parent"] as const };
    await createParentProfile(familyDatabase, owner, {
      fullName: "Owner",
      phone: null,
      contentLanguagePreference: "en",
    });
    await createParentProfile(familyDatabase, unrelated, {
      fullName: "Unrelated",
      phone: null,
      contentLanguagePreference: "en",
    });
    const student = await createStudentUnderParent(familyDatabase, owner, {
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
      authorizeConsentAction(familyDatabase, unrelated, student.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      authorizeConsentAction(familyDatabase, owner, student.id),
    ).resolves.toBeUndefined();
  });

  it("allows staff regardless of family link", async () => {
    const familyDatabase = new InMemoryFamilyDatabase();
    const owner = { userId: "owner-2", roles: ["parent"] as const };
    const staff = { userId: "staff-1", roles: ["administrator"] as const };
    await createParentProfile(familyDatabase, owner, {
      fullName: "Owner",
      phone: null,
      contentLanguagePreference: "en",
    });
    const student = await createStudentUnderParent(familyDatabase, owner, {
      username: "staff.reviewed",
      preferredName: "Reviewed",
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
      authorizeConsentAction(familyDatabase, staff, student.id),
    ).resolves.toBeUndefined();
  });
});
