import { describe, expect, it } from "vitest";

import { projectAvailabilityUtc } from "../../../../packages/domain/tutors/availability";
import { TutorError } from "../../../../packages/domain/tutors/errors";
import type {
  TutorDatabase,
  TutorProfileRecord,
  TutorVerificationRecord,
} from "../../../../packages/domain/tutors/models";
import {
  getPublicTutorProfile,
  reviewTutorVerification,
  uploadTutorDocument,
} from "../../../../packages/domain/tutors/services";

const profile: TutorProfileRecord = {
  id: "tutor-profile",
  userId: "tutor-user",
  timeZone: "Asia/Yerevan",
  publicDisplayName: "Approved Tutor",
  bio: "A careful teacher",
  headline: "Math tutor",
  country: "AM",
  yearsExperience: 4,
  educationSummary: "BSc",
  status: "active",
  publicProfileApprovedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};
const verification: TutorVerificationRecord = {
  id: "verification",
  tutorProfileId: profile.id,
  type: "identity",
  status: "pending",
  evidenceRef: null,
  verifiedByUserId: null,
  verifiedAt: null,
  expiresAt: null,
  notes: null,
};

function database(overrides: Partial<TutorDatabase> = {}): TutorDatabase {
  const unsupported = async () => {
    throw new Error("not used by this test");
  };
  return {
    transaction: async (operation) => operation(database(overrides)),
    findTutorProfileByUserId: async () => profile,
    findTutorProfileById: async () => profile,
    createTutorProfile: unsupported as never,
    updateTutorProfile: unsupported as never,
    listSubjects: async () => [
      { subjectId: "math", key: "math", name: "Mathematics", isPrimary: true },
    ],
    replaceSubjects: unsupported as never,
    listGradeRanges: async () => [{ minGrade: 5, maxGrade: 12, includesAdult: false }],
    replaceGradeRanges: unsupported as never,
    listLanguages: async () => [{ languageCode: "en", proficiency: "fluent" }],
    replaceLanguages: unsupported as never,
    listAvailability: async () => [],
    replaceAvailability: unsupported as never,
    createDocument: async (value) => ({
      ...value,
      uploadedAt: new Date(),
      reviewedByUserId: null,
      reviewedAt: null,
      notes: null,
    }),
    findDocument: async () => null,
    listDocuments: async () => [],
    listVerifications: async () => [verification],
    findVerification: async () => verification,
    createVerification: unsupported as never,
    reviewVerification: async (_id, values) => ({ ...verification, ...values }),
    listEvaluations: async () => [],
    listTraining: async () => [],
    listSuspensions: async () => [],
    ...overrides,
  };
}

describe("tutors", () => {
  it("denies a tutor approving their own verification even when they are an administrator", async () => {
    await expect(
      reviewTutorVerification(
        database(),
        { userId: "tutor-user", roles: ["tutor", "administrator"] },
        verification.id,
        { status: "passed", evidenceRef: null, expiresAt: null, notes: null },
      ),
    ).rejects.toMatchObject({
      code: "SELF_VERIFICATION_FORBIDDEN",
      status: 403,
    } satisfies Partial<TutorError>);
  });

  it("projects only approved public fields", async () => {
    const result = await getPublicTutorProfile(database(), profile.id);
    expect(result).toEqual(
      expect.objectContaining({ id: profile.id, displayName: "Approved Tutor" }),
    );
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("documents");
    expect(result).not.toHaveProperty("verifications");
    await expect(
      getPublicTutorProfile(
        database({
          findTutorProfileById: async () => ({ ...profile, publicProfileApprovedAt: null }),
        }),
        profile.id,
      ),
    ).rejects.toMatchObject({ code: "PUBLIC_PROFILE_NOT_FOUND" });
  });

  it("rejects oversize and mismatched uploads before storage", async () => {
    const storage = {
      putPrivate: async () => {
        throw new Error("storage must not be called");
      },
    };
    await expect(
      uploadTutorDocument(
        database(),
        storage,
        { userId: "tutor-user", roles: ["tutor"] },
        { type: "identity", fileName: "not-a-pdf.pdf", mimeType: "application/pdf", sizeBytes: 5 },
        new Uint8Array([1, 2, 3, 4, 5]),
      ),
    ).rejects.toMatchObject({ code: "INVALID_UPLOAD" });
    await expect(
      uploadTutorDocument(
        database(),
        storage,
        { userId: "tutor-user", roles: ["tutor"] },
        {
          type: "identity",
          fileName: "big.pdf",
          mimeType: "application/pdf",
          sizeBytes: 10 * 1024 * 1024 + 1,
        },
        new Uint8Array(),
      ),
    ).rejects.toThrow();
  });

  it("projects recurring availability as a UTC half-open window while retaining its IANA zone", () => {
    const [window] = projectAvailabilityUtc(
      [
        {
          id: "weekly-rule",
          dayOfWeek: 1,
          startMinute: 9 * 60,
          endMinute: 10 * 60,
          effectiveFrom: null,
          effectiveTo: null,
          timeZone: "Asia/Yerevan",
        },
      ],
      new Date("2026-08-02T00:00:00.000Z"),
      new Date("2026-08-04T00:00:00.000Z"),
    );
    expect(window).toMatchObject({
      startsAt: new Date("2026-08-03T05:00:00.000Z"),
      endsAt: new Date("2026-08-03T06:00:00.000Z"),
      timeZone: "Asia/Yerevan",
      source: "recurring",
      ruleId: "weekly-rule",
    });
  });
});
