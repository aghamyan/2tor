"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { DiscussionError, isDiscussionError } from "../../../../../packages/domain/discussions/errors";
import {
  acceptAnswer,
  castLimitedHelpfulVote,
  closeQuestion,
  createAnswer,
  createQuestion,
  deleteAnswer,
  deleteQuestion,
  lockQuestion,
  markDuplicate,
  reopenQuestion,
  requestAnswerRevision,
  unacceptAnswer,
  unlockQuestion,
  updateAnswer,
  updateQuestion,
  uploadQuestionAttachment,
  verifyAnswer,
} from "../../../../../packages/domain/discussions/services";
import { createS3DiscussionStorage } from "../../../../../packages/domain/discussions/s3-storage";
import {
  rateAnswer,
  removeRating,
  invalidateRating,
  updateRating,
} from "../../../../../packages/domain/discussions/ratings";
import {
  createComment,
  deleteComment,
  updateComment,
} from "../../../../../packages/domain/discussions/comments";
import {
  proposeCorrection,
  respondToCorrection,
  resolveCorrectionDispute,
} from "../../../../../packages/domain/discussions/corrections";
import {
  followQuestion,
  saveQuestion,
  unfollowQuestion,
  unsaveQuestion,
} from "../../../../../packages/domain/discussions/social";
import {
  assignReport,
  removeAnswer as moderationRemoveAnswer,
  removeComment as moderationRemoveComment,
  removeQuestion as moderationRemoveQuestion,
  reportContent,
  resolveReport,
  restoreAnswer as moderationRestoreAnswer,
  restoreQuestion as moderationRestoreQuestion,
} from "../../../../../packages/domain/discussions/moderation";
import { markNotificationRead } from "../../../../../packages/domain/discussions/notifications";
import type { DiscussionActionState } from "./action-state";
import { currentDiscussionContext } from "./context";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function nullableStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}
function list(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function errorState(error: unknown): DiscussionActionState {
  if (error instanceof z.ZodError)
    return { status: "error", message: "errors.invalid", fieldErrors: error.flatten().fieldErrors };
  if (isDiscussionError(error)) {
    const message: DiscussionActionState["message"] =
      error.code === "UNAUTHENTICATED"
        ? "errors.unauthenticated"
        : error.code === "FORBIDDEN"
          ? "errors.forbidden"
          : error.code.endsWith("_NOT_FOUND")
            ? "errors.notFound"
            : error.code === "DUPLICATE_RATING" ||
                error.code === "VOTE_LIMIT_REACHED" ||
                error.code === "QUESTION_LOCKED" ||
                error.code === "QUESTION_CLOSED"
              ? "errors.conflict"
              : error.code === "RATE_LIMITED"
                ? "errors.rateLimited"
                : error.status < 500
                  ? "errors.invalid"
                  : "errors.generic";
    return { status: "error", message, fieldErrors: {} };
  }
  return { status: "error", message: "errors.generic", fieldErrors: {} };
}

// ---- Questions ----------------------------------------------------------------------------

export async function askQuestionAction(
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    const question = await createQuestion(context.database, context.actor, {
      studentProfileId: str(formData, "studentProfileId") || context.actor.studentProfileId || "",
      courseId: nullableStr(formData, "courseId"),
      groupId: nullableStr(formData, "groupId"),
      subjectId: nullableStr(formData, "subjectId"),
      topicId: nullableStr(formData, "topicId"),
      title: str(formData, "title"),
      body: str(formData, "body"),
      gradeLevel: nullableStr(formData, "gradeLevel"),
      questionType: (str(formData, "questionType") || "general_discussion") as never,
      whatTried: nullableStr(formData, "whatTried"),
      visibility: (str(formData, "visibility") || "private_support") as never,
      relatedClassId: nullableStr(formData, "relatedClassId"),
      tags: list(formData, "tags"),
    });
    revalidatePath("/discussions");
    // No redirect here: the client uploads any staged attachments to `question.id` first, then
    // navigates itself — a redirect would end the action before that upload could happen.
    return {
      status: "success",
      message: "questionPosted",
      fieldErrors: {},
      slug: question.slug,
      questionId: question.id,
    };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function uploadQuestionAttachmentAction(
  questionId: string,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new DiscussionError("INVALID_INPUT", "A file is required.", 400);
    await uploadQuestionAttachment(
      context.database,
      createS3DiscussionStorage(),
      context.actor,
      questionId,
      { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      new Uint8Array(await file.arrayBuffer()),
    );
    revalidatePath(`/discussions/${questionId}`);
    return { status: "success", message: "attachmentUploaded", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function updateQuestionAction(
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await updateQuestion(context.database, context.actor, questionId, {
      title: nullableStr(formData, "title") ?? undefined,
      body: nullableStr(formData, "body") ?? undefined,
      editReason: nullableStr(formData, "editReason"),
      tags: formData.has("tags") ? list(formData, "tags") : undefined,
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "questionUpdated", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function deleteQuestionAction(questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await deleteQuestion(context.database, context.actor, questionId);
    revalidatePath("/discussions");
  } catch (error: unknown) {
    unstable_rethrow(error);
    return errorState(error);
  }
  redirect("/discussions");
}

export async function closeQuestionAction(
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await closeQuestion(context.database, context.actor, questionId, str(formData, "reason"));
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "questionClosed", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function reopenQuestionAction(questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await reopenQuestion(context.database, context.actor, questionId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "questionReopened", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function lockQuestionAction(questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await lockQuestion(context.database, context.actor, questionId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "questionLocked", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function unlockQuestionAction(questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await unlockQuestion(context.database, context.actor, questionId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "questionUnlocked", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function markDuplicateAction(
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await markDuplicate(context.database, context.actor, questionId, str(formData, "duplicateOfQuestionId"));
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "questionMarkedDuplicate", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function followQuestionAction(questionId: string, follow: boolean): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    if (follow) await followQuestion(context.database, context.actor, questionId);
    else await unfollowQuestion(context.database, context.actor, questionId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: follow ? "followed" : "unfollowed", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function saveQuestionAction(questionId: string, saveIt: boolean): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    if (saveIt) await saveQuestion(context.database, context.actor, questionId);
    else await unsaveQuestion(context.database, context.actor, questionId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: saveIt ? "saved" : "unsaved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

// ---- Answers --------------------------------------------------------------------------------

export async function postAnswerAction(
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await createAnswer(context.database, context.actor, questionId, { body: str(formData, "body") });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "answerPosted", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function updateAnswerAction(
  answerId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await updateAnswer(context.database, context.actor, answerId, {
      body: str(formData, "body"),
      editReason: nullableStr(formData, "editReason"),
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "answerUpdated", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function deleteAnswerAction(answerId: string, questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await deleteAnswer(context.database, context.actor, answerId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "answerDeleted", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function acceptAnswerAction(answerId: string, questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await acceptAnswer(context.database, context.actor, answerId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "answerAccepted", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function castHelpfulVoteAction(answerId: string, questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await castLimitedHelpfulVote(context.database, context.actor, answerId);
    revalidatePath(`/discussions/${questionId}`);
    return { status: "success", message: "helpfulVoted", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function unacceptAnswerAction(questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await unacceptAnswer(context.database, context.actor, questionId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "answerUnaccepted", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function verifyAnswerAction(
  answerId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await verifyAnswer(context.database, context.actor, answerId, {
      verificationStatus: str(formData, "verificationStatus") as never,
      verificationNote: nullableStr(formData, "verificationNote"),
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "answerVerified", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function requestRevisionAction(
  answerId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await requestAnswerRevision(context.database, context.actor, answerId, str(formData, "note"));
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "revisionRequested", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

// ---- Ratings --------------------------------------------------------------------------------

export async function rateAnswerAction(
  answerId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await rateAnswer(context.database, context.actor, answerId, {
      rating: Number(str(formData, "rating")),
      publicFeedback: nullableStr(formData, "publicFeedback"),
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "ratingSaved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function updateRatingAction(
  ratingId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await updateRating(context.database, context.actor, ratingId, {
      rating: Number(str(formData, "rating")),
      publicFeedback: nullableStr(formData, "publicFeedback"),
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "ratingUpdated", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function removeRatingAction(ratingId: string, questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await removeRating(context.database, context.actor, ratingId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "ratingRemoved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function invalidateRatingAction(
  ratingId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await invalidateRating(context.database, context.actor, ratingId, { reason: str(formData, "reason") });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "ratingInvalidated", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

// ---- Comments -------------------------------------------------------------------------------

export async function postCommentAction(
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await createComment(context.database, context.actor, {
      questionId: nullableStr(formData, "questionId"),
      answerId: nullableStr(formData, "answerId"),
      parentCommentId: nullableStr(formData, "parentCommentId"),
      body: str(formData, "body"),
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "commentPosted", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function updateCommentAction(
  commentId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await updateComment(context.database, context.actor, commentId, { body: str(formData, "body") });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "commentUpdated", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function deleteCommentAction(commentId: string, questionId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await deleteComment(context.database, context.actor, commentId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "commentDeleted", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

// ---- Corrections ----------------------------------------------------------------------------

export async function proposeCorrectionAction(
  answerId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await proposeCorrection(context.database, context.actor, answerId, {
      issueDescription: str(formData, "issueDescription"),
      proposedCorrection: str(formData, "proposedCorrection"),
      explanation: nullableStr(formData, "explanation"),
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "correctionProposed", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function respondToCorrectionAction(
  correctionId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await respondToCorrection(context.database, context.actor, correctionId, {
      decision: str(formData, "decision") as never,
      authorResponse: str(formData, "authorResponse"),
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "correctionResponded", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function resolveCorrectionAction(
  correctionId: string,
  questionId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await resolveCorrectionDispute(context.database, context.actor, correctionId, {
      resolutionNote: str(formData, "resolutionNote"),
    });
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "correctionResolved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

// ---- Reporting & moderation -------------------------------------------------------------------

export async function reportContentAction(
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await reportContent(context.database, context.actor, {
      targetType: str(formData, "targetType") as never,
      targetId: str(formData, "targetId"),
      reason: str(formData, "reason"),
      details: nullableStr(formData, "details"),
    });
    return { status: "success", message: "reported", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function assignReportAction(reportId: string, moderatorId: string): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await assignReport(context.database, context.audit, context.actor, reportId, moderatorId);
    revalidatePath("/discussions/moderation");
    return { status: "success", message: "reportAssigned", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function resolveReportAction(
  reportId: string,
  _previous: DiscussionActionState,
  formData: FormData,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    await resolveReport(context.database, context.audit, context.actor, reportId, {
      status: str(formData, "status") as never,
      severity: nullableStr(formData, "severity") as never,
      resolutionNote: str(formData, "resolutionNote"),
    });
    revalidatePath("/discussions/moderation");
    return { status: "success", message: "reportResolved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function removeContentAction(
  targetType: "question" | "answer" | "comment",
  targetId: string,
  questionId: string,
  reason: string,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    if (targetType === "question") await moderationRemoveQuestion(context.database, context.audit, context.actor, targetId, reason);
    else if (targetType === "answer") await moderationRemoveAnswer(context.database, context.audit, context.actor, targetId, reason);
    else await moderationRemoveComment(context.database, context.audit, context.actor, targetId, reason);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "contentRemoved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function restoreContentAction(
  targetType: "question" | "answer",
  targetId: string,
  questionId: string,
): Promise<DiscussionActionState> {
  try {
    const context = await currentDiscussionContext();
    if (targetType === "question") await moderationRestoreQuestion(context.database, context.audit, context.actor, targetId);
    else await moderationRestoreAnswer(context.database, context.audit, context.actor, targetId);
    revalidatePath(`/discussions/questions/${questionId}`);
    return { status: "success", message: "contentRestored", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  try {
    const context = await currentDiscussionContext();
    await markNotificationRead(context.database, context.actor, notificationId);
    revalidatePath("/discussions/my-activity");
  } catch (error: unknown) {
    if (error instanceof DiscussionError) return;
    throw error;
  }
}
