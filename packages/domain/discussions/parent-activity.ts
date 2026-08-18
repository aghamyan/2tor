import { canReadChildActivity, requireActor } from "./capabilities";
import { DiscussionError } from "./errors";
import type {
  DiscussionActor,
  DiscussionAnswerRecord,
  DiscussionDatabase,
  DiscussionQuestionRecord,
} from "./models";

export interface ChildActivityTimelineEntry {
  kind: "question_asked" | "answer_submitted" | "answer_accepted" | "answer_tutor_verified";
  at: Date;
  questionId: string;
  questionSlug: string;
  questionTitle: string;
  answerId: string | null;
}

export interface ChildActivitySummary {
  studentProfileId: string;
  questionsAskedThisMonth: number;
  answersSubmittedThisMonth: number;
  acceptedAnswers: number;
  tutorVerifiedAnswers: number;
  averageRatingOnRecentAnswers: number | null;
  unresolvedQuestions: DiscussionQuestionRecord[];
  topicsRequiringSupport: string[];
  recentTutorFeedback: Array<{
    answerId: string;
    questionId: string;
    questionSlug: string;
    questionTitle: string;
    verificationStatus: DiscussionAnswerRecord["verificationStatus"];
    verificationNote: string | null;
    verifiedAt: Date | null;
  }>;
  recentActivity: ChildActivityTimelineEntry[];
}

const UNRESOLVED_STATUSES = new Set(["open", "needs_tutor_review", "needs_clarification"]);

/**
 * Read-focused and deliberately not surveillance: no message-level detail, no comparisons to
 * other students, no permanent scores — just enough for a parent to see where their child is
 * asking for help and how tutors have responded.
 */
export async function getChildActivitySummary(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  studentProfileId: string,
): Promise<ChildActivitySummary> {
  requireActor(actor);
  if (!(await canReadChildActivity(database, actor, studentProfileId)))
    throw new DiscussionError("FORBIDDEN", "You do not have access to this child's activity.", 403);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [questions, childUserId] = await Promise.all([
    database.listQuestionsByStudent(studentProfileId),
    database.getUserIdForStudentProfile(studentProfileId),
  ]);
  const answers = childUserId ? await database.listAnswersByAuthorUserId(childUserId) : [];

  const questionsAskedThisMonth = questions.filter((q) => q.createdAt >= startOfMonth).length;
  const answersSubmittedThisMonth = answers.filter((a) => a.createdAt >= startOfMonth).length;
  const acceptedAnswers = answers.filter((a) => a.isAccepted).length;
  const tutorVerifiedAnswers = answers.filter(
    (a) => a.verificationStatus === "correct" || a.verificationStatus === "mostly_correct",
  ).length;

  const recentRated = answers
    .filter((a) => a.tutorRatingCount > 0)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);
  const averageRatingOnRecentAnswers = recentRated.length
    ? Math.round(
        (recentRated.reduce((sum, a) => sum + (a.tutorRatingAverage ?? 0), 0) /
          recentRated.length) *
          10,
      ) / 10
    : null;

  const questionById = new Map(questions.map((q) => [q.id, q]));
  // `answers` includes peer answers on questions this student didn't ask (and so aren't in
  // `questions`) — resolve those separately so titles/slugs below are never silently blank.
  const answeredQuestionIds = [
    ...new Set(answers.map((a) => a.questionId).filter((id) => !questionById.has(id))),
  ];
  const answeredQuestions = await Promise.all(
    answeredQuestionIds.map((id) => database.getQuestion(id)),
  );
  for (const q of answeredQuestions) if (q) questionById.set(q.id, q);

  const unresolvedQuestions = questions.filter((q) => UNRESOLVED_STATUSES.has(q.status));
  const topicsRequiringSupport = [
    ...new Set(unresolvedQuestions.map((q) => q.topicId).filter((id): id is string => Boolean(id))),
  ];

  const recentTutorFeedback = answers
    .filter((a) => a.verifiedAt)
    .sort((a, b) => (b.verifiedAt?.getTime() ?? 0) - (a.verifiedAt?.getTime() ?? 0))
    .slice(0, 10)
    .map((a) => ({
      answerId: a.id,
      questionId: a.questionId,
      questionSlug: questionById.get(a.questionId)?.slug ?? "",
      questionTitle: questionById.get(a.questionId)?.title ?? "",
      verificationStatus: a.verificationStatus,
      verificationNote: a.verificationNote,
      verifiedAt: a.verifiedAt,
    }));

  const recentActivity: ChildActivityTimelineEntry[] = [
    ...questions.map((q) => ({
      kind: "question_asked" as const,
      at: q.createdAt,
      questionId: q.id,
      questionSlug: q.slug,
      questionTitle: q.title,
      answerId: null,
    })),
    ...answers.map((a) => ({
      kind: "answer_submitted" as const,
      at: a.createdAt,
      questionId: a.questionId,
      questionSlug: questionById.get(a.questionId)?.slug ?? "",
      questionTitle: questionById.get(a.questionId)?.title ?? "",
      answerId: a.id,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 20);

  return {
    studentProfileId,
    questionsAskedThisMonth,
    answersSubmittedThisMonth,
    acceptedAnswers,
    tutorVerifiedAnswers,
    averageRatingOnRecentAnswers,
    unresolvedQuestions,
    topicsRequiringSupport,
    recentTutorFeedback,
    recentActivity,
  };
}

export async function listLinkedChildren(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
): Promise<string[]> {
  requireActor(actor);
  if (!actor.roles.includes("parent")) return [];
  return database.listLinkedChildStudentProfileIds(actor.userId);
}
