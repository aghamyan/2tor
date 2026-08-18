import { ulid } from "ulid";
import { stripImageMetadata, type AllowedSubmissionMimeType } from "../assignments/services";
import {
  canAcceptAnswer,
  canAccessQuestion,
  canAskQuestion,
  canCloseOrReopenQuestion,
  canCreateAnswer,
  canDeleteQuestion,
  canEditAnswer,
  canEditQuestion,
  canLockQuestion,
  canMergeDuplicates,
  canModerateAsTutor,
  canRequestRevision,
  canVerifyAnswer,
  isStaff,
  isStudent,
  requireActor,
  requireQuestionAccess,
  requireTutorAccess,
} from "./capabilities";
import { DiscussionError } from "./errors";
import type {
  DiscussionActor,
  DiscussionAnswerRecord,
  DiscussionAttachmentRecord,
  DiscussionDatabase,
  DiscussionQuestionRecord,
  DiscussionVoteRecord,
  PiiFlag,
  TutorResponseSlaMetric,
} from "./models";
import {
  createAnswerSchema,
  createQuestionSchema,
  questionListSchema,
  updateAnswerSchema,
  updateQuestionSchema,
  type CreateAnswerInput,
  type CreateQuestionInput,
  type QuestionListInput,
  type UpdateAnswerInput,
  type UpdateQuestionInput,
} from "./schemas";
import type { DiscussionStorage } from "./storage";
import { createNotification } from "./notifications";

const MAX_VOTES_PER_SERVICE_DAY = 5;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Match broad high-risk patterns and queue moderation without retaining the match itself. */
export function detectPii(text: string, now = new Date()): PiiFlag[] {
  const checks: Array<[PiiFlag["kind"], RegExp]> = [
    ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ["phone", /(?:\+?\d[\d(). -]{7,}\d)/],
    [
      "address",
      /\b\d{1,5}\s+[A-Za-z][A-Za-z.'-]{1,40}\s(?:street|st\.?|avenue|ave\.?|road|rd\.?|lane|ln\.?|drive|dr\.?)\b/i,
    ],
    ["government_identifier", /\b(?:\d{3}-?\d{2}-?\d{4}|[A-Z]{2}\d{6,8})\b/],
  ];
  return checks
    .filter(([, pattern]) => pattern.test(text))
    .map(([kind]) => ({ kind, detectedAt: now }));
}

/** Only a first name plus a platform-controlled identifier is ever rendered. */
export function displayName(identity: { firstName: string; controlledIdentifier: string }): string {
  const firstName = identity.firstName.trim().replace(/\s+/g, " ");
  const controlledIdentifier = identity.controlledIdentifier.trim().replace(/\s+/g, " ");
  if (!firstName || !controlledIdentifier)
    throw new DiscussionError(
      "DISPLAY_IDENTITY_UNAVAILABLE",
      "A safe display identity is required before posting.",
      409,
    );
  return `${firstName} · ${controlledIdentifier}`;
}

export async function safeDisplayName(database: DiscussionDatabase, userId: string) {
  const identity = await database.getSafeDisplayIdentity(userId);
  if (!identity)
    throw new DiscussionError(
      "DISPLAY_IDENTITY_UNAVAILABLE",
      "A safe display identity is required before posting.",
      409,
    );
  return displayName(identity);
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "question"}-${ulid().slice(-6).toLowerCase()}`;
}

async function getQuestionOrThrow(database: DiscussionDatabase, questionId: string) {
  const question = await database.getQuestion(questionId);
  if (!question || question.deletedAt)
    throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
  return question;
}

async function getAnswerOrThrow(database: DiscussionDatabase, answerId: string) {
  const answer = await database.getAnswer(answerId);
  if (!answer || answer.deletedAt)
    throw new DiscussionError("ANSWER_NOT_FOUND", "This answer was not found.", 404);
  return answer;
}

export async function createQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  input: CreateQuestionInput,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const values = createQuestionSchema.parse(input);
  if (!canAskQuestion(actor) || actor.studentProfileId !== values.studentProfileId)
    throw new DiscussionError("FORBIDDEN", "Only the signed-in student can ask a question.", 403);
  if (
    values.visibility === "group_shared" &&
    (!values.groupId || !(await database.isStudentInGroup(values.studentProfileId, values.groupId)))
  )
    throw new DiscussionError(
      "FORBIDDEN",
      "Shared questions must use one of the student's classes.",
      403,
    );
  const now = new Date();
  const piiFlags = detectPii(`${values.title}\n${values.body}\n${values.whatTried ?? ""}`, now);
  // Grade level is never asked for explicitly — it's stamped from the asking student's own
  // enrollment record so "browse by grade" reflects real cohorts, not free-text guesses.
  const gradeLevel =
    values.gradeLevel ?? (await database.getGradeLevelForStudentProfile(values.studentProfileId));
  const question: DiscussionQuestionRecord = {
    id: ulid(),
    courseId: values.courseId,
    groupId: values.groupId,
    subjectId: values.subjectId,
    topicId: values.topicId,
    studentProfileId: values.studentProfileId,
    authorUserId: actor.userId,
    authorDisplayName: await safeDisplayName(database, actor.userId),
    title: values.title,
    slug: slugify(values.title),
    body: values.body,
    bodyFormat: "markdown",
    gradeLevel,
    questionType: values.questionType,
    whatTried: values.whatTried ?? null,
    visibility: values.visibility,
    relatedClassId: values.relatedClassId,
    status: piiFlags.length ? "pending_moderation" : "open",
    acceptedAnswerId: null,
    duplicateOfQuestionId: null,
    piiFlags,
    viewCount: 0,
    lastActivityAt: now,
    lockedAt: null,
    lockedById: null,
    closedAt: null,
    closedById: null,
    closedReason: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await database.transaction(async (tx) => {
    await tx.saveQuestion(question);
    if (values.tags.length) {
      const tags = await tx.getOrCreateTagsByName(values.tags);
      await tx.setQuestionTags(
        question.id,
        tags.map((tag) => tag.id),
      );
    }
  });
  return question;
}

export async function updateQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
  input: UpdateQuestionInput,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const values = updateQuestionSchema.parse(input);
  const question = await getQuestionOrThrow(database, questionId);
  if (!canEditQuestion(actor, question))
    throw new DiscussionError("FORBIDDEN", "You cannot edit this question.", 403);
  const now = new Date();
  await database.transaction(async (tx) => {
    if (values.body && values.body !== question.body) {
      await tx.saveRevision({
        id: ulid(),
        entityType: "question",
        entityId: question.id,
        editorId: actor.userId,
        previousBody: question.body,
        newBody: values.body,
        editReason: values.editReason ?? null,
        createdAt: now,
      });
    }
    await tx.updateQuestion(questionId, {
      title: values.title ?? question.title,
      body: values.body ?? question.body,
    });
    if (values.tags) {
      const tags = await tx.getOrCreateTagsByName(values.tags);
      await tx.setQuestionTags(
        question.id,
        tags.map((tag) => tag.id),
      );
    }
  });
  return {
    ...question,
    ...values,
    title: values.title ?? question.title,
    body: values.body ?? question.body,
    updatedAt: now,
  };
}

export async function deleteQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<void> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  const answers = await database.listAnswers(questionId);
  const hasContributions = answers.length > 0;
  if (!canDeleteQuestion(actor, question, hasContributions))
    throw new DiscussionError(
      "FORBIDDEN",
      hasContributions
        ? "This question already has answers and can no longer be deleted by its author."
        : "You cannot delete this question.",
      403,
    );
  await database.updateQuestion(questionId, { deletedAt: new Date() });
}

export async function listQuestionsForActor(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  input: QuestionListInput,
): Promise<DiscussionQuestionRecord[]> {
  requireActor(actor);
  const values = questionListSchema.parse(input);
  const rows = await database.listQuestions(values);
  const allowed = await Promise.all(
    rows.map(async (question) =>
      (await canAccessQuestion(database, actor, question)) ? question : null,
    ),
  );
  return allowed
    .filter((question): question is DiscussionQuestionRecord => question !== null)
    .slice(0, values.limit);
}

export async function getQuestionForActor(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
) {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireQuestionAccess(database, actor, question);
  return question;
}

export async function getQuestionBySlugForActor(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  slug: string,
) {
  requireActor(actor);
  const question = await database.getQuestionBySlug(slug);
  if (!question || question.deletedAt)
    throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
  await requireQuestionAccess(database, actor, question);
  return question;
}

/**
 * Short-lived claim on "this viewer already counted a view for this question" — backed by
 * Redis SETNX+TTL at the runtime layer, so a viewer re-opening/refreshing the same question
 * doesn't inflate the count. An in-memory Map is sufficient for tests.
 */
export interface DiscussionViewDedup {
  claimView(questionId: string, viewerKey: string): Promise<boolean>;
}

export async function recordQuestionView(
  database: DiscussionDatabase,
  dedup: DiscussionViewDedup,
  questionId: string,
  viewerKey: string,
): Promise<void> {
  const isNewView = await dedup.claimView(questionId, viewerKey);
  if (!isNewView) return;
  await database.incrementQuestionViewCount(questionId);
}

export async function closeQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
  reason: string,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireTutorAccess(database, actor, question);
  if (!canCloseOrReopenQuestion(actor))
    throw new DiscussionError("FORBIDDEN", "Only a tutor can close a question.", 403);
  const now = new Date();
  await database.updateQuestion(questionId, {
    status: "closed",
    closedAt: now,
    closedById: actor.userId,
    closedReason: reason,
  });
  await createNotification(database, {
    recipientId: question.authorUserId,
    actorId: actor.userId,
    type: "content_moderation_updated",
    questionId,
  });
  return {
    ...question,
    status: "closed",
    closedAt: now,
    closedById: actor.userId,
    closedReason: reason,
  };
}

export async function reopenQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireTutorAccess(database, actor, question);
  if (!canCloseOrReopenQuestion(actor))
    throw new DiscussionError("FORBIDDEN", "Only a tutor can reopen a question.", 403);
  await database.updateQuestion(questionId, {
    status: "open",
    closedAt: null,
    closedById: null,
    closedReason: null,
  });
  await createNotification(database, {
    recipientId: question.authorUserId,
    actorId: actor.userId,
    type: "content_moderation_updated",
    questionId,
  });
  return { ...question, status: "open", closedAt: null, closedById: null, closedReason: null };
}

export async function lockQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  if (!canLockQuestion(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can lock a discussion.", 403);
  const now = new Date();
  await database.updateQuestion(questionId, {
    status: "locked",
    lockedAt: now,
    lockedById: actor.userId,
  });
  return { ...question, status: "locked", lockedAt: now, lockedById: actor.userId };
}

export async function unlockQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  if (!canLockQuestion(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can unlock a discussion.", 403);
  await database.updateQuestion(questionId, { status: "open", lockedAt: null, lockedById: null });
  return { ...question, status: "open", lockedAt: null, lockedById: null };
}

export async function markDuplicate(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
  duplicateOfQuestionId: string,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireTutorAccess(database, actor, question);
  if (!canMergeDuplicates(actor))
    throw new DiscussionError("FORBIDDEN", "Only a tutor can merge duplicate questions.", 403);
  await getQuestionOrThrow(database, duplicateOfQuestionId);
  await database.updateQuestion(questionId, { status: "duplicate", duplicateOfQuestionId });
  await createNotification(database, {
    recipientId: question.authorUserId,
    actorId: actor.userId,
    type: "content_moderation_updated",
    questionId,
  });
  return { ...question, status: "duplicate", duplicateOfQuestionId };
}

/** Legacy alias retained for the original moderation entry point (PII quarantine release/close). */
export async function moderateQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
  status: "open" | "closed",
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireTutorAccess(database, actor, question);
  await database.updateQuestionStatus(question.id, status);
  return { ...question, status, updatedAt: new Date() };
}

export async function createAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
  input: CreateAnswerInput,
): Promise<DiscussionAnswerRecord> {
  requireActor(actor);
  const values = createAnswerSchema.parse(input);
  const question = await getQuestionOrThrow(database, questionId);
  const eligibility = await canCreateAnswer(database, actor, question);
  if (!eligibility.allowed || !eligibility.authorKind)
    throw new DiscussionError(
      "FORBIDDEN",
      eligibility.reason ?? "You cannot answer this question.",
      403,
    );
  const now = new Date();
  const answer: DiscussionAnswerRecord = {
    id: ulid(),
    questionId,
    authorUserId: actor.userId,
    authorDisplayName: await safeDisplayName(database, actor.userId),
    authorKind: eligibility.authorKind,
    isTutorAnswer: eligibility.authorKind === "tutor",
    body: values.body,
    bodyFormat: "markdown",
    isAccepted: false,
    // Tutor authorship is clear, but verification remains an explicit moderation action.
    verificationStatus: "unverified",
    verificationNote: null,
    verifiedByUserId: null,
    verifiedAt: null,
    tutorRatingAverage: null,
    tutorRatingCount: 0,
    revisedAfterRatingAt: null,
    piiFlags: detectPii(values.body, now),
    lockedAt: null,
    lockedById: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await database.transaction(async (tx) => {
    await tx.saveAnswer(answer);
    if (question.status === "open") await tx.updateQuestionStatus(questionId, "answered");
    await tx.touchQuestionActivity(questionId, now);
  });
  if (question.authorUserId !== actor.userId)
    await createNotification(database, {
      recipientId: question.authorUserId,
      actorId: actor.userId,
      type: "question_answered",
      questionId,
      answerId: answer.id,
    });
  await notifyFollowers(database, questionId, actor.userId, "followed_question_activity", {
    answerId: answer.id,
  });
  return answer;
}

export async function updateAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
  input: UpdateAnswerInput,
): Promise<DiscussionAnswerRecord> {
  requireActor(actor);
  const values = updateAnswerSchema.parse(input);
  const answer = await getAnswerOrThrow(database, answerId);
  if (!canEditAnswer(actor, answer))
    throw new DiscussionError("FORBIDDEN", "You cannot edit this answer.", 403);
  const now = new Date();
  const wasRated = answer.tutorRatingCount > 0;
  await database.transaction(async (tx) => {
    await tx.saveRevision({
      id: ulid(),
      entityType: "answer",
      entityId: answer.id,
      editorId: actor.userId,
      previousBody: answer.body,
      newBody: values.body,
      editReason: values.editReason ?? null,
      createdAt: now,
    });
    await tx.updateAnswer(answerId, {
      body: values.body,
      revisedAfterRatingAt: wasRated ? now : answer.revisedAfterRatingAt,
    });
  });
  if (wasRated) {
    const raters = await database.listActiveRatingsForAnswer(answer.id);
    await Promise.all(
      raters.map((rating) =>
        createNotification(database, {
          recipientId: rating.tutorId,
          actorId: actor.userId,
          type: "followed_question_activity",
          answerId: answer.id,
        }),
      ),
    );
  }
  return {
    ...answer,
    body: values.body,
    revisedAfterRatingAt: wasRated ? now : answer.revisedAfterRatingAt,
    updatedAt: now,
  };
}

export async function deleteAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<void> {
  requireActor(actor);
  const answer = await getAnswerOrThrow(database, answerId);
  if (!isStaff(actor) && answer.authorUserId !== actor.userId)
    throw new DiscussionError("FORBIDDEN", "You cannot delete this answer.", 403);
  await database.updateAnswer(answerId, { deletedAt: new Date() });
}

export async function listAnswersForActor(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
) {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireQuestionAccess(database, actor, question);
  const answers = await database.listAnswers(questionId);
  return answers.filter((answer) => !answer.deletedAt);
}

export async function verifyAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
  values: {
    verificationStatus: import("./models").AnswerVerificationStatus;
    verificationNote?: string | null;
  },
): Promise<DiscussionAnswerRecord> {
  requireActor(actor);
  const answer = await getAnswerOrThrow(database, answerId);
  const question = await getQuestionOrThrow(database, answer.questionId);
  if (!(await canVerifyAnswer(database, actor, question)))
    throw new DiscussionError(
      "FORBIDDEN",
      "Only a tutor responsible for this question can verify an answer.",
      403,
    );
  const verifiedAt = new Date();
  await database.transaction(async (tx) => {
    await tx.updateAnswerVerification(answer.id, {
      verificationStatus: values.verificationStatus,
      verificationNote: values.verificationNote ?? null,
      verifiedByUserId: actor.userId,
      verifiedAt,
    });
    if (values.verificationStatus === "correct" || values.verificationStatus === "mostly_correct")
      await tx.updateQuestionStatus(question.id, "tutor_verified");
    else if (
      values.verificationStatus === "needs_revision" ||
      values.verificationStatus === "incorrect"
    )
      await tx.updateQuestionStatus(question.id, "needs_tutor_review");
  });
  await createNotification(database, {
    recipientId: answer.authorUserId,
    actorId: actor.userId,
    type: "answer_tutor_verified",
    questionId: question.id,
    answerId: answer.id,
  });
  return {
    ...answer,
    verificationStatus: values.verificationStatus,
    verificationNote: values.verificationNote ?? null,
    verifiedByUserId: actor.userId,
    verifiedAt,
    updatedAt: verifiedAt,
  };
}

export async function requestAnswerRevision(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
  note: string,
): Promise<void> {
  requireActor(actor);
  const answer = await getAnswerOrThrow(database, answerId);
  const question = await getQuestionOrThrow(database, answer.questionId);
  if (!(await canRequestRevision(database, actor, question)))
    throw new DiscussionError("FORBIDDEN", "Only a tutor can request a revision.", 403);
  await database.updateAnswerVerification(answer.id, {
    verificationStatus: "needs_revision",
    verificationNote: note,
    verifiedByUserId: actor.userId,
    verifiedAt: new Date(),
  });
  await database.updateQuestionStatus(question.id, "needs_tutor_review");
  await createNotification(database, {
    recipientId: answer.authorUserId,
    actorId: actor.userId,
    type: "answer_revision_requested",
    questionId: question.id,
    answerId: answer.id,
  });
}

/**
 * Accepting a new answer unaccepts any previous one inside a single transaction. Only the
 * question's own author may accept — tutors/admins can *recommend* (see `verifyAnswer`) but never
 * silently accept on a student's behalf.
 */
export async function acceptAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const answer = await getAnswerOrThrow(database, answerId);
  const question = await getQuestionOrThrow(database, answer.questionId);
  if (!canAcceptAnswer(actor, question))
    throw new DiscussionError("FORBIDDEN", "Only the question author can accept an answer.", 403);
  if (answer.questionId !== question.id)
    throw new DiscussionError(
      "INVALID_INPUT",
      "That answer does not belong to this question.",
      400,
    );
  const previousAcceptedId = question.acceptedAnswerId;
  const updated = await database.transaction(async (tx) => {
    if (previousAcceptedId && previousAcceptedId !== answerId)
      await tx.updateAnswer(previousAcceptedId, { isAccepted: false });
    await tx.updateAnswer(answerId, { isAccepted: true });
    const nextStatus = answer.verificationStatus === "correct" ? "tutor_verified" : "accepted";
    await tx.updateQuestion(question.id, { acceptedAnswerId: answerId, status: nextStatus });
    return {
      ...question,
      acceptedAnswerId: answerId,
      status: nextStatus as DiscussionQuestionRecord["status"],
    };
  });
  await createNotification(database, {
    recipientId: answer.authorUserId,
    actorId: actor.userId,
    type: "answer_accepted",
    questionId: question.id,
    answerId,
  });
  if (previousAcceptedId && previousAcceptedId !== answerId) {
    const previous = await database.getAnswer(previousAcceptedId);
    if (previous)
      await createNotification(database, {
        recipientId: previous.authorUserId,
        actorId: actor.userId,
        type: "answer_unaccepted",
        questionId: question.id,
        answerId: previousAcceptedId,
      });
  }
  return updated;
}

export async function unacceptAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  if (!isStudent(actor) || actor.userId !== question.authorUserId)
    throw new DiscussionError("FORBIDDEN", "Only the question author can unaccept an answer.", 403);
  const previousAcceptedId = question.acceptedAnswerId;
  await database.transaction(async (tx) => {
    if (previousAcceptedId) await tx.updateAnswer(previousAcceptedId, { isAccepted: false });
    await tx.updateQuestion(questionId, { acceptedAnswerId: null, status: "answered" });
  });
  if (previousAcceptedId) {
    const previous = await database.getAnswer(previousAcceptedId);
    if (previous)
      await createNotification(database, {
        recipientId: previous.authorUserId,
        actorId: actor.userId,
        type: "answer_unaccepted",
        questionId,
        answerId: previousAcceptedId,
      });
  }
  return { ...question, acceptedAnswerId: null, status: "answered" };
}

export async function castLimitedHelpfulVote(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<DiscussionVoteRecord> {
  requireActor(actor);
  const answer = await getAnswerOrThrow(database, answerId);
  const question = await getQuestionOrThrow(database, answer.questionId);
  await requireQuestionAccess(database, actor, question);
  if (answer.authorUserId === actor.userId)
    throw new DiscussionError("CANNOT_VOTE_OWN_ANSWER", "You cannot vote on your own answer.", 403);
  if (await database.hasVote(answerId, actor.userId))
    throw new DiscussionError(
      "VOTE_LIMIT_REACHED",
      "You have already marked this answer helpful.",
      409,
    );
  const startOfServiceDay = new Date();
  startOfServiceDay.setHours(0, 0, 0, 0);
  if (
    (await database.countVotesByUserSince(actor.userId, startOfServiceDay)) >=
    MAX_VOTES_PER_SERVICE_DAY
  )
    throw new DiscussionError(
      "VOTE_LIMIT_REACHED",
      "You have reached today's helpful-answer limit.",
      429,
    );
  const vote = {
    id: ulid(),
    answerId,
    voterUserId: actor.userId,
    createdAt: new Date(),
  } satisfies DiscussionVoteRecord;
  await database.saveVote(vote);
  return vote;
}

function hasSignature(mimeType: string, bytes: Uint8Array) {
  const starts = (...prefix: number[]) =>
    bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value);
  return mimeType === "image/jpeg"
    ? starts(0xff, 0xd8, 0xff)
    : mimeType === "image/png"
      ? starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
      : mimeType === "application/pdf"
        ? starts(0x25, 0x50, 0x44, 0x46, 0x2d)
        : false;
}

export async function uploadQuestionAttachment(
  database: DiscussionDatabase,
  storage: DiscussionStorage,
  actor: DiscussionActor | null | undefined,
  questionId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number },
  bytes: Uint8Array,
): Promise<DiscussionAttachmentRecord> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireQuestionAccess(database, actor, question);
  if (
    question.authorUserId !== actor.userId &&
    !isStaff(actor) &&
    !(await canModerateAsTutor(database, actor, question))
  )
    throw new DiscussionError(
      "FORBIDDEN",
      "Only the question author or teaching staff may attach a file.",
      403,
    );
  if (!(["image/jpeg", "image/png", "application/pdf"] as string[]).includes(input.mimeType))
    throw new DiscussionError(
      "UPLOAD_NOT_ALLOWED",
      "This file type is not allowed for MathOverflow.",
      415,
    );
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes !== bytes.byteLength ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_ATTACHMENT_BYTES
  )
    throw new DiscussionError("UPLOAD_TOO_LARGE", "This attachment exceeds the 15 MB limit.", 413);
  if (!hasSignature(input.mimeType, bytes))
    throw new DiscussionError(
      "UPLOAD_SIGNATURE_INVALID",
      "The uploaded bytes do not match the declared file type.",
      415,
    );
  const mimeType = input.mimeType as DiscussionAttachmentRecord["mimeType"];
  const safeBytes = stripImageMetadata(mimeType as AllowedSubmissionMimeType, bytes);
  const extension =
    mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : "jpg";
  const attachment: DiscussionAttachmentRecord = {
    id: ulid(),
    questionId,
    uploadedByUserId: actor.userId,
    fileKey: `discussions/${questionId}/${ulid()}.${extension}`,
    fileName: input.fileName.trim().slice(0, 255) || "mathoverflow-file",
    mimeType,
    sizeBytes: safeBytes.byteLength,
    virusScanStatus: "pending",
    createdAt: new Date(),
  };
  await storage.putPrivate({
    key: attachment.fileKey,
    body: safeBytes,
    mimeType: attachment.mimeType,
    metadata: {
      discussionAttachmentId: attachment.id,
      quarantine: "pending",
      originalName: attachment.fileName,
    },
  });
  await database.saveAttachment(attachment);
  return attachment;
}

export async function recordDiscussionAttachmentScanResult(
  database: DiscussionDatabase,
  attachmentId: string,
  status: Exclude<DiscussionAttachmentRecord["virusScanStatus"], "pending">,
) {
  if (!(await database.getAttachment(attachmentId)))
    throw new DiscussionError("ATTACHMENT_NOT_FOUND", "Attachment was not found.", 404);
  await database.updateAttachmentScanStatus(attachmentId, status);
}

export async function getDownloadableDiscussionAttachment(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  attachmentId: string,
) {
  requireActor(actor);
  const attachment = await database.getAttachment(attachmentId);
  if (!attachment)
    throw new DiscussionError("ATTACHMENT_NOT_FOUND", "Attachment was not found.", 404);
  const question = await getQuestionOrThrow(database, attachment.questionId);
  await requireQuestionAccess(database, actor, question);
  if (attachment.virusScanStatus !== "clean")
    throw new DiscussionError(
      "FILE_NOT_READY",
      "This attachment remains quarantined until malware scanning clears it.",
      409,
    );
  return attachment;
}

/** Counts only weekday service hours; it is a transparency metric, never a realtime promise. */
export function serviceHoursBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let total = 0;
  let cursor = new Date(start);
  while (cursor < end) {
    const next = new Date(cursor);
    next.setHours(24, 0, 0, 0);
    const segmentEnd = next < end ? next : end;
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += (segmentEnd.getTime() - cursor.getTime()) / 3_600_000;
    cursor = segmentEnd;
  }
  return total;
}

export function tutorResponseSla(
  question: DiscussionQuestionRecord,
  answers: readonly DiscussionAnswerRecord[],
  now = new Date(),
): TutorResponseSlaMetric {
  const firstTutorResponseAt =
    answers
      .filter((answer) => answer.authorKind === "tutor")
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0]?.createdAt ??
    null;
  const serviceHoursElapsed = serviceHoursBetween(question.createdAt, firstTutorResponseAt ?? now);
  return {
    questionId: question.id,
    targetServiceHours: 12,
    firstTutorResponseAt,
    serviceHoursElapsed,
    met: firstTutorResponseAt ? serviceHoursElapsed <= 12 : null,
  };
}

export async function notifyFollowers(
  database: DiscussionDatabase,
  questionId: string,
  actingUserId: string,
  type: "followed_question_activity",
  extra: { answerId?: string; commentId?: string },
) {
  const followerIds = await database.listFollowerUserIds(questionId);
  await Promise.all(
    followerIds
      .filter((id) => id !== actingUserId)
      .map((recipientId) =>
        createNotification(database, {
          recipientId,
          actorId: actingUserId,
          type,
          questionId,
          answerId: extra.answerId ?? null,
        }),
      ),
  );
}
