import { ulid } from "ulid";
import {
  canCommentOnQuestion,
  canDeleteComment,
  canEditOwnComment,
  requireActor,
} from "./capabilities";
import { DiscussionError } from "./errors";
import type { DiscussionActor, DiscussionCommentRecord, DiscussionDatabase } from "./models";
import {
  createCommentSchema,
  updateCommentSchema,
  type CreateCommentInput,
  type UpdateCommentInput,
} from "./schemas";
import { createNotification } from "./notifications";
import { notifyFollowers, safeDisplayName } from "./services";

async function resolveQuestionForComment(
  database: DiscussionDatabase,
  values: { questionId?: string | null; answerId?: string | null },
) {
  if (values.questionId) {
    const question = await database.getQuestion(values.questionId);
    if (!question || question.deletedAt)
      throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
    return { question, answerId: null as string | null };
  }
  const answer = await database.getAnswer(values.answerId as string);
  if (!answer || answer.deletedAt)
    throw new DiscussionError("ANSWER_NOT_FOUND", "This answer was not found.", 404);
  const question = await database.getQuestion(answer.questionId);
  if (!question || question.deletedAt)
    throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
  return { question, answerId: answer.id, answerAuthorId: answer.authorUserId };
}

export async function createComment(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  input: CreateCommentInput,
): Promise<DiscussionCommentRecord> {
  requireActor(actor);
  const values = createCommentSchema.parse(input);
  const resolved = await resolveQuestionForComment(database, values);
  if (!(await canCommentOnQuestion(database, actor, resolved.question)))
    throw new DiscussionError("FORBIDDEN", "You do not have access to comment here.", 403);
  if (values.parentCommentId) {
    const parent = await database.getComment(values.parentCommentId);
    if (!parent || parent.deletedAt)
      throw new DiscussionError(
        "COMMENT_NOT_FOUND",
        "The comment being replied to was not found.",
        404,
      );
    if (parent.parentCommentId)
      throw new DiscussionError(
        "COMMENT_THREAD_TOO_DEEP",
        "Replies can only go one level deep.",
        400,
      );
  }
  const now = new Date();
  const comment: DiscussionCommentRecord = {
    id: ulid(),
    authorUserId: actor.userId,
    authorDisplayName: await safeDisplayName(database, actor.userId),
    questionId: values.questionId ?? null,
    answerId: values.answerId ?? null,
    parentCommentId: values.parentCommentId ?? null,
    body: values.body,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await database.transaction(async (tx) => {
    await tx.saveComment(comment);
    await tx.touchQuestionActivity(resolved.question.id, now);
  });
  const recipientId =
    "answerAuthorId" in resolved ? resolved.answerAuthorId : resolved.question.authorUserId;
  if (recipientId && recipientId !== actor.userId)
    await createNotification(database, {
      recipientId,
      actorId: actor.userId,
      type: "question_commented",
      questionId: resolved.question.id,
      answerId: resolved.answerId,
    });
  await notifyFollowers(
    database,
    resolved.question.id,
    actor.userId,
    "followed_question_activity",
    {},
  );
  return comment;
}

export async function updateComment(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  commentId: string,
  input: UpdateCommentInput,
): Promise<DiscussionCommentRecord> {
  requireActor(actor);
  const values = updateCommentSchema.parse(input);
  const comment = await database.getComment(commentId);
  if (!comment || comment.deletedAt)
    throw new DiscussionError("COMMENT_NOT_FOUND", "This comment was not found.", 404);
  if (!canEditOwnComment(actor, comment))
    throw new DiscussionError("FORBIDDEN", "You can only edit your own comment.", 403);
  await database.updateComment(commentId, { body: values.body });
  return { ...comment, body: values.body, updatedAt: new Date() };
}

export async function deleteComment(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  commentId: string,
): Promise<void> {
  requireActor(actor);
  const comment = await database.getComment(commentId);
  if (!comment || comment.deletedAt)
    throw new DiscussionError("COMMENT_NOT_FOUND", "This comment was not found.", 404);
  if (!canDeleteComment(actor, comment))
    throw new DiscussionError("FORBIDDEN", "You cannot delete this comment.", 403);
  await database.updateComment(commentId, { deletedAt: new Date() });
}

export async function listCommentsForQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<DiscussionCommentRecord[]> {
  requireActor(actor);
  const question = await database.getQuestion(questionId);
  if (!question || question.deletedAt)
    throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
  if (!(await canCommentOnQuestion(database, actor, question)))
    throw new DiscussionError("FORBIDDEN", "You do not have access to this question.", 403);
  const comments = await database.listCommentsForQuestion(questionId);
  return comments.filter((comment) => !comment.deletedAt);
}

export async function listCommentsForAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<DiscussionCommentRecord[]> {
  requireActor(actor);
  const answer = await database.getAnswer(answerId);
  if (!answer || answer.deletedAt)
    throw new DiscussionError("ANSWER_NOT_FOUND", "This answer was not found.", 404);
  const question = await database.getQuestion(answer.questionId);
  if (!question || question.deletedAt)
    throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
  if (!(await canCommentOnQuestion(database, actor, question)))
    throw new DiscussionError("FORBIDDEN", "You do not have access to this question.", 403);
  const comments = await database.listCommentsForAnswer(answerId);
  return comments.filter((comment) => !comment.deletedAt);
}
