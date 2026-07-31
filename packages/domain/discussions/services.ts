import { ulid } from "ulid";
import { stripImageMetadata, type AllowedSubmissionMimeType } from "../assignments/services";
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
  type CreateAnswerInput,
  type CreateQuestionInput,
  type QuestionListInput,
} from "./schemas";
import type { DiscussionStorage } from "./storage";

const MAX_VOTES_PER_SERVICE_DAY = 5;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

function hasRole(actor: DiscussionActor, ...roles: DiscussionActor["roles"][number][]) {
  return roles.some((role) => actor.roles.includes(role));
}
function isStaff(actor: DiscussionActor) {
  return hasRole(actor, "administrator", "super_administrator");
}
function isTutor(actor: DiscussionActor) {
  return hasRole(actor, "tutor");
}
function isStudent(actor: DiscussionActor) {
  return hasRole(actor, "student");
}
function requireActor(actor: DiscussionActor | null | undefined): asserts actor is DiscussionActor {
  if (!actor?.userId)
    throw new DiscussionError(
      "UNAUTHENTICATED",
      "A signed-in account is required to use Learning Questions.",
      401,
    );
}

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

async function safeDisplayName(database: DiscussionDatabase, userId: string) {
  const identity = await database.getSafeDisplayIdentity(userId);
  if (!identity)
    throw new DiscussionError(
      "DISPLAY_IDENTITY_UNAVAILABLE",
      "A safe display identity is required before posting.",
      409,
    );
  return displayName(identity);
}

async function canAccessQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
): Promise<boolean> {
  if (isStaff(actor)) return true;
  if (question.visibility === "private_support") {
    return (
      (isStudent(actor) && actor.studentProfileId === question.studentProfileId) ||
      (hasRole(actor, "parent") &&
        (await database.isParentLinkedToStudent(actor.userId, question.studentProfileId))) ||
      (isTutor(actor) &&
        (await database.isTutorAssignedToStudent(actor.userId, question.studentProfileId)))
    );
  }
  if (!question.groupId) return false;
  return (
    (isStudent(actor) &&
      Boolean(actor.studentProfileId) &&
      (await database.isStudentInGroup(actor.studentProfileId ?? "", question.groupId))) ||
    (isTutor(actor) && (await database.isTutorAssignedToGroup(actor.userId, question.groupId)))
  );
}

async function requireQuestionAccess(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
) {
  if (!(await canAccessQuestion(database, actor, question)))
    throw new DiscussionError(
      "FORBIDDEN",
      "You do not have access to this learning question.",
      403,
    );
}

async function requireTutorAccess(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
) {
  if (isStaff(actor)) return;
  if (!isTutor(actor) || !(await canAccessQuestion(database, actor, question)))
    throw new DiscussionError(
      "FORBIDDEN",
      "Only a tutor responsible for this scope can moderate answers.",
      403,
    );
}

async function getQuestionOrThrow(database: DiscussionDatabase, questionId: string) {
  const question = await database.getQuestion(questionId);
  if (!question)
    throw new DiscussionError("QUESTION_NOT_FOUND", "Learning question was not found.", 404);
  return question;
}

export async function createQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  input: CreateQuestionInput,
): Promise<DiscussionQuestionRecord> {
  requireActor(actor);
  const values = createQuestionSchema.parse(input);
  if (!isStudent(actor) || actor.studentProfileId !== values.studentProfileId)
    throw new DiscussionError(
      "FORBIDDEN",
      "Only the signed-in student can ask a learning question.",
      403,
    );
  if (
    values.visibility === "group_shared" &&
    (!values.groupId || !(await database.isStudentInGroup(values.studentProfileId, values.groupId)))
  )
    throw new DiscussionError(
      "FORBIDDEN",
      "Shared questions must use one of the student's groups.",
      403,
    );
  const now = new Date();
  const piiFlags = detectPii(`${values.title}\n${values.body}`, now);
  const question: DiscussionQuestionRecord = {
    id: ulid(),
    courseId: values.courseId,
    groupId: values.groupId,
    subjectId: values.subjectId,
    studentProfileId: values.studentProfileId,
    authorUserId: actor.userId,
    authorDisplayName: await safeDisplayName(database, actor.userId),
    title: values.title,
    body: values.body,
    visibility: values.visibility,
    status: piiFlags.length ? "pending_moderation" : "open",
    piiFlags,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveQuestion(question);
  return question;
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

/** Tutors explicitly release a flagged question or close a resolved one; students cannot self-moderate. */
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
  await requireQuestionAccess(database, actor, question);
  const authorKind =
    isTutor(actor) || isStaff(actor) ? "tutor" : isStudent(actor) ? "student" : null;
  if (!authorKind)
    throw new DiscussionError(
      "FORBIDDEN",
      "Only tutors and approved students may answer learning questions.",
      403,
    );
  if (
    authorKind === "student" &&
    (!actor.studentProfileId ||
      !(await database.isApprovedStudentAnswerer(actor.studentProfileId, question.groupId)))
  )
    throw new DiscussionError(
      "FORBIDDEN",
      "Only approved students may answer learning questions.",
      403,
    );
  if (authorKind === "tutor") await requireTutorAccess(database, actor, question);
  const now = new Date();
  const answer: DiscussionAnswerRecord = {
    id: ulid(),
    questionId,
    authorUserId: actor.userId,
    authorDisplayName: await safeDisplayName(database, actor.userId),
    authorKind,
    body: values.body,
    // Tutor authorship is clear, but verification remains an explicit moderation action.
    verificationStatus: "unverified",
    verifiedByUserId: null,
    verifiedAt: null,
    piiFlags: detectPii(values.body, now),
    createdAt: now,
    updatedAt: now,
  };
  await database.saveAnswer(answer);
  return answer;
}

export async function listAnswersForActor(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
) {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireQuestionAccess(database, actor, question);
  return database.listAnswers(questionId);
}

export async function verifyAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<DiscussionAnswerRecord> {
  requireActor(actor);
  const answer = await database.getAnswer(answerId);
  if (!answer) throw new DiscussionError("ANSWER_NOT_FOUND", "Answer was not found.", 404);
  const question = await getQuestionOrThrow(database, answer.questionId);
  await requireTutorAccess(database, actor, question);
  if (answer.verificationStatus === "verified") return answer;
  const verifiedAt = new Date();
  await database.updateAnswerVerification(answer.id, actor.userId, verifiedAt);
  return {
    ...answer,
    verificationStatus: "verified",
    verifiedByUserId: actor.userId,
    verifiedAt,
    updatedAt: verifiedAt,
  };
}

export async function castLimitedHelpfulVote(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<DiscussionVoteRecord> {
  requireActor(actor);
  const answer = await database.getAnswer(answerId);
  if (!answer) throw new DiscussionError("ANSWER_NOT_FOUND", "Answer was not found.", 404);
  const question = await getQuestionOrThrow(database, answer.questionId);
  await requireQuestionAccess(database, actor, question);
  if (answer.authorUserId === actor.userId)
    throw new DiscussionError("FORBIDDEN", "You cannot vote on your own answer.", 403);
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
  if (question.authorUserId !== actor.userId && !isStaff(actor) && !isTutor(actor))
    throw new DiscussionError(
      "FORBIDDEN",
      "Only the question author or teaching staff may attach a file.",
      403,
    );
  if (!(["image/jpeg", "image/png", "application/pdf"] as string[]).includes(input.mimeType))
    throw new DiscussionError(
      "UPLOAD_NOT_ALLOWED",
      "This file type is not allowed for Learning Questions.",
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
    fileName: input.fileName.trim().slice(0, 255) || "learning-question-file",
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
