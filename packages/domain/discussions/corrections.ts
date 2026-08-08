import { ulid } from "ulid";
import {
  canProposeCorrection,
  canRequestRevision,
  canResolveCorrectionDispute,
  canRespondToCorrection,
  requireActor,
  requireQuestionAccess,
} from "./capabilities";
import { DiscussionError } from "./errors";
import type { DiscussionActor, DiscussionCorrectionRecord, DiscussionDatabase } from "./models";
import {
  createCorrectionSchema,
  resolveCorrectionSchema,
  respondToCorrectionSchema,
  type CreateCorrectionInput,
  type ResolveCorrectionInput,
  type RespondToCorrectionInput,
} from "./schemas";
import { createNotification } from "./notifications";
import { safeDisplayName } from "./services";

async function getAnswerAndQuestionOrThrow(database: DiscussionDatabase, answerId: string) {
  const answer = await database.getAnswer(answerId);
  if (!answer || answer.deletedAt)
    throw new DiscussionError("ANSWER_NOT_FOUND", "This answer was not found.", 404);
  const question = await database.getQuestion(answer.questionId);
  if (!question || question.deletedAt)
    throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
  return { answer, question };
}

/**
 * Step 1 of the correction workflow: submit what may be wrong, a suggested fix, and why. This
 * never overwrites the original answer — only `answer.authorResponse`/edits do that, and only the
 * author chooses to make that edit.
 */
export async function proposeCorrection(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
  input: CreateCorrectionInput,
): Promise<DiscussionCorrectionRecord> {
  requireActor(actor);
  const values = createCorrectionSchema.parse(input);
  const { answer, question } = await getAnswerAndQuestionOrThrow(database, answerId);
  await requireQuestionAccess(database, actor, question);
  if (!canProposeCorrection(actor, answer))
    throw new DiscussionError(
      "FORBIDDEN",
      "You cannot propose a correction on your own answer.",
      403,
    );
  const now = new Date();
  const correction: DiscussionCorrectionRecord = {
    id: ulid(),
    answerId,
    proposedById: actor.userId,
    proposedByDisplayName: await safeDisplayName(database, actor.userId),
    issueDescription: values.issueDescription,
    proposedCorrection: values.proposedCorrection,
    explanation: values.explanation ?? null,
    status: "pending",
    authorResponse: null,
    resolvedById: null,
    resolutionNote: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveCorrection(correction);
  await createNotification(database, {
    recipientId: answer.authorUserId,
    actorId: actor.userId,
    type: "answer_correction_suggested",
    questionId: question.id,
    answerId,
  });
  return correction;
}

/** Step 2: the answer author accepts, partially accepts, or rejects — always with an explanation. */
export async function respondToCorrection(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  correctionId: string,
  input: RespondToCorrectionInput,
): Promise<DiscussionCorrectionRecord> {
  requireActor(actor);
  const values = respondToCorrectionSchema.parse(input);
  const correction = await database.getCorrection(correctionId);
  if (!correction)
    throw new DiscussionError("CORRECTION_NOT_FOUND", "This correction was not found.", 404);
  const answer = await database.getAnswer(correction.answerId);
  if (!answer || answer.deletedAt)
    throw new DiscussionError("ANSWER_NOT_FOUND", "This answer was not found.", 404);
  if (!canRespondToCorrection(actor, answer))
    throw new DiscussionError(
      "FORBIDDEN",
      "Only the answer author can respond to this correction.",
      403,
    );
  const now = new Date();
  await database.updateCorrection(correctionId, {
    status: values.decision,
    authorResponse: values.authorResponse,
  });
  await createNotification(database, {
    recipientId: correction.proposedById,
    actorId: actor.userId,
    type: "answer_correction_resolved",
    questionId: answer.questionId,
    answerId: answer.id,
  });
  return {
    ...correction,
    status: values.decision,
    authorResponse: values.authorResponse,
    updatedAt: now,
  };
}

/** Step 3 (only on dispute): a tutor/admin resolves — the audit trail (this row) always remains available. */
export async function resolveCorrectionDispute(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  correctionId: string,
  input: ResolveCorrectionInput,
): Promise<DiscussionCorrectionRecord> {
  requireActor(actor);
  const values = resolveCorrectionSchema.parse(input);
  const correction = await database.getCorrection(correctionId);
  if (!correction)
    throw new DiscussionError("CORRECTION_NOT_FOUND", "This correction was not found.", 404);
  if (!canResolveCorrectionDispute(actor))
    throw new DiscussionError("FORBIDDEN", "Only a tutor can resolve a correction dispute.", 403);
  const now = new Date();
  await database.updateCorrection(correctionId, {
    status: "resolved",
    resolvedById: actor.userId,
    resolutionNote: values.resolutionNote,
    resolvedAt: now,
  });
  return {
    ...correction,
    status: "resolved",
    resolvedById: actor.userId,
    resolutionNote: values.resolutionNote,
    resolvedAt: now,
  };
}

export async function listCorrectionsForAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<DiscussionCorrectionRecord[]> {
  requireActor(actor);
  const { question } = await getAnswerAndQuestionOrThrow(database, answerId);
  await requireQuestionAccess(database, actor, question);
  return database.listCorrectionsForAnswer(answerId);
}

// `canRequestRevision` is re-exported for the tutor-review UI, which offers "request revision" and
// "resolve correction" as adjacent actions on the same panel.
export { canRequestRevision };
