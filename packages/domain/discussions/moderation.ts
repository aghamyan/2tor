import { ulid } from "ulid";
import { canModerateContent, isStaff, requireActor } from "./capabilities";
import { DiscussionError } from "./errors";
import type {
  DiscussionActor,
  DiscussionDatabase,
  DiscussionReportRecord,
  DiscussionReportSeverity,
  DiscussionReportStatus,
  DiscussionReportTargetType,
} from "./models";
import {
  createReportSchema,
  resolveReportSchema,
  type CreateReportInput,
  type ResolveReportInput,
} from "./schemas";
import { createNotification } from "./notifications";

/**
 * Structural port for `@app/audit`, bound to the real package only in `runtime.ts` (never imported
 * here directly) — the same "don't import the shared package from services.ts" pattern every other
 * domain module uses. CONVENTIONS.md calls audit logging for moderation/verification decisions
 * non-negotiable, so unlike routine writes, every function in this file requires one.
 */
export interface DiscussionAuditPort {
  recordAudit(input: {
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    reason?: string | null;
    previousValue?: unknown;
    newValue?: unknown;
  }): Promise<void>;
}

async function requireTargetExists(
  database: DiscussionDatabase,
  targetType: DiscussionReportTargetType,
  targetId: string,
) {
  if (targetType === "discussion_question") {
    const question = await database.getQuestion(targetId);
    if (!question)
      throw new DiscussionError("QUESTION_NOT_FOUND", "This question was not found.", 404);
    return question.authorUserId;
  }
  if (targetType === "discussion_answer") {
    const answer = await database.getAnswer(targetId);
    if (!answer) throw new DiscussionError("ANSWER_NOT_FOUND", "This answer was not found.", 404);
    return answer.authorUserId;
  }
  const comment = await database.getComment(targetId);
  if (!comment) throw new DiscussionError("COMMENT_NOT_FOUND", "This comment was not found.", 404);
  return comment.authorUserId;
}

export async function reportContent(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  input: CreateReportInput,
): Promise<DiscussionReportRecord> {
  requireActor(actor);
  const values = createReportSchema.parse(input);
  await requireTargetExists(database, values.targetType, values.targetId);
  const now = new Date();
  const report: DiscussionReportRecord = {
    id: ulid(),
    reporterId: actor.userId,
    targetType: values.targetType,
    targetId: values.targetId,
    reason: values.reason,
    details: values.details ?? null,
    severity: null,
    status: "open",
    assignedModeratorId: null,
    resolvedByUserId: null,
    resolutionNote: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveReport(report);
  return report;
}

export async function listReportsForModerator(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  filter: {
    status?: DiscussionReportStatus;
    severity?: DiscussionReportSeverity;
    assignedModeratorId?: string;
    targetType?: DiscussionReportTargetType;
  },
): Promise<DiscussionReportRecord[]> {
  requireActor(actor);
  if (!canModerateContent(actor))
    throw new DiscussionError("FORBIDDEN", "Only moderators can view the moderation queue.", 403);
  return database.listReports(filter);
}

export async function assignReport(
  database: DiscussionDatabase,
  audit: DiscussionAuditPort,
  actor: DiscussionActor | null | undefined,
  reportId: string,
  moderatorId: string,
): Promise<void> {
  requireActor(actor);
  if (!canModerateContent(actor))
    throw new DiscussionError("FORBIDDEN", "Only moderators can triage reports.", 403);
  const report = await database.getReport(reportId);
  if (!report) throw new DiscussionError("REPORT_NOT_FOUND", "This report was not found.", 404);
  await database.updateReport(reportId, { status: "reviewing", assignedModeratorId: moderatorId });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "discussion.report_assigned",
    resourceType: "abuse_reports",
    resourceId: reportId,
    newValue: { assignedModeratorId: moderatorId },
  });
}

export async function resolveReport(
  database: DiscussionDatabase,
  audit: DiscussionAuditPort,
  actor: DiscussionActor | null | undefined,
  reportId: string,
  input: ResolveReportInput,
): Promise<DiscussionReportRecord> {
  requireActor(actor);
  const values = resolveReportSchema.parse(input);
  if (!canModerateContent(actor))
    throw new DiscussionError("FORBIDDEN", "Only moderators can resolve reports.", 403);
  const report = await database.getReport(reportId);
  if (!report) throw new DiscussionError("REPORT_NOT_FOUND", "This report was not found.", 404);
  const now = new Date();
  const resolved = values.status === "resolved" || values.status === "dismissed";
  await database.updateReport(reportId, {
    status: values.status,
    severity: values.severity ?? report.severity,
    resolutionNote: values.resolutionNote,
    resolvedByUserId: resolved ? actor.userId : null,
    resolvedAt: resolved ? now : null,
  });
  await audit.recordAudit({
    actorUserId: actor.userId,
    action: "discussion.report_resolved",
    resourceType: "abuse_reports",
    resourceId: reportId,
    reason: values.resolutionNote,
    previousValue: { status: report.status },
    newValue: { status: values.status },
  });
  const targetAuthorId = await requireTargetExists(
    database,
    report.targetType,
    report.targetId,
  ).catch(() => null);
  if (targetAuthorId)
    await createNotification(database, {
      recipientId: targetAuthorId,
      actorId: actor.userId,
      type: "content_moderation_updated",
      questionId: report.targetType === "discussion_question" ? report.targetId : null,
      answerId: report.targetType === "discussion_answer" ? report.targetId : null,
    });
  return {
    ...report,
    status: values.status,
    severity: values.severity ?? report.severity,
    resolutionNote: values.resolutionNote,
    resolvedByUserId: resolved ? actor.userId : null,
    resolvedAt: resolved ? now : null,
    updatedAt: now,
  };
}

async function recordContentAudit(
  audit: DiscussionAuditPort,
  actorUserId: string,
  action: string,
  resourceType: "discussion_questions" | "discussion_answers" | "discussion_comments",
  resourceId: string,
  reason: string | null,
) {
  await audit.recordAudit({ actorUserId, action, resourceType, resourceId, reason });
}

export async function removeQuestion(
  database: DiscussionDatabase,
  audit: DiscussionAuditPort,
  actor: DiscussionActor | null | undefined,
  questionId: string,
  reason: string,
): Promise<void> {
  requireActor(actor);
  if (!isStaff(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can remove a question.", 403);
  await database.updateQuestion(questionId, { deletedAt: new Date() });
  await recordContentAudit(
    audit,
    actor.userId,
    "discussion.question_removed",
    "discussion_questions",
    questionId,
    reason,
  );
}

export async function restoreQuestion(
  database: DiscussionDatabase,
  audit: DiscussionAuditPort,
  actor: DiscussionActor | null | undefined,
  questionId: string,
): Promise<void> {
  requireActor(actor);
  if (!isStaff(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can restore a question.", 403);
  await database.updateQuestion(questionId, { deletedAt: null });
  await recordContentAudit(
    audit,
    actor.userId,
    "discussion.question_restored",
    "discussion_questions",
    questionId,
    null,
  );
}

export async function removeAnswer(
  database: DiscussionDatabase,
  audit: DiscussionAuditPort,
  actor: DiscussionActor | null | undefined,
  answerId: string,
  reason: string,
): Promise<void> {
  requireActor(actor);
  if (!isStaff(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can remove an answer.", 403);
  await database.updateAnswer(answerId, { deletedAt: new Date() });
  await recordContentAudit(
    audit,
    actor.userId,
    "discussion.answer_removed",
    "discussion_answers",
    answerId,
    reason,
  );
}

export async function restoreAnswer(
  database: DiscussionDatabase,
  audit: DiscussionAuditPort,
  actor: DiscussionActor | null | undefined,
  answerId: string,
): Promise<void> {
  requireActor(actor);
  if (!isStaff(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can restore an answer.", 403);
  await database.updateAnswer(answerId, { deletedAt: null });
  await recordContentAudit(
    audit,
    actor.userId,
    "discussion.answer_restored",
    "discussion_answers",
    answerId,
    null,
  );
}

export async function removeComment(
  database: DiscussionDatabase,
  audit: DiscussionAuditPort,
  actor: DiscussionActor | null | undefined,
  commentId: string,
  reason: string,
): Promise<void> {
  requireActor(actor);
  if (!isStaff(actor))
    throw new DiscussionError("FORBIDDEN", "Only an administrator can remove a comment.", 403);
  await database.updateComment(commentId, { deletedAt: new Date() });
  await recordContentAudit(
    audit,
    actor.userId,
    "discussion.comment_removed",
    "discussion_comments",
    commentId,
    reason,
  );
}
