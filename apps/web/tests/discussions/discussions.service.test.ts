import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DiscussionError } from "../../../../packages/domain/discussions/errors";
import {
  createAnswer,
  createQuestion,
  detectPii,
  getDownloadableDiscussionAttachment,
  getQuestionForActor,
  moderateQuestion,
  recordDiscussionAttachmentScanResult,
  uploadQuestionAttachment,
  verifyAnswer,
} from "../../../../packages/domain/discussions/services";
import type { DiscussionStorage } from "../../../../packages/domain/discussions/storage";
import { InMemoryDiscussionDatabase } from "./support/in-memory-discussion-database";

const student = {
  userId: "student-user",
  roles: ["student"] as const,
  studentProfileId: "student-1",
};
const secondStudent = {
  userId: "student-two",
  roles: ["student"] as const,
  studentProfileId: "student-2",
};
const parent = { userId: "parent-user", roles: ["parent"] as const };
const tutor = { userId: "tutor-user", roles: ["tutor"] as const };
const stranger = {
  userId: "stranger-user",
  roles: ["student"] as const,
  studentProfileId: "student-9",
};
const storage: DiscussionStorage = { putPrivate: async () => {} };

async function setup() {
  const database = new InMemoryDiscussionDatabase();
  for (const [userId, firstName, controlledIdentifier] of [
    ["student-user", "Maya", "Student 042"],
    ["student-two", "Noah", "Student 105"],
    ["tutor-user", "Arman", "Tutor 12"],
  ] as const)
    database.identities.set(userId, { firstName, controlledIdentifier });
  database.parentLinks.add("parent-user:student-1");
  database.tutorStudentAssignments.add("tutor-user:student-1");
  database.groupStudents.add("student-1:group-algebra");
  database.groupStudents.add("student-2:group-algebra");
  database.groupTutors.add("tutor-user:group-algebra");
  database.approvedAnswerers.add("student-2:group-algebra");
  return database;
}

describe("Learning Questions safeguards", () => {
  it("makes anonymous posting impossible and renders only a controlled display name", async () => {
    const database = await setup();
    const input = {
      studentProfileId: "student-1",
      courseId: null,
      groupId: null,
      subjectId: "fractions",
      title: "Help with fractions",
      body: "Why do I need a common denominator?",
      visibility: "private_support" as const,
    };
    await expect(createQuestion(database, null, input)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    } satisfies Partial<DiscussionError>);
    await expect(createQuestion(database, student, input)).resolves.toMatchObject({
      authorDisplayName: "Maya · Student 042",
    });
  });

  it("keeps private questions to the student, linked parent, responsible tutor, and staff", async () => {
    const database = await setup();
    const question = await createQuestion(database, student, {
      studentProfileId: "student-1",
      courseId: null,
      groupId: null,
      subjectId: "fractions",
      title: "Private help",
      body: "Can you show another example?",
      visibility: "private_support",
    });
    await expect(getQuestionForActor(database, parent, question.id)).resolves.toMatchObject({
      id: question.id,
    });
    await expect(getQuestionForActor(database, tutor, question.id)).resolves.toMatchObject({
      id: question.id,
    });
    await expect(getQuestionForActor(database, stranger, question.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<DiscussionError>);
  });

  it("shows a student answer as unverified until a tutor verifies it", async () => {
    const database = await setup();
    const question = await createQuestion(database, student, {
      studentProfileId: "student-1",
      courseId: "course-1",
      groupId: "group-algebra",
      subjectId: "algebra",
      title: "Equivalent fractions",
      body: "Are two fourths and one half the same?",
      visibility: "group_shared",
    });
    const answer = await createAnswer(database, secondStudent, question.id, {
      body: "Yes, they cover the same amount.",
    });
    expect(answer.verificationStatus).toBe("unverified");
    await expect(verifyAnswer(database, tutor, answer.id)).resolves.toMatchObject({
      verificationStatus: "verified",
      verifiedByUserId: "tutor-user",
    });
  });

  it("flags possible PII and quarantines attachments until a clean scan", async () => {
    const database = await setup();
    const question = await createQuestion(database, student, {
      studentProfileId: "student-1",
      courseId: null,
      groupId: null,
      subjectId: "algebra",
      title: "Contact me at maya@example.test",
      body: "Can someone help?",
      visibility: "private_support",
    });
    expect(question.status).toBe("pending_moderation");
    expect(detectPii("My phone is +1 555 123 4567")).toHaveLength(1);
    await expect(moderateQuestion(database, tutor, question.id, "open")).resolves.toMatchObject({
      status: "open",
    });
    const pdf = new TextEncoder().encode("%PDF-1.7\nexample");
    const attachment = await uploadQuestionAttachment(
      database,
      storage,
      student,
      question.id,
      { fileName: "work.pdf", mimeType: "application/pdf", sizeBytes: pdf.length },
      pdf,
    );
    await expect(
      getDownloadableDiscussionAttachment(database, student, attachment.id),
    ).rejects.toMatchObject({ code: "FILE_NOT_READY" } satisfies Partial<DiscussionError>);
    await recordDiscussionAttachmentScanResult(database, attachment.id, "clean");
    await expect(
      getDownloadableDiscussionAttachment(database, tutor, attachment.id),
    ).resolves.toMatchObject({ virusScanStatus: "clean" });
  });

  it("has no public index or direct-message entry point", async () => {
    const [page, services] = await Promise.all([
      readFile(new URL("../../app/(app)/discussions/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../../../../packages/domain/discussions/services.ts", import.meta.url),
        "utf8",
      ),
    ]);
    expect(page).toContain("index: false");
    expect(page).toContain("follow: false");
    expect(services).not.toMatch(/direct[-_ ]?message|conversation|recipient/i);
  });
});
