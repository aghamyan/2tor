import { DiscussionError } from "./errors";
import type {
  DiscussionActor,
  DiscussionAnswerRecord,
  DiscussionCommentRecord,
  DiscussionDatabase,
  DiscussionQuestionRecord,
  DiscussionRole,
} from "./models";

/**
 * Centralized, capability-named permission checks for MathOverflow (the "discussions" module
 * internally — see `branding.ts`). Every server action/route/service calls into this file instead
 * of inlining a role check, and UI components read the same functions to decide what to render —
 * a single source of truth, never a client-only gate. Names match the product spec's
 * `forum.*` capability list even though tables/files keep the module's original "discussion"
 * naming (see `README.md`).
 */
export type ForumCapability =
  | "forum.question.create"
  | "forum.question.read"
  | "forum.question.editOwn"
  | "forum.question.editAny"
  | "forum.question.deleteOwn"
  | "forum.question.deleteAny"
  | "forum.question.close"
  | "forum.question.reopen"
  | "forum.question.lock"
  | "forum.question.merge"
  | "forum.question.follow"
  | "forum.question.save"
  | "forum.answer.create"
  | "forum.answer.read"
  | "forum.answer.editOwn"
  | "forum.answer.editAny"
  | "forum.answer.accept"
  | "forum.answer.verify"
  | "forum.answer.rate"
  | "forum.answer.ratingModerate"
  | "forum.answer.requestRevision"
  | "forum.comment.create"
  | "forum.comment.editOwn"
  | "forum.comment.deleteOwn"
  | "forum.comment.moderate"
  | "forum.correction.create"
  | "forum.correction.respond"
  | "forum.correction.resolve"
  | "forum.content.report"
  | "forum.content.moderate"
  | "forum.childActivity.read"
  | "forum.analytics.read"
  | "forum.settings.manage";

function hasRole(actor: DiscussionActor, ...roles: DiscussionRole[]) {
  return roles.some((role) => actor.roles.includes(role));
}
export function isStaff(actor: DiscussionActor) {
  return hasRole(actor, "administrator", "super_administrator");
}
export function isTutor(actor: DiscussionActor) {
  return hasRole(actor, "tutor");
}
export function isStudent(actor: DiscussionActor) {
  return hasRole(actor, "student");
}
export function isParent(actor: DiscussionActor) {
  return hasRole(actor, "parent");
}

export function requireActor(
  actor: DiscussionActor | null | undefined,
): asserts actor is DiscussionActor {
  if (!actor?.userId)
    throw new DiscussionError(
      "UNAUTHENTICATED",
      "A signed-in account is required to use MathOverflow.",
      401,
    );
}

/**
 * The single visibility gate. `community` still means "any authenticated platform member with an
 * applicable role" — never an unauthenticated reader (every page keeps `robots: noindex`).
 * `tutors_only` deliberately does not extend to parents beyond their own linked child, mirroring
 * `private_support` — it exists for students who want tutor eyes only, not the whole community.
 */
export async function canAccessQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: Pick<DiscussionQuestionRecord, "visibility" | "studentProfileId" | "groupId">,
): Promise<boolean> {
  if (isStaff(actor)) return true;
  const isOwnStudent = isStudent(actor) && actor.studentProfileId === question.studentProfileId;
  const isLinkedParent =
    isParent(actor) &&
    (await database.isParentLinkedToStudent(actor.userId, question.studentProfileId));
  const isAssignedTutor =
    isTutor(actor) &&
    (await database.isTutorAssignedToStudent(actor.userId, question.studentProfileId));

  if (question.visibility === "community") {
    return isOwnStudent || isLinkedParent || isTutor(actor) || (isStudent(actor) && true);
  }
  if (question.visibility === "tutors_only") {
    return isOwnStudent || isLinkedParent || isTutor(actor);
  }
  if (question.visibility === "private_support") {
    return isOwnStudent || isLinkedParent || isAssignedTutor;
  }
  // group_shared
  if (!question.groupId) return false;
  return (
    isOwnStudent ||
    isLinkedParent ||
    (isStudent(actor) &&
      Boolean(actor.studentProfileId) &&
      (await database.isStudentInGroup(actor.studentProfileId ?? "", question.groupId))) ||
    (isTutor(actor) && (await database.isTutorAssignedToGroup(actor.userId, question.groupId)))
  );
}

export async function requireQuestionAccess(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: Pick<DiscussionQuestionRecord, "visibility" | "studentProfileId" | "groupId">,
) {
  if (!(await canAccessQuestion(database, actor, question)))
    throw new DiscussionError("FORBIDDEN", "You do not have access to this question.", 403);
}

/** Tutor/staff moderation eligibility follows the same scope rule as read access. */
export async function canModerateAsTutor(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: Pick<DiscussionQuestionRecord, "visibility" | "studentProfileId" | "groupId">,
): Promise<boolean> {
  if (isStaff(actor)) return true;
  if (!isTutor(actor)) return false;
  return canAccessQuestion(database, actor, question);
}

export async function requireTutorAccess(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: Pick<DiscussionQuestionRecord, "visibility" | "studentProfileId" | "groupId">,
) {
  if (!(await canModerateAsTutor(database, actor, question)))
    throw new DiscussionError(
      "FORBIDDEN",
      "Only a tutor with access to this question can do that.",
      403,
    );
}

export function canAskQuestion(actor: DiscussionActor): boolean {
  return isStudent(actor) && Boolean(actor.studentProfileId);
}

export function isQuestionLocked(question: Pick<DiscussionQuestionRecord, "lockedAt" | "status">) {
  return Boolean(question.lockedAt) || question.status === "locked";
}
export function isQuestionClosed(question: Pick<DiscussionQuestionRecord, "closedAt" | "status">) {
  return (
    Boolean(question.closedAt) || question.status === "closed" || question.status === "duplicate"
  );
}

export function canEditQuestion(
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
): boolean {
  if (isStaff(actor)) return true;
  if (isQuestionLocked(question)) return false;
  return question.authorUserId === actor.userId;
}

/** A student may remove their own question only before anyone else has invested effort in it. */
export function canDeleteQuestion(
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
  hasContributions: boolean,
): boolean {
  if (isStaff(actor)) return true;
  if (isQuestionLocked(question)) return false;
  return question.authorUserId === actor.userId && !hasContributions;
}

export function canCloseOrReopenQuestion(actor: DiscussionActor): boolean {
  return isStaff(actor) || isTutor(actor);
}
export function canMergeDuplicates(actor: DiscussionActor): boolean {
  return isStaff(actor) || isTutor(actor);
}
export function canLockQuestion(actor: DiscussionActor): boolean {
  return isStaff(actor);
}

export async function canCreateAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
): Promise<{ allowed: boolean; authorKind: "student" | "tutor" | null; reason?: string }> {
  if (isQuestionLocked(question) || isQuestionClosed(question))
    return {
      allowed: false,
      authorKind: null,
      reason: "This question is not accepting new answers.",
    };
  if (!(await canAccessQuestion(database, actor, question)))
    return { allowed: false, authorKind: null, reason: "You do not have access to this question." };
  if (isTutor(actor) || isStaff(actor)) return { allowed: true, authorKind: "tutor" };
  if (isStudent(actor)) {
    if (
      !actor.studentProfileId ||
      !(await database.isApprovedStudentAnswerer(actor.studentProfileId, question.groupId))
    )
      return {
        allowed: false,
        authorKind: null,
        reason: "Only approved students may answer learning questions.",
      };
    return { allowed: true, authorKind: "student" };
  }
  return {
    allowed: false,
    authorKind: null,
    reason: "Parents cannot answer on a student's behalf.",
  };
}

export function canEditAnswer(actor: DiscussionActor, answer: DiscussionAnswerRecord): boolean {
  if (isStaff(actor)) return true;
  if (answer.lockedAt) return false;
  return answer.authorUserId === actor.userId;
}

export function canAcceptAnswer(
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
): boolean {
  return isStudent(actor) && actor.userId === question.authorUserId && !isQuestionLocked(question);
}

export async function canVerifyAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
): Promise<boolean> {
  return canModerateAsTutor(database, actor, question);
}

export async function canRequestRevision(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
): Promise<boolean> {
  return canModerateAsTutor(database, actor, question);
}

export async function canRateAnswer(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  answer: DiscussionAnswerRecord,
  question: DiscussionQuestionRecord,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!isTutor(actor) && !isStaff(actor))
    return { allowed: false, reason: "Only tutors can rate a student's answer." };
  if (answer.authorUserId === actor.userId)
    return { allowed: false, reason: "You cannot rate your own answer." };
  if (answer.authorKind !== "student")
    return { allowed: false, reason: "Only student-written answers can be rated." };
  if (answer.deletedAt) return { allowed: false, reason: "This answer has been removed." };
  if (answer.lockedAt && !isStaff(actor))
    return { allowed: false, reason: "This answer is locked." };
  if (!(await canModerateAsTutor(database, actor, question)))
    return { allowed: false, reason: "You do not have access to this discussion." };
  return { allowed: true };
}

export function canModerateRatings(actor: DiscussionActor): boolean {
  return isStaff(actor);
}

export async function canCommentOnQuestion(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  question: DiscussionQuestionRecord,
): Promise<boolean> {
  if (isQuestionLocked(question)) return isStaff(actor);
  return canAccessQuestion(database, actor, question);
}

export function canEditOwnComment(
  actor: DiscussionActor,
  comment: DiscussionCommentRecord,
): boolean {
  return comment.authorUserId === actor.userId && !comment.deletedAt;
}
export function canDeleteComment(
  actor: DiscussionActor,
  comment: DiscussionCommentRecord,
): boolean {
  return isStaff(actor) || (comment.authorUserId === actor.userId && !comment.deletedAt);
}
export function canModerateComments(actor: DiscussionActor): boolean {
  return isStaff(actor);
}

export function canProposeCorrection(
  actor: DiscussionActor,
  answer: DiscussionAnswerRecord,
): boolean {
  return (
    (isStudent(actor) || isTutor(actor) || isStaff(actor)) && answer.authorUserId !== actor.userId
  );
}
export function canRespondToCorrection(
  actor: DiscussionActor,
  answer: DiscussionAnswerRecord,
): boolean {
  return isStaff(actor) || answer.authorUserId === actor.userId;
}
export function canResolveCorrectionDispute(actor: DiscussionActor): boolean {
  return isStaff(actor) || isTutor(actor);
}

export function canReportContent(actor: DiscussionActor): boolean {
  return Boolean(actor.userId);
}
export function canModerateContent(actor: DiscussionActor): boolean {
  return isStaff(actor);
}

export async function canReadChildActivity(
  database: DiscussionDatabase,
  actor: DiscussionActor,
  studentProfileId: string,
): Promise<boolean> {
  if (isStaff(actor)) return true;
  if (!isParent(actor)) return false;
  return database.isParentLinkedToStudent(actor.userId, studentProfileId);
}

export function canReadAnalytics(actor: DiscussionActor): boolean {
  return isStaff(actor);
}
export function canManageSettings(actor: DiscussionActor): boolean {
  return isStaff(actor);
}
