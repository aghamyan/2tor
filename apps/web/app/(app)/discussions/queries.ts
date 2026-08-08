import { redirect } from "next/navigation";

import { DiscussionError } from "../../../../../packages/domain/discussions/errors";
import { getFeedForActor } from "../../../../../packages/domain/discussions/feed";
import type {
  DiscussionAnswerRecord,
  DiscussionAnswerTutorRatingRecord,
  DiscussionAttachmentRecord,
  DiscussionCommentRecord,
  DiscussionCorrectionRecord,
  DiscussionDatabase,
  DiscussionQuestionRecord,
  DiscussionReportRecord,
  DiscussionTagRecord,
} from "../../../../../packages/domain/discussions/models";
import { createDiscussionAttachmentSignedUrl } from "../../../../../packages/domain/discussions/signed-url";
import type { DiscussionFeedFilterInput } from "../../../../../packages/domain/discussions/schemas";
import {
  getDownloadableDiscussionAttachment,
  getQuestionBySlugForActor,
  getQuestionForActor,
  listAnswersForActor,
  recordQuestionView,
  safeDisplayName,
  tutorResponseSla,
} from "../../../../../packages/domain/discussions/services";
import { orderAnswersForDisplay } from "../../../../../packages/domain/discussions/ordering";
import { getRatingBreakdown, getMyRatingForAnswer, type RatingBreakdown } from "../../../../../packages/domain/discussions/ratings";
import { listCommentsForAnswer, listCommentsForQuestion } from "../../../../../packages/domain/discussions/comments";
import { listCorrectionsForAnswer } from "../../../../../packages/domain/discussions/corrections";
import { isFollowingQuestion, isQuestionSaved } from "../../../../../packages/domain/discussions/social";
import { listTagsForActor } from "../../../../../packages/domain/discussions/tags";
import {
  getChildActivitySummary,
  listLinkedChildren,
  type ChildActivitySummary,
} from "../../../../../packages/domain/discussions/parent-activity";
import { listReportsForModerator } from "../../../../../packages/domain/discussions/moderation";
import { previewText } from "../../../components/discussions/format";
import { listNotificationsForActor } from "../../../../../packages/domain/discussions/notifications";
import {
  canAskQuestion,
  canModerateAsTutor,
  canModerateContent,
  canReadAnalytics,
  isStaff,
  isTutor,
} from "../../../../../packages/domain/discussions/capabilities";
import type { DiscussionRole } from "../../../../../packages/domain/discussions/models";
import { currentDiscussionContext } from "./context";

function redirectIfUnauthenticated(error: unknown): never {
  if (error instanceof DiscussionError && error.code === "UNAUTHENTICATED") redirect("/login");
  throw error;
}

export interface DiscussionViewerContext {
  userId: string;
  roles: readonly DiscussionRole[];
  canAsk: boolean;
  isStaffViewer: boolean;
  isTutorViewer: boolean;
  isParentViewer: boolean;
}

/** Single place pages call to resolve "who is looking at this" — redirects to /login if not
 *  authenticated, same as every other loader in this file. */
export async function loadViewerContext(): Promise<DiscussionViewerContext> {
  try {
    const context = await currentDiscussionContext();
    return {
      userId: context.actor.userId,
      roles: context.actor.roles,
      canAsk: canAskQuestion(context.actor),
      isStaffViewer: isStaff(context.actor),
      isTutorViewer: isTutor(context.actor),
      isParentViewer: context.actor.roles.includes("parent"),
    };
  } catch (error: unknown) {
    return redirectIfUnauthenticated(error);
  }
}

export async function loadFeed(filter: DiscussionFeedFilterInput) {
  try {
    const context = await currentDiscussionContext();
    return await getFeedForActor(context.database, context.actor, filter);
  } catch (error: unknown) {
    if (error instanceof DiscussionError && error.code === "FORBIDDEN") return { items: [], nextCursor: null };
    return redirectIfUnauthenticated(error);
  }
}

export interface QuestionDetailAttachment extends DiscussionAttachmentRecord {
  downloadUrl: string;
}

export interface QuestionDetailData {
  question: DiscussionQuestionRecord;
  answers: DiscussionAnswerRecord[];
  attachments: QuestionDetailAttachment[];
  orderedAnswers: DiscussionAnswerRecord[];
  helpfulCounts: Map<string, number>;
  ratingsByAnswer: Map<string, RatingBreakdown>;
  myRatingByAnswer: Map<string, DiscussionAnswerTutorRatingRecord | null>;
  commentsByQuestion: DiscussionCommentRecord[];
  commentsByAnswer: Map<string, DiscussionCommentRecord[]>;
  correctionsByAnswer: Map<string, DiscussionCorrectionRecord[]>;
  tags: DiscussionTagRecord[];
  isFollowing: boolean;
  isSaved: boolean;
  viewerUserId: string;
  viewerIsStaff: boolean;
  viewerIsTutor: boolean;
  canUploadAttachment: boolean;
  sla: ReturnType<typeof tutorResponseSla>;
}

/**
 * Shared aggregation behind both `loadQuestionDetail` (by id) and `loadQuestionDetailBySlug` — the
 * only difference between the two entry points is how `question` gets resolved.
 * N+1 by design-for-now: 5 queries per answer (rating breakdown, my rating, comments, corrections,
 * helpful count). Fine at seed-data scale; the fix is dedicated batch methods on
 * `DiscussionDatabase` (`listRatingBreakdownsForAnswers(ids)` etc.) — tracked as a known limitation,
 * not done here.
 */
async function buildQuestionDetail(
  context: Awaited<ReturnType<typeof currentDiscussionContext>>,
  question: DiscussionQuestionRecord,
): Promise<QuestionDetailData> {
  const questionId = question.id;
  await recordQuestionView(context.database, context.viewDedup, questionId, context.actor.userId);
  const answers = await listAnswersForActor(context.database, context.actor, questionId);

  const helpfulCounts = new Map(
    await Promise.all(
      answers.map(async (answer) => [answer.id, await context.database.countVotesForAnswer(answer.id)] as const),
    ),
  );
  const orderedAnswers = orderAnswersForDisplay(answers, question, helpfulCounts);

  const [ratingsByAnswer, myRatingByAnswer, commentsByQuestion, commentsByAnswerEntries, correctionsByAnswerEntries, tags] =
    await Promise.all([
      Promise.all(
        answers.map(async (answer) => [answer.id, await getRatingBreakdown(context.database, context.actor, answer.id)] as const),
      ),
      Promise.all(
        answers.map(async (answer) => [answer.id, await getMyRatingForAnswer(context.database, context.actor, answer.id)] as const),
      ),
      listCommentsForQuestion(context.database, context.actor, questionId),
      Promise.all(
        answers.map(async (answer) => [answer.id, await listCommentsForAnswer(context.database, context.actor, answer.id)] as const),
      ),
      Promise.all(
        answers.map(async (answer) => [answer.id, await listCorrectionsForAnswer(context.database, context.actor, answer.id)] as const),
      ),
      context.database.listTagsForQuestion(questionId),
    ]);

  const [isFollowing, isSaved, rawAttachments, canModerateTutor] = await Promise.all([
    isFollowingQuestion(context.database, context.actor, questionId),
    isQuestionSaved(context.database, context.actor, questionId),
    context.database.listAttachments(questionId),
    canModerateAsTutor(context.database, context.actor, question),
  ]);
  const attachments = rawAttachments.map((attachment) => ({
    ...attachment,
    downloadUrl: createDiscussionAttachmentSignedUrl(attachment.id, context.actor.userId),
  }));
  const canUploadAttachment =
    question.authorUserId === context.actor.userId || isStaff(context.actor) || canModerateTutor;

  return {
    question,
    answers,
    attachments,
    orderedAnswers,
    helpfulCounts,
    ratingsByAnswer: new Map(ratingsByAnswer),
    myRatingByAnswer: new Map(myRatingByAnswer),
    commentsByQuestion,
    commentsByAnswer: new Map(commentsByAnswerEntries),
    correctionsByAnswer: new Map(correctionsByAnswerEntries),
    tags,
    isFollowing,
    isSaved,
    viewerUserId: context.actor.userId,
    viewerIsStaff: isStaff(context.actor),
    canUploadAttachment,
    viewerIsTutor: isTutor(context.actor),
    sla: tutorResponseSla(question, answers),
  };
}

/**
 * A viewer with no access to a private question sees the same "not found" as a genuinely missing
 * slug — not a 403 — so the page never confirms a private question's existence to someone who
 * can't see it.
 */
function nullOnNotFoundOrForbidden(error: unknown): null {
  if (error instanceof DiscussionError && (error.code === "FORBIDDEN" || error.code.endsWith("_NOT_FOUND"))) return null;
  return redirectIfUnauthenticated(error);
}

export async function loadQuestionDetail(questionId: string): Promise<QuestionDetailData | null> {
  try {
    const context = await currentDiscussionContext();
    const question = await getQuestionForActor(context.database, context.actor, questionId);
    return await buildQuestionDetail(context, question);
  } catch (error: unknown) {
    return nullOnNotFoundOrForbidden(error);
  }
}

export async function loadQuestionDetailBySlug(slug: string): Promise<QuestionDetailData | null> {
  try {
    const context = await currentDiscussionContext();
    const question = await getQuestionBySlugForActor(context.database, context.actor, slug);
    return await buildQuestionDetail(context, question);
  } catch (error: unknown) {
    return nullOnNotFoundOrForbidden(error);
  }
}

export async function loadTags(search?: string) {
  try {
    const context = await currentDiscussionContext();
    return await listTagsForActor(context.database, context.actor, search);
  } catch {
    return [];
  }
}

export async function loadDownloadableAttachment(attachmentId: string) {
  const context = await currentDiscussionContext();
  return getDownloadableDiscussionAttachment(context.database, context.actor, attachmentId);
}

export interface ChildOption {
  studentProfileId: string;
  displayName: string;
}

/** Resolves each linked child's safe display name for the family-activity child picker. */
export async function loadChildOptions(): Promise<ChildOption[]> {
  try {
    const context = await currentDiscussionContext();
    const studentProfileIds = await listLinkedChildren(context.database, context.actor);
    return await Promise.all(
      studentProfileIds.map(async (studentProfileId) => {
        const userId = await context.database.getUserIdForStudentProfile(studentProfileId);
        const name = userId ? await safeDisplayName(context.database, userId).catch(() => null) : null;
        return { studentProfileId, displayName: name ?? studentProfileId };
      }),
    );
  } catch {
    return [];
  }
}

export async function loadChildActivity(studentProfileId: string): Promise<ChildActivitySummary | null> {
  try {
    const context = await currentDiscussionContext();
    return await getChildActivitySummary(context.database, context.actor, studentProfileId);
  } catch (error: unknown) {
    if (error instanceof DiscussionError && error.code === "FORBIDDEN") return null;
    return redirectIfUnauthenticated(error);
  }
}

export interface ModerationQueueItem {
  report: DiscussionReportRecord;
  targetPreview: string;
  targetSlug: string | null;
  targetAuthorDisplayName: string | null;
  reporterDisplayName: string | null;
  assignedModeratorDisplayName: string | null;
}

async function resolveModerationTarget(
  database: DiscussionDatabase,
  report: DiscussionReportRecord,
): Promise<{ preview: string; slug: string | null; authorDisplayName: string | null }> {
  if (report.targetType === "discussion_question") {
    const question = await database.getQuestion(report.targetId);
    if (!question) return { preview: "", slug: null, authorDisplayName: null };
    return { preview: question.title, slug: question.slug, authorDisplayName: question.authorDisplayName };
  }
  if (report.targetType === "discussion_answer") {
    const answer = await database.getAnswer(report.targetId);
    if (!answer) return { preview: "", slug: null, authorDisplayName: null };
    const question = await database.getQuestion(answer.questionId);
    return { preview: previewText(answer.body, 160), slug: question?.slug ?? null, authorDisplayName: answer.authorDisplayName };
  }
  const comment = await database.getComment(report.targetId);
  if (!comment) return { preview: "", slug: null, authorDisplayName: null };
  const parentQuestionId =
    comment.questionId ?? (comment.answerId ? (await database.getAnswer(comment.answerId))?.questionId ?? null : null);
  const question = parentQuestionId ? await database.getQuestion(parentQuestionId) : null;
  return { preview: previewText(comment.body, 160), slug: question?.slug ?? null, authorDisplayName: comment.authorDisplayName };
}

/** Enriches each report with just enough target/reporter context for a moderator to act without
 *  opening a second tab — N+1 by design-for-now, same tradeoff as `buildQuestionDetail`. */
export async function loadModerationQueue(
  filter: Parameters<typeof listReportsForModerator>[2],
): Promise<ModerationQueueItem[]> {
  try {
    const context = await currentDiscussionContext();
    if (!canModerateContent(context.actor)) return [];
    const reports = await listReportsForModerator(context.database, context.actor, filter);
    return await Promise.all(
      reports.map(async (report) => {
        const target = await resolveModerationTarget(context.database, report);
        const [reporterDisplayName, assignedModeratorDisplayName] = await Promise.all([
          safeDisplayName(context.database, report.reporterId).catch(() => null),
          report.assignedModeratorId
            ? safeDisplayName(context.database, report.assignedModeratorId).catch(() => null)
            : Promise.resolve(null),
        ]);
        return {
          report,
          targetPreview: target.preview,
          targetSlug: target.slug,
          targetAuthorDisplayName: target.authorDisplayName,
          reporterDisplayName,
          assignedModeratorDisplayName,
        };
      }),
    );
  } catch {
    return [];
  }
}

export async function canViewAnalytics(): Promise<boolean> {
  const context = await currentDiscussionContext();
  return canReadAnalytics(context.actor);
}

export async function loadMyNotifications(unreadOnly = false) {
  try {
    const context = await currentDiscussionContext();
    return await listNotificationsForActor(context.database, context.actor, { unreadOnly, limit: 50 });
  } catch {
    return [];
  }
}

export async function loadAskScopeOptions() {
  try {
    const context = await currentDiscussionContext();
    if (!canAskQuestion(context.actor) || !context.actor.studentProfileId) return { courses: [], subjects: [] };
    return await context.database.listAskScopeOptionsForStudent(context.actor.studentProfileId);
  } catch {
    return { courses: [], subjects: [] };
  }
}
