import { ulid } from "ulid";
import { canModerateRatings, canRateAnswer, isStaff, requireActor } from "./capabilities";
import { DiscussionError } from "./errors";
import type {
  DiscussionActor,
  DiscussionAnswerTutorRatingRecord,
  DiscussionDatabase,
  DiscussionRatingAggregate,
} from "./models";
import {
  rateAnswerSchema,
  removeRatingSchema,
  invalidateRatingSchema,
  type RateAnswerInput,
} from "./schemas";
import { createNotification } from "./notifications";
import { safeDisplayName } from "./services";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The only source of truth is the set of active (not deleted, not invalidated) rating rows. */
async function recalculateAndStoreAggregate(
  database: DiscussionDatabase,
  answerId: string,
): Promise<DiscussionRatingAggregate> {
  const active = await database.listActiveRatingsForAnswer(answerId);
  const aggregate: DiscussionRatingAggregate = active.length
    ? {
        average: round1(active.reduce((sum, rating) => sum + rating.rating, 0) / active.length),
        count: active.length,
      }
    : { average: null, count: 0 };
  await database.updateAnswerRatingAggregate(answerId, aggregate);
  return aggregate;
}

async function getAnswerAndQuestionOrThrow(database: DiscussionDatabase, answerId: string) {
  const answer = await database.getAnswer(answerId);
  if (!answer || answer.deletedAt)
    throw new DiscussionError("ANSWER_NOT_FOUND", "This answer was not found.", 404);
  const question = await database.getQuestion(answer.questionId);
  if (!question || question.deletedAt)
    throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
  return { answer, question };
}

export async function rateAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
  input: RateAnswerInput,
): Promise<DiscussionAnswerTutorRatingRecord> {
  requireActor(actor);
  const values = rateAnswerSchema.parse(input);
  const { answer, question } = await getAnswerAndQuestionOrThrow(database, answerId);
  const eligibility = await canRateAnswer(database, actor, answer, question);
  if (!eligibility.allowed)
    throw new DiscussionError(
      "ANSWER_NOT_RATEABLE",
      eligibility.reason ?? "This answer cannot be rated.",
      403,
    );
  const existing = await database.getActiveRatingByTutorAndAnswer(answerId, actor.userId);
  if (existing)
    throw new DiscussionError(
      "DUPLICATE_RATING",
      "You have already rated this answer. Update your existing rating instead.",
      409,
    );
  const now = new Date();
  const rating: DiscussionAnswerTutorRatingRecord = {
    id: ulid(),
    answerId,
    tutorId: actor.userId,
    tutorDisplayName: await safeDisplayName(database, actor.userId),
    rating: values.rating as 1 | 2 | 3 | 4 | 5,
    publicFeedback: values.publicFeedback?.trim() || null,
    deletedAt: null,
    invalidatedAt: null,
    invalidatedById: null,
    invalidationReason: null,
    createdAt: now,
    updatedAt: now,
  };
  await database.transaction(async (tx) => {
    await tx.saveRating(rating);
    await recalculateAndStoreAggregate(tx, answerId);
  });
  await createNotification(database, {
    recipientId: answer.authorUserId,
    actorId: actor.userId,
    type: "answer_tutor_rated",
    questionId: question.id,
    answerId,
    ratingId: rating.id,
  });
  return rating;
}

export async function updateRating(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  ratingId: string,
  input: RateAnswerInput,
): Promise<DiscussionAnswerTutorRatingRecord> {
  requireActor(actor);
  const values = rateAnswerSchema.parse(input);
  const existing = await database.getRating(ratingId);
  if (!existing || existing.deletedAt || existing.invalidatedAt)
    throw new DiscussionError("RATING_NOT_FOUND", "This rating was not found.", 404);
  if (existing.tutorId !== actor.userId)
    throw new DiscussionError("FORBIDDEN", "You can only update your own rating.", 403);
  const now = new Date();
  const updated: DiscussionAnswerTutorRatingRecord = {
    ...existing,
    rating: values.rating as 1 | 2 | 3 | 4 | 5,
    publicFeedback: values.publicFeedback?.trim() || null,
    updatedAt: now,
  };
  await database.transaction(async (tx) => {
    await tx.saveRating(updated);
    await recalculateAndStoreAggregate(tx, existing.answerId);
  });
  const answer = await database.getAnswer(existing.answerId);
  if (answer)
    await createNotification(database, {
      recipientId: answer.authorUserId,
      actorId: actor.userId,
      type: "answer_tutor_rating_updated",
      questionId: answer.questionId,
      answerId: existing.answerId,
      ratingId,
    });
  return updated;
}

export async function removeRating(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  ratingId: string,
  input?: { reason?: string | null },
): Promise<void> {
  requireActor(actor);
  removeRatingSchema.parse(input ?? {});
  const existing = await database.getRating(ratingId);
  if (!existing || existing.deletedAt || existing.invalidatedAt)
    throw new DiscussionError("RATING_NOT_FOUND", "This rating was not found.", 404);
  if (existing.tutorId !== actor.userId && !isStaff(actor))
    throw new DiscussionError("FORBIDDEN", "You can only remove your own rating.", 403);
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx.saveRating({ ...existing, deletedAt: now, updatedAt: now });
    await recalculateAndStoreAggregate(tx, existing.answerId);
  });
  const answer = await database.getAnswer(existing.answerId);
  if (answer)
    await createNotification(database, {
      recipientId: answer.authorUserId,
      actorId: actor.userId,
      type: "answer_tutor_rating_removed",
      questionId: answer.questionId,
      answerId: existing.answerId,
      ratingId,
    });
}

/** Admin-only: invalidates another tutor's rating with a documented reason instead of overwriting it. */
export async function invalidateRating(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  ratingId: string,
  input: { reason: string },
): Promise<void> {
  requireActor(actor);
  const values = invalidateRatingSchema.parse(input);
  if (!canModerateRatings(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can invalidate a rating.", 403);
  const existing = await database.getRating(ratingId);
  if (!existing || existing.deletedAt)
    throw new DiscussionError("RATING_NOT_FOUND", "This rating was not found.", 404);
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx.saveRating({
      ...existing,
      invalidatedAt: now,
      invalidatedById: actor.userId,
      invalidationReason: values.reason,
      updatedAt: now,
    });
    await recalculateAndStoreAggregate(tx, existing.answerId);
  });
}

/** Admin-only: reverses `invalidateRating`, restoring the rating to the active aggregate. */
export async function restoreRating(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  ratingId: string,
): Promise<void> {
  requireActor(actor);
  if (!canModerateRatings(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can restore a rating.", 403);
  const existing = await database.getRating(ratingId);
  if (!existing) throw new DiscussionError("RATING_NOT_FOUND", "This rating was not found.", 404);
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx.saveRating({
      ...existing,
      invalidatedAt: null,
      invalidatedById: null,
      invalidationReason: null,
      updatedAt: now,
    });
    await recalculateAndStoreAggregate(tx, existing.answerId);
  });
}

export interface RatingBreakdown {
  average: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  ratings: DiscussionAnswerTutorRatingRecord[];
}

/** Admins see invalidated ratings too (full audit); everyone else sees only active ones. */
export async function getRatingBreakdown(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<RatingBreakdown> {
  requireActor(actor);
  const ratings = isStaff(actor)
    ? await database.listAllRatingsForAnswer(answerId)
    : await database.listActiveRatingsForAnswer(answerId);
  const visible = isStaff(actor)
    ? ratings
    : ratings.filter((rating) => !rating.deletedAt && !rating.invalidatedAt);
  const distribution: RatingBreakdown["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const active = visible.filter((rating) => !rating.deletedAt && !rating.invalidatedAt);
  for (const rating of active) distribution[rating.rating] += 1;
  const sorted = [...visible].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    average: active.length
      ? round1(active.reduce((sum, r) => sum + r.rating, 0) / active.length)
      : null,
    count: active.length,
    distribution,
    ratings: sorted,
  };
}

export async function getMyRatingForAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<DiscussionAnswerTutorRatingRecord | null> {
  requireActor(actor);
  if (!isStaff(actor) && !actor.roles.includes("tutor")) return null;
  return database.getActiveRatingByTutorAndAnswer(answerId, actor.userId);
}
