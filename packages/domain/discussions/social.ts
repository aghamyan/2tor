import { requireActor, requireQuestionAccess } from "./capabilities";
import { DiscussionError } from "./errors";
import type { DiscussionActor, DiscussionDatabase } from "./models";

async function getQuestionOrThrow(database: DiscussionDatabase, questionId: string) {
  const question = await database.getQuestion(questionId);
  if (!question || question.deletedAt)
    throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
  return question;
}

export async function followQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<void> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireQuestionAccess(database, actor, question);
  await database.saveFollow(actor.userId, questionId);
}

export async function unfollowQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<void> {
  requireActor(actor);
  await database.removeFollow(actor.userId, questionId);
}

export async function isFollowingQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<boolean> {
  requireActor(actor);
  return database.hasFollow(actor.userId, questionId);
}

export async function saveQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<void> {
  requireActor(actor);
  const question = await getQuestionOrThrow(database, questionId);
  await requireQuestionAccess(database, actor, question);
  await database.saveBookmark(actor.userId, questionId);
}

export async function unsaveQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<void> {
  requireActor(actor);
  await database.removeBookmark(actor.userId, questionId);
}

export async function isQuestionSaved(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<boolean> {
  requireActor(actor);
  return database.hasBookmark(actor.userId, questionId);
}
