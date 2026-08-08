import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DiscussionError } from "../../../../packages/domain/discussions/errors";
import {
  canAccessQuestion,
  canRateAnswer,
} from "../../../../packages/domain/discussions/capabilities";
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
import { orderAnswersForDisplay } from "../../../../packages/domain/discussions/ordering";
import { getFeedForActor } from "../../../../packages/domain/discussions/feed";
import type { DiscussionAnswerRecord } from "../../../../packages/domain/discussions/models";
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
const secondTutor = { userId: "tutor-two", roles: ["tutor"] as const };
const stranger = {
  userId: "stranger-user",
  roles: ["student"] as const,
  studentProfileId: "student-9",
};
const storage: DiscussionStorage = {
  putPrivate: async () => {},
  getPrivate: async () => {
    throw new Error("not used in this test");
  },
  deletePrivate: async () => {},
};

async function setup() {
  const database = new InMemoryDiscussionDatabase();
  for (const [userId, firstName, controlledIdentifier] of [
    ["student-user", "Maya", "Student 042"],
    ["student-two", "Noah", "Student 105"],
    ["tutor-user", "Arman", "Tutor 12"],
    ["tutor-two", "Lucia", "Tutor 30"],
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
  it("includes both unanswered and review-waiting questions in the tutor attention feed", async () => {
    const database = await setup();
    const createCommunityQuestion = (title: string) =>
      createQuestion(database, student, {
        studentProfileId: "student-1",
        courseId: null,
        groupId: null,
        subjectId: "algebra",
        title,
        body: "Can you help me understand the reasoning?",
        visibility: "community",
      });
    const [unanswered, needsReview, resolved] = await Promise.all([
      createCommunityQuestion("Unanswered question"),
      createCommunityQuestion("Student answer to review"),
      createCommunityQuestion("Already resolved"),
    ]);
    await database.updateQuestionStatus(needsReview.id, "needs_tutor_review");
    await database.updateQuestionStatus(resolved.id, "resolved");

    const feed = await getFeedForActor(database, tutor, { needsTutorReview: true });

    expect(feed.items.map((item) => item.question.id).sort()).toEqual(
      [unanswered.id, needsReview.id].sort(),
    );
  });

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
    await expect(
      verifyAnswer(database, tutor, answer.id, {
        verificationStatus: "correct",
        verificationNote: "Nicely explained.",
      }),
    ).resolves.toMatchObject({
      verificationStatus: "correct",
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
    // MathOverflow added a module-owned notification log (`recipientId` on `discussion_notifications`,
    // see notifications.ts) — a one-way "you were mentioned in this thread" record, not a two-party
    // messaging primitive. The guard below checks for actual messaging/inbox primitives instead of
    // the word "recipient" alone, which a legitimate notification feature must use somewhere.
    expect(services).not.toMatch(
      /direct[-_ ]?message|\bconversation(Id)?\b|\binbox\b|\bsendMessage\b/i,
    );
  });
});

describe("canAccessQuestion visibility tiers", () => {
  it("community: any student or tutor can read it, but a parent not linked to that student cannot", async () => {
    const database = await setup();
    const question = {
      visibility: "community" as const,
      studentProfileId: "student-1",
      groupId: null,
    };
    await expect(canAccessQuestion(database, stranger, question)).resolves.toBe(true);
    await expect(canAccessQuestion(database, tutor, question)).resolves.toBe(true);
    await expect(canAccessQuestion(database, parent, question)).resolves.toBe(true);
    const otherParent = { userId: "other-parent", roles: ["parent"] as const };
    await expect(canAccessQuestion(database, otherParent, question)).resolves.toBe(false);
  });

  it("tutors_only: any tutor can read it, but a student who isn't the author cannot", async () => {
    const database = await setup();
    const question = {
      visibility: "tutors_only" as const,
      studentProfileId: "student-1",
      groupId: null,
    };
    await expect(canAccessQuestion(database, tutor, question)).resolves.toBe(true);
    await expect(canAccessQuestion(database, secondTutor, question)).resolves.toBe(true);
    await expect(canAccessQuestion(database, secondStudent, question)).resolves.toBe(false);
  });

  it("private_support: only the specifically assigned tutor can read it, not any tutor", async () => {
    const database = await setup();
    const question = {
      visibility: "private_support" as const,
      studentProfileId: "student-1",
      groupId: null,
    };
    await expect(canAccessQuestion(database, tutor, question)).resolves.toBe(true);
    await expect(canAccessQuestion(database, secondTutor, question)).resolves.toBe(false);
    await expect(canAccessQuestion(database, parent, question)).resolves.toBe(true);
    await expect(canAccessQuestion(database, secondStudent, question)).resolves.toBe(false);
  });

  it("group_shared: only group members and their tutors can read it, and a missing groupId denies everyone", async () => {
    const database = await setup();
    const question = {
      visibility: "group_shared" as const,
      studentProfileId: "student-1",
      groupId: "group-algebra",
    };
    await expect(canAccessQuestion(database, secondStudent, question)).resolves.toBe(true);
    await expect(canAccessQuestion(database, tutor, question)).resolves.toBe(true);
    await expect(canAccessQuestion(database, stranger, question)).resolves.toBe(false);
    await expect(
      canAccessQuestion(database, secondStudent, { ...question, groupId: null }),
    ).resolves.toBe(false);
  });
});

describe("canRateAnswer anti-gamification guards", () => {
  it("rejects a non-tutor actor outright", async () => {
    const database = await setup();
    const question = await createQuestion(database, student, {
      studentProfileId: "student-1",
      courseId: "course-1",
      groupId: "group-algebra",
      subjectId: "algebra",
      title: "Rating guard question",
      body: "Body text for the rating guard test.",
      visibility: "group_shared",
    });
    const answer = await createAnswer(database, secondStudent, question.id, {
      body: "A peer answer.",
    });
    await expect(canRateAnswer(database, stranger, answer, question)).resolves.toMatchObject({
      allowed: false,
    });
  });

  it("rejects rating your own answer, even if you now also hold the tutor role", async () => {
    const database = await setup();
    const question = await createQuestion(database, student, {
      studentProfileId: "student-1",
      courseId: "course-1",
      groupId: "group-algebra",
      subjectId: "algebra",
      title: "Self-rating guard question",
      body: "Body text for the self-rating guard test.",
      visibility: "group_shared",
    });
    const answer = await createAnswer(database, secondStudent, question.id, {
      body: "My own answer.",
    });
    const selfAsTutor = { userId: "student-two", roles: ["tutor"] as const };
    await expect(canRateAnswer(database, selfAsTutor, answer, question)).resolves.toMatchObject({
      allowed: false,
    });
  });

  it("rejects rating an official tutor answer — only student-written answers are rateable", async () => {
    const database = await setup();
    const question = await createQuestion(database, student, {
      studentProfileId: "student-1",
      courseId: "course-1",
      groupId: "group-algebra",
      subjectId: "algebra",
      title: "Tutor answer guard question",
      body: "Body text for the tutor-answer guard test.",
      visibility: "group_shared",
    });
    const tutorAnswer = await createAnswer(database, tutor, question.id, {
      body: "The official answer.",
    });
    await expect(
      canRateAnswer(database, secondTutor, tutorAnswer, question),
    ).resolves.toMatchObject({
      allowed: false,
    });
  });

  it("rejects a tutor with no access to the discussion, and allows the assigned tutor", async () => {
    const database = await setup();
    // `secondTutor` is deliberately not in `groupTutors` for this group (see `setup()`) — only
    // `tutor` is assigned here, so a group-scoped question is what actually exercises "no access."
    const question = await createQuestion(database, student, {
      studentProfileId: "student-1",
      courseId: null,
      groupId: "group-algebra",
      subjectId: "algebra",
      title: "Group rating guard question",
      body: "Body text for the group rating guard test.",
      visibility: "group_shared",
    });
    const answer = await createAnswer(database, secondStudent, question.id, {
      body: "A peer answer.",
    });
    await expect(canRateAnswer(database, secondTutor, answer, question)).resolves.toMatchObject({
      allowed: false,
    });
    await expect(canRateAnswer(database, tutor, answer, question)).resolves.toMatchObject({
      allowed: true,
    });
  });
});

describe("orderAnswersForDisplay: popularity never outranks verification", () => {
  const baseAnswer: DiscussionAnswerRecord = {
    id: "answer-base",
    questionId: "question-1",
    authorUserId: "student-two",
    authorDisplayName: "Noah · Student 105",
    authorKind: "student",
    isTutorAnswer: false,
    body: "Some explanation.",
    bodyFormat: "markdown",
    isAccepted: false,
    verificationStatus: "unverified",
    verificationNote: null,
    verifiedByUserId: null,
    verifiedAt: null,
    tutorRatingAverage: null,
    tutorRatingCount: 0,
    revisedAfterRatingAt: null,
    piiFlags: [],
    lockedAt: null,
    lockedById: null,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("ranks a tutor-verified answer above an unverified answer with far more helpful votes", () => {
    const verified: DiscussionAnswerRecord = {
      ...baseAnswer,
      id: "answer-verified",
      verificationStatus: "correct",
      verifiedByUserId: "tutor-user",
      verifiedAt: new Date("2026-01-02T00:00:00Z"),
    };
    const popularButUnverified: DiscussionAnswerRecord = { ...baseAnswer, id: "answer-popular" };
    const question = { acceptedAnswerId: null };
    const helpfulCounts = new Map([
      ["answer-verified", 0],
      ["answer-popular", 500],
    ]);
    const ordered = orderAnswersForDisplay(
      [popularButUnverified, verified],
      question,
      helpfulCounts,
    );
    expect(ordered.map((answer) => answer.id)).toEqual(["answer-verified", "answer-popular"]);
  });

  it("ranks the accepted answer above everything else, regardless of helpful votes", () => {
    const accepted: DiscussionAnswerRecord = { ...baseAnswer, id: "answer-accepted" };
    const popular: DiscussionAnswerRecord = { ...baseAnswer, id: "answer-popular" };
    const question = { acceptedAnswerId: "answer-accepted" };
    const helpfulCounts = new Map([
      ["answer-accepted", 0],
      ["answer-popular", 1_000],
    ]);
    const ordered = orderAnswersForDisplay([popular, accepted], question, helpfulCounts);
    expect(ordered.map((answer) => answer.id)).toEqual(["answer-accepted", "answer-popular"]);
  });

  it("does not let a single 5-star rating outrank a 4.8-star average built from five ratings (confidence-adjusted)", () => {
    const oneLoneFiveStar: DiscussionAnswerRecord = {
      ...baseAnswer,
      id: "answer-one-five-star",
      tutorRatingAverage: 5,
      tutorRatingCount: 1,
    };
    const fiveRatingsAtFourPointEight: DiscussionAnswerRecord = {
      ...baseAnswer,
      id: "answer-five-ratings",
      tutorRatingAverage: 4.8,
      tutorRatingCount: 5,
    };
    const question = { acceptedAnswerId: null };
    const helpfulCounts = new Map<string, number>();
    const ordered = orderAnswersForDisplay(
      [oneLoneFiveStar, fiveRatingsAtFourPointEight],
      question,
      helpfulCounts,
    );
    expect(ordered.map((answer) => answer.id)).toEqual([
      "answer-five-ratings",
      "answer-one-five-star",
    ]);
  });
});
