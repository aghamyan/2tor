import {
  abuseReports,
  courses,
  discussionAnswerTutorRatings,
  discussionAnswers,
  discussionAttachments,
  discussionBookmarks,
  discussionComments,
  discussionCorrections,
  discussionFollows,
  discussionHelpfulVotes,
  discussionNotifications,
  discussionQuestionTags,
  discussionQuestions,
  discussionRevisions,
  discussionTags,
  enrollments,
  parentProfiles,
  parentStudentLinks,
  studentProfiles,
  subjects,
  tutorProfiles,
  tutorStudentAssignments,
  users,
  type Database,
  type Transaction,
} from "@app/db";
import { and, count, desc, eq, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { ulid } from "ulid";
import { DiscussionError } from "./errors";
import type {
  DiscussionActor,
  DiscussionAnswerRecord,
  DiscussionAnswerTutorRatingRecord,
  DiscussionAttachmentRecord,
  DiscussionCommentRecord,
  DiscussionCorrectionRecord,
  DiscussionDatabase,
  DiscussionFeedFilter,
  DiscussionFeedItem,
  DiscussionFeedPage,
  DiscussionNotificationRecord,
  DiscussionQuestionRecord,
  DiscussionRatingAggregate,
  DiscussionReportRecord,
  DiscussionRevisionEntityType,
  DiscussionRevisionRecord,
  DiscussionScope,
  DiscussionTagRecord,
  DiscussionVoteRecord,
  SafeDisplayIdentity,
} from "./models";

type Executor = Database | Transaction;

const shortCode = (id: string) => id.slice(-4).toUpperCase();
const firstWord = (value: string) => value.trim().split(/\s+/)[0] ?? value.trim();

function mapQuestion(row: typeof discussionQuestions.$inferSelect): DiscussionQuestionRecord {
  return {
    id: row.id,
    studentProfileId: row.studentProfileId,
    authorUserId: row.authorUserId,
    authorDisplayName: row.authorDisplayName,
    title: row.title,
    slug: row.slug,
    body: row.body,
    bodyFormat: "markdown",
    courseId: row.courseId,
    groupId: row.relatedClassId,
    subjectId: row.subjectId,
    topicId: row.topicId,
    gradeLevel: row.gradeLevel,
    questionType: row.questionType,
    whatTried: row.whatTried,
    visibility: row.visibility,
    relatedClassId: row.relatedClassId,
    status: row.status,
    acceptedAnswerId: row.acceptedAnswerId,
    duplicateOfQuestionId: row.duplicateOfQuestionId,
    piiFlags: (row.piiFlags as DiscussionQuestionRecord["piiFlags"]) ?? [],
    viewCount: row.viewCount,
    lastActivityAt: row.lastActivityAt,
    lockedAt: row.lockedAt,
    lockedById: row.lockedById,
    closedAt: row.closedAt,
    closedById: row.closedById,
    closedReason: row.closedReason,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAnswer(row: typeof discussionAnswers.$inferSelect): DiscussionAnswerRecord {
  return {
    id: row.id,
    questionId: row.discussionQuestionId,
    authorUserId: row.authorUserId,
    authorDisplayName: row.authorDisplayName,
    authorKind: row.isTutorAnswer ? "tutor" : "student",
    isTutorAnswer: row.isTutorAnswer,
    body: row.body,
    bodyFormat: "markdown",
    isAccepted: row.isAccepted,
    verificationStatus: row.verificationStatus,
    verificationNote: row.verificationNote,
    verifiedByUserId: row.verifiedByUserId,
    verifiedAt: row.verifiedAt,
    tutorRatingAverage: row.tutorRatingAverage === null ? null : Number(row.tutorRatingAverage),
    tutorRatingCount: row.tutorRatingCount,
    revisedAfterRatingAt: row.revisedAfterRatingAt,
    piiFlags: (row.piiFlags as DiscussionAnswerRecord["piiFlags"]) ?? [],
    lockedAt: row.lockedAt,
    lockedById: row.lockedById,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAttachment(row: typeof discussionAttachments.$inferSelect): DiscussionAttachmentRecord {
  return {
    id: row.id,
    questionId: row.questionId,
    uploadedByUserId: row.uploadedByUserId,
    fileKey: row.fileKey,
    fileName: row.fileName,
    mimeType: row.mimeType as DiscussionAttachmentRecord["mimeType"],
    sizeBytes: row.sizeBytes,
    virusScanStatus: row.virusScanStatus,
    createdAt: row.createdAt,
  };
}

function mapTag(row: typeof discussionTags.$inferSelect): DiscussionTagRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    colorToken: row.colorToken,
    usageCount: row.usageCount,
  };
}

function mapRating(
  row: typeof discussionAnswerTutorRatings.$inferSelect,
): DiscussionAnswerTutorRatingRecord {
  return {
    id: row.id,
    answerId: row.answerId,
    tutorId: row.tutorId,
    tutorDisplayName: row.tutorDisplayName,
    rating: row.rating as 1 | 2 | 3 | 4 | 5,
    publicFeedback: row.publicFeedback,
    deletedAt: row.deletedAt,
    invalidatedAt: row.invalidatedAt,
    invalidatedById: row.invalidatedById,
    invalidationReason: row.invalidationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapComment(row: typeof discussionComments.$inferSelect): DiscussionCommentRecord {
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    authorDisplayName: row.authorDisplayName,
    questionId: row.questionId,
    answerId: row.answerId,
    parentCommentId: row.parentCommentId,
    body: row.body,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCorrection(row: typeof discussionCorrections.$inferSelect): DiscussionCorrectionRecord {
  return {
    id: row.id,
    answerId: row.answerId,
    proposedById: row.proposedById,
    proposedByDisplayName: row.proposedByDisplayName,
    issueDescription: row.issueDescription,
    proposedCorrection: row.proposedCorrection,
    explanation: row.explanation,
    status: row.status,
    authorResponse: row.authorResponse,
    resolvedById: row.resolvedById,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRevision(row: typeof discussionRevisions.$inferSelect): DiscussionRevisionRecord {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    editorId: row.editorId,
    previousBody: row.previousBody,
    newBody: row.newBody,
    editReason: row.editReason,
    createdAt: row.createdAt,
  };
}

function mapNotification(
  row: typeof discussionNotifications.$inferSelect,
): DiscussionNotificationRecord {
  return {
    id: row.id,
    recipientId: row.recipientId,
    actorId: row.actorId,
    type: row.type,
    questionId: row.questionId,
    answerId: row.answerId,
    ratingId: row.ratingId,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

function mapReport(row: typeof abuseReports.$inferSelect): DiscussionReportRecord {
  return {
    id: row.id,
    reporterId: row.reportedByUserId,
    targetType: row.targetType as DiscussionReportRecord["targetType"],
    targetId: row.targetId,
    reason: row.reason,
    details: row.details,
    severity: row.severity,
    status: row.escalated ? "escalated" : (row.status as DiscussionReportRecord["status"]),
    assignedModeratorId: row.assignedModeratorId,
    resolvedByUserId: row.resolvedByUserId,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Filters out keys whose value is `undefined` (absent) while keeping explicit `null`s — the
 *  difference between "don't touch this column" and "clear this column" everywhere in this file. */
function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): DiscussionDatabase {
  return {
    async transaction<T>(operation: (database: DiscussionDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((tx) => operation(repository(tx, root, true)));
    },

    // ---- Questions -------------------------------------------------------------------------
    async saveQuestion(question) {
      await executor.insert(discussionQuestions).values({
        id: question.id,
        authorUserId: question.authorUserId,
        authorDisplayName: question.authorDisplayName,
        studentProfileId: question.studentProfileId,
        title: question.title,
        slug: question.slug,
        body: question.body,
        bodyFormat: question.bodyFormat,
        subjectId: question.subjectId,
        topicId: question.topicId,
        gradeLevel: question.gradeLevel,
        courseId: question.courseId,
        questionType: question.questionType,
        whatTried: question.whatTried,
        visibility: question.visibility,
        relatedClassId: question.relatedClassId ?? question.groupId,
        status: question.status,
        acceptedAnswerId: question.acceptedAnswerId,
        duplicateOfQuestionId: question.duplicateOfQuestionId,
        piiFlags: question.piiFlags,
        viewCount: question.viewCount,
        lastActivityAt: question.lastActivityAt,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      });
    },
    async getQuestion(questionId) {
      const [row] = await executor
        .select()
        .from(discussionQuestions)
        .where(eq(discussionQuestions.id, questionId))
        .limit(1);
      return row ? mapQuestion(row) : null;
    },
    async getQuestionBySlug(slug) {
      const [row] = await executor
        .select()
        .from(discussionQuestions)
        .where(eq(discussionQuestions.slug, slug))
        .limit(1);
      return row ? mapQuestion(row) : null;
    },
    async listQuestions(scope: DiscussionScope) {
      const rows = await executor
        .select()
        .from(discussionQuestions)
        .where(
          and(
            isNull(discussionQuestions.deletedAt),
            scope.courseId
              ? eq(discussionQuestions.courseId, scope.courseId)
              : isNull(discussionQuestions.courseId),
            scope.groupId
              ? eq(discussionQuestions.relatedClassId, scope.groupId)
              : isNull(discussionQuestions.relatedClassId),
            scope.subjectId
              ? eq(discussionQuestions.subjectId, scope.subjectId)
              : isNull(discussionQuestions.subjectId),
          ),
        );
      return rows.map(mapQuestion);
    },
    async listQuestionsByStudent(studentProfileId, since) {
      const rows = await executor
        .select()
        .from(discussionQuestions)
        .where(
          and(
            eq(discussionQuestions.studentProfileId, studentProfileId),
            isNull(discussionQuestions.deletedAt),
            since ? gt(discussionQuestions.createdAt, since) : undefined,
          ),
        );
      return rows.map(mapQuestion);
    },
    async getUserIdForStudentProfile(studentProfileId) {
      const [row] = await executor
        .select({ userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId))
        .limit(1);
      return row?.userId ?? null;
    },
    async getGradeLevelForStudentProfile(studentProfileId) {
      const [row] = await executor
        .select({ gradeLevel: studentProfiles.gradeLevel })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId))
        .limit(1);
      return row?.gradeLevel ?? null;
    },
    async queryFeed(
      filter: DiscussionFeedFilter,
      viewer: DiscussionActor,
    ): Promise<DiscussionFeedPage> {
      const isStaffViewer =
        viewer.roles.includes("administrator") || viewer.roles.includes("super_administrator");
      const isTutorViewer = viewer.roles.includes("tutor");
      const isParentViewer = viewer.roles.includes("parent");
      const isStudentViewer = viewer.roles.includes("student");
      const now = new Date();

      // Booleans are inlined as SQL literals (not bound params) so Postgres never has to
      // infer a parameter's type inside an AND/boolean context — see drizzle-database smoke test.
      const tutorViewerSql = isTutorViewer ? sql`true` : sql`false`;
      const parentViewerSql = isParentViewer ? sql`true` : sql`false`;
      const studentViewerSql = isStudentViewer ? sql`true` : sql`false`;

      const visibility: SQL = isStaffViewer
        ? sql`true`
        : sql`(
            ${discussionQuestions.visibility} = 'community'
            OR ${discussionQuestions.authorUserId} = ${viewer.userId}
            OR (${discussionQuestions.visibility} = 'tutors_only' AND ${tutorViewerSql})
            OR (
              ${discussionQuestions.visibility} IN ('private_support', 'tutors_only')
              AND ${tutorViewerSql}
              AND EXISTS (
                SELECT 1 FROM tutor_student_assignments tsa
                INNER JOIN tutor_profiles tp ON tp.id = tsa.tutor_profile_id
                WHERE tp.user_id = ${viewer.userId}
                  AND tsa.student_profile_id = ${discussionQuestions.studentProfileId}
                  AND tsa.status = 'active'
                  AND (tsa.end_at IS NULL OR tsa.end_at > ${now.toISOString()})
              )
            )
            OR (
              ${parentViewerSql}
              AND EXISTS (
                SELECT 1 FROM parent_student_links psl
                INNER JOIN parent_profiles pp ON pp.id = psl.parent_profile_id
                WHERE pp.user_id = ${viewer.userId}
                  AND psl.student_profile_id = ${discussionQuestions.studentProfileId}
              )
            )
            OR (
              ${discussionQuestions.visibility} = 'group_shared'
              AND ${discussionQuestions.relatedClassId} IS NOT NULL
              AND (
                (${studentViewerSql} AND EXISTS (
                  SELECT 1 FROM enrollments e
                  WHERE e.student_profile_id = ${viewer.studentProfileId ?? null}
                    AND e.course_id = ${discussionQuestions.relatedClassId}
                    AND e.status = 'active'
                ))
                OR (${tutorViewerSql} AND EXISTS (
                  SELECT 1 FROM tutor_student_assignments tsa2
                  INNER JOIN tutor_profiles tp2 ON tp2.id = tsa2.tutor_profile_id
                  INNER JOIN enrollments e2 ON e2.student_profile_id = tsa2.student_profile_id
                  WHERE tp2.user_id = ${viewer.userId}
                    AND e2.course_id = ${discussionQuestions.relatedClassId}
                    AND tsa2.status = 'active'
                ))
              )
            )
          )`;

      const conditions: (SQL | undefined)[] = [isNull(discussionQuestions.deletedAt), visibility];
      if (filter.authorUserId)
        conditions.push(eq(discussionQuestions.authorUserId, filter.authorUserId));
      if (filter.subjectId) conditions.push(eq(discussionQuestions.subjectId, filter.subjectId));
      if (filter.topicId) conditions.push(eq(discussionQuestions.topicId, filter.topicId));
      if (filter.courseId) conditions.push(eq(discussionQuestions.courseId, filter.courseId));
      if (filter.gradeLevel) conditions.push(eq(discussionQuestions.gradeLevel, filter.gradeLevel));
      if (filter.questionType)
        conditions.push(eq(discussionQuestions.questionType, filter.questionType));
      if (filter.status) conditions.push(eq(discussionQuestions.status, filter.status));
      if (filter.tutorVerified) conditions.push(eq(discussionQuestions.status, "tutor_verified"));
      if (filter.needsTutorReview)
        conditions.push(inArray(discussionQuestions.status, ["open", "needs_tutor_review"]));
      if (typeof filter.minTutorRating === "number") {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM discussion_answers da
            WHERE da.discussion_question_id = ${discussionQuestions.id}
              AND da.tutor_rating_average >= ${filter.minTutorRating}
          )`,
        );
      }
      if (filter.search) {
        conditions.push(
          sql`(
            to_tsvector('english', coalesce(${discussionQuestions.title}, '') || ' ' || coalesce(${discussionQuestions.body}, ''))
              @@ plainto_tsquery('english', ${filter.search})
            OR ${discussionQuestions.title} ILIKE ${`%${filter.search}%`}
          )`,
        );
      }
      if (filter.tagSlug) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM discussion_question_tags dqt
            INNER JOIN discussion_tags dt ON dt.id = dqt.tag_id
            WHERE dqt.question_id = ${discussionQuestions.id} AND dt.slug = ${filter.tagSlug}
          )`,
        );
      }
      if (filter.followedByUserId) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM discussion_follows df
            WHERE df.question_id = ${discussionQuestions.id} AND df.user_id = ${filter.followedByUserId}
          )`,
        );
      }
      if (filter.savedByUserId) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM discussion_bookmarks db
            WHERE db.question_id = ${discussionQuestions.id} AND db.user_id = ${filter.savedByUserId}
          )`,
        );
      }

      // Every `sort` value the schema accepts gets a genuinely distinct ordering here — a mode
      // that silently fell back to `recent_activity` would be a dead option in the sort dropdown.
      const orderColumn =
        filter.sort === "newest"
          ? desc(discussionQuestions.createdAt)
          : filter.sort === "most_answered"
            ? sql`(
                SELECT count(*) FROM discussion_answers da
                WHERE da.discussion_question_id = ${discussionQuestions.id} AND da.deleted_at IS NULL
              ) DESC`
            : filter.sort === "most_helpful"
              ? sql`(
                  SELECT count(*) FROM discussion_helpful_votes dhv
                  INNER JOIN discussion_answers da ON da.id = dhv.answer_id
                  WHERE da.discussion_question_id = ${discussionQuestions.id}
                ) DESC`
              : filter.sort === "highest_rated"
                ? sql`(
                    SELECT max(da.tutor_rating_average) FROM discussion_answers da
                    WHERE da.discussion_question_id = ${discussionQuestions.id}
                  ) DESC NULLS LAST`
                : desc(discussionQuestions.lastActivityAt); // recent_activity, unanswered, needs_tutor_review
      if (filter.sort === "unanswered") conditions.push(eq(discussionQuestions.status, "open"));
      if (filter.sort === "needs_tutor_review")
        conditions.push(inArray(discussionQuestions.status, ["open", "needs_tutor_review"]));

      const limit = filter.limit ?? 20;
      const offset = filter.cursor ? Number.parseInt(filter.cursor, 10) || 0 : 0;
      const rows = await executor
        .select()
        .from(discussionQuestions)
        .where(and(...conditions))
        .orderBy(orderColumn)
        .limit(limit + 1)
        .offset(offset);

      const pageRows = rows.slice(0, limit);
      const questionIds = pageRows.map((row) => row.id);
      const [answerSignals, commentCounts, helpfulCounts, tagsByQuestion] = await Promise.all([
        questionIds.length
          ? executor
              .select({
                questionId: discussionAnswers.discussionQuestionId,
                isTutorAnswer: discussionAnswers.isTutorAnswer,
                tutorRatingAverage: discussionAnswers.tutorRatingAverage,
                tutorRatingCount: discussionAnswers.tutorRatingCount,
              })
              .from(discussionAnswers)
              .where(
                and(
                  inArray(discussionAnswers.discussionQuestionId, questionIds),
                  isNull(discussionAnswers.deletedAt),
                ),
              )
          : Promise.resolve([]),
        questionIds.length
          ? executor
              .select({ questionId: discussionComments.questionId, value: count() })
              .from(discussionComments)
              .where(
                and(
                  inArray(discussionComments.questionId, questionIds),
                  isNull(discussionComments.deletedAt),
                ),
              )
              .groupBy(discussionComments.questionId)
          : Promise.resolve([]),
        questionIds.length
          ? executor
              .select({ questionId: discussionAnswers.discussionQuestionId, value: count() })
              .from(discussionHelpfulVotes)
              .innerJoin(
                discussionAnswers,
                eq(discussionAnswers.id, discussionHelpfulVotes.answerId),
              )
              .where(inArray(discussionAnswers.discussionQuestionId, questionIds))
              .groupBy(discussionAnswers.discussionQuestionId)
          : Promise.resolve([]),
        this.listTagsForQuestions(questionIds),
      ]);
      const answerCountByQuestion = new Map<string, number>();
      const tutorAnswerCountByQuestion = new Map<string, number>();
      const topTutorRatingByQuestion = new Map<string, { average: number; count: number }>();
      for (const answer of answerSignals) {
        answerCountByQuestion.set(
          answer.questionId,
          (answerCountByQuestion.get(answer.questionId) ?? 0) + 1,
        );
        if (answer.isTutorAnswer) {
          tutorAnswerCountByQuestion.set(
            answer.questionId,
            (tutorAnswerCountByQuestion.get(answer.questionId) ?? 0) + 1,
          );
        }
        if (!answer.isTutorAnswer && answer.tutorRatingAverage !== null) {
          const average = Number(answer.tutorRatingAverage);
          const current = topTutorRatingByQuestion.get(answer.questionId);
          if (!current || average > current.average) {
            topTutorRatingByQuestion.set(answer.questionId, {
              average,
              count: answer.tutorRatingCount,
            });
          }
        }
      }
      const commentCountByQuestion = new Map(
        commentCounts.map((row) => [row.questionId, row.value]),
      );
      const helpfulCountByQuestion = new Map(
        helpfulCounts.map((row) => [row.questionId, row.value]),
      );

      const items: DiscussionFeedItem[] = pageRows.map((row) => ({
        question: mapQuestion(row),
        answerCount: answerCountByQuestion.get(row.id) ?? 0,
        tutorAnswerCount: tutorAnswerCountByQuestion.get(row.id) ?? 0,
        commentCount: commentCountByQuestion.get(row.id) ?? 0,
        helpfulCount: helpfulCountByQuestion.get(row.id) ?? 0,
        topTutorRatingAverage: topTutorRatingByQuestion.get(row.id)?.average ?? null,
        topTutorRatingCount: topTutorRatingByQuestion.get(row.id)?.count ?? 0,
        tags: tagsByQuestion.get(row.id) ?? [],
      }));

      return { items, nextCursor: rows.length > limit ? String(offset + limit) : null };
    },
    async updateQuestionStatus(questionId, status) {
      await executor
        .update(discussionQuestions)
        .set({ status, updatedAt: new Date() })
        .where(eq(discussionQuestions.id, questionId));
    },
    async updateQuestion(questionId, patch) {
      const values = definedOnly(patch);
      if (Object.keys(values).length === 0) return;
      await executor
        .update(discussionQuestions)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(discussionQuestions.id, questionId));
    },
    async incrementQuestionViewCount(questionId) {
      await executor
        .update(discussionQuestions)
        .set({ viewCount: sql`${discussionQuestions.viewCount} + 1` })
        .where(eq(discussionQuestions.id, questionId));
    },
    async touchQuestionActivity(questionId, at = new Date()) {
      await executor
        .update(discussionQuestions)
        .set({ lastActivityAt: at })
        .where(eq(discussionQuestions.id, questionId));
    },

    // ---- Answers ----------------------------------------------------------------------------
    async saveAnswer(answer) {
      await executor.insert(discussionAnswers).values({
        id: answer.id,
        discussionQuestionId: answer.questionId,
        authorUserId: answer.authorUserId,
        authorDisplayName: answer.authorDisplayName,
        isTutorAnswer: answer.isTutorAnswer,
        body: answer.body,
        bodyFormat: answer.bodyFormat,
        isAccepted: answer.isAccepted,
        verificationStatus: answer.verificationStatus,
        verificationNote: answer.verificationNote,
        verifiedByUserId: answer.verifiedByUserId,
        verifiedAt: answer.verifiedAt,
        piiFlags: answer.piiFlags,
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
      });
    },
    async getAnswer(answerId) {
      const [row] = await executor
        .select()
        .from(discussionAnswers)
        .where(eq(discussionAnswers.id, answerId))
        .limit(1);
      return row ? mapAnswer(row) : null;
    },
    async listAnswers(questionId) {
      const rows = await executor
        .select()
        .from(discussionAnswers)
        .where(eq(discussionAnswers.discussionQuestionId, questionId));
      return rows.map(mapAnswer);
    },
    async listAnswersByAuthorUserId(authorUserId, since) {
      const rows = await executor
        .select()
        .from(discussionAnswers)
        .where(
          and(
            eq(discussionAnswers.authorUserId, authorUserId),
            isNull(discussionAnswers.deletedAt),
            since ? gt(discussionAnswers.createdAt, since) : undefined,
          ),
        );
      return rows.map(mapAnswer);
    },
    async updateAnswerVerification(answerId, values) {
      await executor
        .update(discussionAnswers)
        .set({
          verificationStatus: values.verificationStatus,
          verificationNote: values.verificationNote,
          verifiedByUserId: values.verifiedByUserId,
          verifiedAt: values.verifiedAt,
          updatedAt: values.verifiedAt,
        })
        .where(eq(discussionAnswers.id, answerId));
    },
    async updateAnswer(answerId, patch) {
      const values = definedOnly(patch);
      if (Object.keys(values).length === 0) return;
      await executor
        .update(discussionAnswers)
        .set({
          ...values,
          tutorRatingAverage:
            values.tutorRatingAverage === undefined
              ? undefined
              : (values.tutorRatingAverage?.toString() ?? null),
          updatedAt: new Date(),
        })
        .where(eq(discussionAnswers.id, answerId));
    },

    // ---- Attachments ------------------------------------------------------------------------
    async saveAttachment(attachment) {
      await executor.insert(discussionAttachments).values(attachment);
    },
    async getAttachment(attachmentId) {
      const [row] = await executor
        .select()
        .from(discussionAttachments)
        .where(eq(discussionAttachments.id, attachmentId))
        .limit(1);
      return row ? mapAttachment(row) : null;
    },
    async updateAttachmentScanStatus(attachmentId, status) {
      await executor
        .update(discussionAttachments)
        .set({ virusScanStatus: status })
        .where(eq(discussionAttachments.id, attachmentId));
    },
    async listAttachments(questionId) {
      const rows = await executor
        .select()
        .from(discussionAttachments)
        .where(eq(discussionAttachments.questionId, questionId));
      return rows.map(mapAttachment);
    },

    // ---- Helpful votes ------------------------------------------------------------------------
    async saveVote(vote: DiscussionVoteRecord) {
      await executor
        .insert(discussionHelpfulVotes)
        .values({
          id: vote.id,
          answerId: vote.answerId,
          voterUserId: vote.voterUserId,
          createdAt: vote.createdAt,
        })
        .onConflictDoNothing({
          target: [discussionHelpfulVotes.answerId, discussionHelpfulVotes.voterUserId],
        });
    },
    async hasVote(answerId, voterUserId) {
      const [row] = await executor
        .select({ id: discussionHelpfulVotes.id })
        .from(discussionHelpfulVotes)
        .where(
          and(
            eq(discussionHelpfulVotes.answerId, answerId),
            eq(discussionHelpfulVotes.voterUserId, voterUserId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async countVotesByUserSince(voterUserId, since) {
      const [row] = await executor
        .select({ value: count() })
        .from(discussionHelpfulVotes)
        .where(
          and(
            eq(discussionHelpfulVotes.voterUserId, voterUserId),
            gt(discussionHelpfulVotes.createdAt, since),
          ),
        );
      return row?.value ?? 0;
    },
    async countVotesForAnswer(answerId) {
      const [row] = await executor
        .select({ value: count() })
        .from(discussionHelpfulVotes)
        .where(eq(discussionHelpfulVotes.answerId, answerId));
      return row?.value ?? 0;
    },

    // ---- Tags ---------------------------------------------------------------------------------
    async getOrCreateTagsByName(names) {
      const results: DiscussionTagRecord[] = [];
      for (const rawName of names) {
        const name = rawName.trim();
        if (!name) continue;
        const slug = name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        const [existing] = await executor
          .select()
          .from(discussionTags)
          .where(eq(discussionTags.slug, slug))
          .limit(1);
        if (existing) {
          results.push(mapTag(existing));
          continue;
        }
        const [created] = await executor
          .insert(discussionTags)
          .values({ id: ulid(), name, slug })
          .onConflictDoNothing({ target: discussionTags.slug })
          .returning();
        if (created) results.push(mapTag(created));
        else {
          const [row] = await executor
            .select()
            .from(discussionTags)
            .where(eq(discussionTags.slug, slug))
            .limit(1);
          if (row) results.push(mapTag(row));
        }
      }
      return results;
    },
    async listTags(search) {
      const rows = await executor
        .select()
        .from(discussionTags)
        .where(search ? sql`${discussionTags.name} ILIKE ${`%${search}%`}` : undefined)
        .orderBy(desc(discussionTags.usageCount));
      return rows.map(mapTag);
    },
    async setQuestionTags(questionId, tagIds) {
      await executor
        .delete(discussionQuestionTags)
        .where(eq(discussionQuestionTags.questionId, questionId));
      if (tagIds.length)
        await executor
          .insert(discussionQuestionTags)
          .values(tagIds.map((tagId) => ({ id: ulid(), questionId, tagId })));
    },
    async listTagsForQuestion(questionId) {
      const rows = await executor
        .select({ tag: discussionTags })
        .from(discussionQuestionTags)
        .innerJoin(discussionTags, eq(discussionTags.id, discussionQuestionTags.tagId))
        .where(eq(discussionQuestionTags.questionId, questionId));
      return rows.map((row) => mapTag(row.tag));
    },
    async listTagsForQuestions(questionIds) {
      const map = new Map<string, DiscussionTagRecord[]>();
      if (!questionIds.length) return map;
      const rows = await executor
        .select({ questionId: discussionQuestionTags.questionId, tag: discussionTags })
        .from(discussionQuestionTags)
        .innerJoin(discussionTags, eq(discussionTags.id, discussionQuestionTags.tagId))
        .where(inArray(discussionQuestionTags.questionId, questionIds));
      for (const row of rows) {
        const list = map.get(row.questionId) ?? [];
        list.push(mapTag(row.tag));
        map.set(row.questionId, list);
      }
      return map;
    },

    // ---- Ratings --------------------------------------------------------------------------
    async saveRating(rating) {
      await executor
        .insert(discussionAnswerTutorRatings)
        .values(rating)
        .onConflictDoUpdate({
          target: discussionAnswerTutorRatings.id,
          set: {
            rating: rating.rating,
            publicFeedback: rating.publicFeedback,
            deletedAt: rating.deletedAt,
            invalidatedAt: rating.invalidatedAt,
            invalidatedById: rating.invalidatedById,
            invalidationReason: rating.invalidationReason,
            updatedAt: rating.updatedAt,
          },
        });
    },
    async getActiveRatingByTutorAndAnswer(answerId, tutorId) {
      const [row] = await executor
        .select()
        .from(discussionAnswerTutorRatings)
        .where(
          and(
            eq(discussionAnswerTutorRatings.answerId, answerId),
            eq(discussionAnswerTutorRatings.tutorId, tutorId),
            isNull(discussionAnswerTutorRatings.deletedAt),
            isNull(discussionAnswerTutorRatings.invalidatedAt),
          ),
        )
        .limit(1);
      return row ? mapRating(row) : null;
    },
    async getRating(ratingId) {
      const [row] = await executor
        .select()
        .from(discussionAnswerTutorRatings)
        .where(eq(discussionAnswerTutorRatings.id, ratingId))
        .limit(1);
      return row ? mapRating(row) : null;
    },
    async listActiveRatingsForAnswer(answerId) {
      const rows = await executor
        .select()
        .from(discussionAnswerTutorRatings)
        .where(
          and(
            eq(discussionAnswerTutorRatings.answerId, answerId),
            isNull(discussionAnswerTutorRatings.deletedAt),
            isNull(discussionAnswerTutorRatings.invalidatedAt),
          ),
        );
      return rows.map(mapRating);
    },
    async listAllRatingsForAnswer(answerId) {
      const rows = await executor
        .select()
        .from(discussionAnswerTutorRatings)
        .where(eq(discussionAnswerTutorRatings.answerId, answerId));
      return rows.map(mapRating);
    },
    async updateAnswerRatingAggregate(answerId, aggregate: DiscussionRatingAggregate) {
      await executor
        .update(discussionAnswers)
        .set({
          tutorRatingAverage: aggregate.average === null ? null : aggregate.average.toString(),
          tutorRatingCount: aggregate.count,
        })
        .where(eq(discussionAnswers.id, answerId));
    },

    // ---- Comments -----------------------------------------------------------------------------
    async saveComment(comment) {
      await executor.insert(discussionComments).values(comment);
    },
    async getComment(commentId) {
      const [row] = await executor
        .select()
        .from(discussionComments)
        .where(eq(discussionComments.id, commentId))
        .limit(1);
      return row ? mapComment(row) : null;
    },
    async listCommentsForQuestion(questionId) {
      const rows = await executor
        .select()
        .from(discussionComments)
        .where(eq(discussionComments.questionId, questionId));
      return rows.map(mapComment);
    },
    async listCommentsForAnswer(answerId) {
      const rows = await executor
        .select()
        .from(discussionComments)
        .where(eq(discussionComments.answerId, answerId));
      return rows.map(mapComment);
    },
    async updateComment(commentId, patch) {
      await executor
        .update(discussionComments)
        .set({ ...definedOnly(patch), updatedAt: new Date() })
        .where(eq(discussionComments.id, commentId));
    },

    // ---- Follows / bookmarks --------------------------------------------------------------------
    async saveFollow(userId, questionId) {
      await executor
        .insert(discussionFollows)
        .values({ id: ulid(), userId, questionId })
        .onConflictDoNothing({ target: [discussionFollows.userId, discussionFollows.questionId] });
    },
    async removeFollow(userId, questionId) {
      await executor
        .delete(discussionFollows)
        .where(
          and(eq(discussionFollows.userId, userId), eq(discussionFollows.questionId, questionId)),
        );
    },
    async hasFollow(userId, questionId) {
      const [row] = await executor
        .select({ id: discussionFollows.id })
        .from(discussionFollows)
        .where(
          and(eq(discussionFollows.userId, userId), eq(discussionFollows.questionId, questionId)),
        )
        .limit(1);
      return Boolean(row);
    },
    async listFollowerUserIds(questionId) {
      const rows = await executor
        .select({ userId: discussionFollows.userId })
        .from(discussionFollows)
        .where(eq(discussionFollows.questionId, questionId));
      return rows.map((row) => row.userId);
    },
    async saveBookmark(userId, questionId) {
      await executor
        .insert(discussionBookmarks)
        .values({ id: ulid(), userId, questionId })
        .onConflictDoNothing({
          target: [discussionBookmarks.userId, discussionBookmarks.questionId],
        });
    },
    async removeBookmark(userId, questionId) {
      await executor
        .delete(discussionBookmarks)
        .where(
          and(
            eq(discussionBookmarks.userId, userId),
            eq(discussionBookmarks.questionId, questionId),
          ),
        );
    },
    async hasBookmark(userId, questionId) {
      const [row] = await executor
        .select({ id: discussionBookmarks.id })
        .from(discussionBookmarks)
        .where(
          and(
            eq(discussionBookmarks.userId, userId),
            eq(discussionBookmarks.questionId, questionId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    // ---- Corrections --------------------------------------------------------------------------
    async saveCorrection(correction) {
      await executor.insert(discussionCorrections).values(correction);
    },
    async getCorrection(correctionId) {
      const [row] = await executor
        .select()
        .from(discussionCorrections)
        .where(eq(discussionCorrections.id, correctionId))
        .limit(1);
      return row ? mapCorrection(row) : null;
    },
    async listCorrectionsForAnswer(answerId) {
      const rows = await executor
        .select()
        .from(discussionCorrections)
        .where(eq(discussionCorrections.answerId, answerId));
      return rows.map(mapCorrection);
    },
    async updateCorrection(correctionId, patch) {
      await executor
        .update(discussionCorrections)
        .set({ ...definedOnly(patch), updatedAt: new Date() })
        .where(eq(discussionCorrections.id, correctionId));
    },

    // ---- Revisions ----------------------------------------------------------------------------
    async saveRevision(revision) {
      await executor.insert(discussionRevisions).values(revision);
    },
    async listRevisions(entityType: DiscussionRevisionEntityType, entityId) {
      const rows = await executor
        .select()
        .from(discussionRevisions)
        .where(
          and(
            eq(discussionRevisions.entityType, entityType),
            eq(discussionRevisions.entityId, entityId),
          ),
        )
        .orderBy(desc(discussionRevisions.createdAt));
      return rows.map(mapRevision);
    },

    // ---- Notifications --------------------------------------------------------------------------
    async saveNotification(notification) {
      await executor.insert(discussionNotifications).values(notification);
    },
    async listNotifications(recipientId, options) {
      const rows = await executor
        .select()
        .from(discussionNotifications)
        .where(
          and(
            eq(discussionNotifications.recipientId, recipientId),
            options?.unreadOnly ? isNull(discussionNotifications.readAt) : undefined,
          ),
        )
        .orderBy(desc(discussionNotifications.createdAt))
        .limit(options?.limit ?? 50);
      return rows.map(mapNotification);
    },
    async markNotificationRead(notificationId, recipientId) {
      await executor
        .update(discussionNotifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(discussionNotifications.id, notificationId),
            eq(discussionNotifications.recipientId, recipientId),
          ),
        );
    },
    async countUnreadNotifications(recipientId) {
      const [row] = await executor
        .select({ value: count() })
        .from(discussionNotifications)
        .where(
          and(
            eq(discussionNotifications.recipientId, recipientId),
            isNull(discussionNotifications.readAt),
          ),
        );
      return row?.value ?? 0;
    },

    // ---- Reports (shared `abuse_reports` table) ------------------------------------------------
    async saveReport(report) {
      await executor.insert(abuseReports).values({
        id: report.id,
        reportedByUserId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        details: report.details,
        severity: report.severity,
        status: report.status === "escalated" ? "reviewing" : report.status,
        escalated: report.status === "escalated",
        assignedModeratorId: report.assignedModeratorId,
        resolvedByUserId: report.resolvedByUserId,
        resolutionNote: report.resolutionNote,
        resolvedAt: report.resolvedAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      });
    },
    async getReport(reportId) {
      const [row] = await executor
        .select()
        .from(abuseReports)
        .where(eq(abuseReports.id, reportId))
        .limit(1);
      return row ? mapReport(row) : null;
    },
    async listReports(filter) {
      const conditions: (SQL | undefined)[] = [];
      if (filter.status)
        conditions.push(
          filter.status === "escalated"
            ? eq(abuseReports.escalated, true)
            : and(eq(abuseReports.status, filter.status), eq(abuseReports.escalated, false)),
        );
      if (filter.severity) conditions.push(eq(abuseReports.severity, filter.severity));
      if (filter.assignedModeratorId)
        conditions.push(eq(abuseReports.assignedModeratorId, filter.assignedModeratorId));
      if (filter.targetType) conditions.push(eq(abuseReports.targetType, filter.targetType));
      const rows = await executor
        .select()
        .from(abuseReports)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(abuseReports.createdAt));
      return rows.map(mapReport);
    },
    async updateReport(reportId, patch) {
      const values = definedOnly(patch);
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if ("status" in values) {
        set.status = values.status === "escalated" ? "reviewing" : values.status;
        set.escalated = values.status === "escalated";
      }
      if ("severity" in values) set.severity = values.severity;
      if ("assignedModeratorId" in values) set.assignedModeratorId = values.assignedModeratorId;
      if ("resolvedByUserId" in values) set.resolvedByUserId = values.resolvedByUserId;
      if ("resolutionNote" in values) set.resolutionNote = values.resolutionNote;
      if ("resolvedAt" in values) set.resolvedAt = values.resolvedAt;
      await executor.update(abuseReports).set(set).where(eq(abuseReports.id, reportId));
    },

    // ---- Identity & relationships ---------------------------------------------------------------
    async getSafeDisplayIdentity(userId): Promise<SafeDisplayIdentity | null> {
      const [studentRow] = await executor
        .select({ id: studentProfiles.id, preferredName: studentProfiles.preferredName })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userId))
        .limit(1);
      if (studentRow)
        return {
          firstName: firstWord(studentRow.preferredName),
          controlledIdentifier: `Student ${shortCode(studentRow.id)}`,
        };

      const [tutorRow] = await executor
        .select({ id: tutorProfiles.id, publicDisplayName: tutorProfiles.publicDisplayName })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, userId))
        .limit(1);
      if (tutorRow)
        return {
          firstName: firstWord(tutorRow.publicDisplayName),
          controlledIdentifier: `Tutor ${shortCode(tutorRow.id)}`,
        };

      const [userRow] = await executor
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!userRow) return null;
      return { firstName: "Staff", controlledIdentifier: `Moderator ${shortCode(userRow.id)}` };
    },
    async isParentLinkedToStudent(parentUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: parentStudentLinks.id })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(
          and(
            eq(parentProfiles.userId, parentUserId),
            eq(parentStudentLinks.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async isTutorAssignedToStudent(tutorUserId, studentProfileId) {
      const now = new Date();
      const [row] = await executor
        .select({ id: tutorStudentAssignments.id })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .where(
          and(
            eq(tutorProfiles.userId, tutorUserId),
            eq(tutorStudentAssignments.studentProfileId, studentProfileId),
            eq(tutorStudentAssignments.status, "active"),
            or(isNull(tutorStudentAssignments.endAt), gt(tutorStudentAssignments.endAt, now)),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async isStudentInGroup(studentProfileId, groupId) {
      // `courses.isGroup` is required, not just an active enrollment — a `group_shared` question
      // scoped to a 1:1 (non-group) course should not become visible to that course's other
      // enrollees, since a 1:1 course only ever has the one student anyway.
      const [row] = await executor
        .select({ id: enrollments.id })
        .from(enrollments)
        .innerJoin(courses, eq(courses.id, enrollments.courseId))
        .where(
          and(
            eq(enrollments.studentProfileId, studentProfileId),
            eq(enrollments.courseId, groupId),
            eq(enrollments.status, "active"),
            eq(courses.isGroup, true),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async isTutorAssignedToGroup(tutorUserId, groupId) {
      const now = new Date();
      const [row] = await executor
        .select({ id: tutorStudentAssignments.id })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .innerJoin(
          enrollments,
          eq(enrollments.studentProfileId, tutorStudentAssignments.studentProfileId),
        )
        .innerJoin(courses, eq(courses.id, enrollments.courseId))
        .where(
          and(
            eq(tutorProfiles.userId, tutorUserId),
            eq(enrollments.courseId, groupId),
            eq(enrollments.status, "active"),
            eq(tutorStudentAssignments.status, "active"),
            or(isNull(tutorStudentAssignments.endAt), gt(tutorStudentAssignments.endAt, now)),
            eq(courses.isGroup, true),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async isApprovedStudentAnswerer(studentProfileId, groupId) {
      // Every enrolled/linked student in scope may answer — there is no separate "approved
      // answerer" allow-list table. `groupId` narrows to enrollment in that class; otherwise any
      // active student profile is eligible (question-level visibility already gates who can see
      // the question in the first place, which is the real access boundary).
      if (!groupId) {
        const [row] = await executor
          .select({ id: studentProfiles.id })
          .from(studentProfiles)
          .where(
            and(eq(studentProfiles.id, studentProfileId), eq(studentProfiles.status, "active")),
          )
          .limit(1);
        return Boolean(row);
      }
      const [row] = await executor
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentProfileId, studentProfileId),
            eq(enrollments.courseId, groupId),
            eq(enrollments.status, "active"),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async listLinkedChildStudentProfileIds(parentUserId) {
      const rows = await executor
        .select({ studentProfileId: parentStudentLinks.studentProfileId })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(eq(parentProfiles.userId, parentUserId));
      return rows.map((row) => row.studentProfileId);
    },
    async listAskScopeOptionsForStudent(studentProfileId) {
      const rows = await executor
        .select({
          courseId: courses.id,
          courseTitle: courses.title,
          isGroup: courses.isGroup,
          subjectId: subjects.id,
          subjectName: subjects.name,
        })
        .from(enrollments)
        .innerJoin(courses, eq(courses.id, enrollments.courseId))
        .innerJoin(subjects, eq(subjects.id, courses.subjectId))
        .where(
          and(eq(enrollments.studentProfileId, studentProfileId), eq(enrollments.status, "active")),
        );
      const subjectById = new Map(rows.map((row) => [row.subjectId, row.subjectName]));
      const courseById = new Map(
        rows.map((row) => [
          row.courseId,
          { id: row.courseId, title: row.courseTitle, isGroup: row.isGroup },
        ]),
      );
      return {
        courses: [...courseById.values()],
        subjects: [...subjectById.entries()].map(([id, name]) => ({ id, name })),
      };
    },
  };
}

export function createDrizzleDiscussionDatabase(database: Database): DiscussionDatabase {
  return repository(database, database, false);
}

// Also exported for callers (routes/jobs) that need the underlying course-based "group" concept
// without going through the full domain surface — e.g. populating a course picker.
export { courses };
