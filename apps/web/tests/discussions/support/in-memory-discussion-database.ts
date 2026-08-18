import type {
  AttachmentScanStatus,
  DiscussionAnswerRecord,
  DiscussionAnswerTutorRatingRecord,
  DiscussionAskScopeOptions,
  DiscussionAttachmentRecord,
  DiscussionCommentRecord,
  DiscussionCorrectionRecord,
  DiscussionDatabase,
  DiscussionFeedFilter,
  DiscussionFeedPage,
  DiscussionNotificationRecord,
  DiscussionQuestionRecord,
  DiscussionRatingAggregate,
  DiscussionReportRecord,
  DiscussionReportSeverity,
  DiscussionReportStatus,
  DiscussionReportTargetType,
  DiscussionRevisionEntityType,
  DiscussionRevisionRecord,
  DiscussionScope,
  DiscussionTagRecord,
  DiscussionVoteRecord,
  SafeDisplayIdentity,
} from "../../../../../packages/domain/discussions/models";

export class InMemoryDiscussionDatabase implements DiscussionDatabase {
  readonly questions = new Map<string, DiscussionQuestionRecord>();
  readonly answers = new Map<string, DiscussionAnswerRecord>();
  readonly attachments = new Map<string, DiscussionAttachmentRecord>();
  readonly votes: DiscussionVoteRecord[] = [];
  readonly identities = new Map<string, SafeDisplayIdentity>();
  readonly parentLinks = new Set<string>();
  readonly tutorStudentAssignments = new Set<string>();
  readonly groupStudents = new Set<string>();
  readonly groupTutors = new Set<string>();
  readonly approvedAnswerers = new Set<string>();
  readonly tags = new Map<string, DiscussionTagRecord>();
  readonly questionTags = new Map<string, Set<string>>();
  readonly ratings = new Map<string, DiscussionAnswerTutorRatingRecord>();
  readonly comments = new Map<string, DiscussionCommentRecord>();
  readonly follows = new Set<string>();
  readonly bookmarks = new Set<string>();
  readonly corrections = new Map<string, DiscussionCorrectionRecord>();
  readonly revisions: DiscussionRevisionRecord[] = [];
  readonly notifications = new Map<string, DiscussionNotificationRecord>();
  readonly reports = new Map<string, DiscussionReportRecord>();
  readonly studentUserIds = new Map<string, string>();
  readonly studentGradeLevels = new Map<string, string>();
  readonly askScopeOptions = new Map<string, DiscussionAskScopeOptions>();

  async transaction<T>(operation: (database: DiscussionDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async saveQuestion(question: DiscussionQuestionRecord) {
    this.questions.set(question.id, question);
  }
  async getQuestion(questionId: string) {
    return this.questions.get(questionId) ?? null;
  }
  async getQuestionBySlug(slug: string) {
    return [...this.questions.values()].find((q) => q.slug === slug) ?? null;
  }
  async listQuestions(scope: DiscussionScope) {
    return [...this.questions.values()].filter(
      (question) =>
        question.courseId === scope.courseId &&
        question.groupId === scope.groupId &&
        question.subjectId === scope.subjectId,
    );
  }
  async listQuestionsByStudent(studentProfileId: string, since?: Date) {
    return [...this.questions.values()].filter(
      (q) => q.studentProfileId === studentProfileId && (!since || q.createdAt >= since),
    );
  }
  async getUserIdForStudentProfile(studentProfileId: string) {
    return this.studentUserIds.get(studentProfileId) ?? null;
  }
  async getGradeLevelForStudentProfile(studentProfileId: string) {
    return this.studentGradeLevels.get(studentProfileId) ?? null;
  }
  async queryFeed(filter: DiscussionFeedFilter): Promise<DiscussionFeedPage> {
    let items = [...this.questions.values()].filter((q) => !q.deletedAt);
    if (filter.authorUserId) items = items.filter((q) => q.authorUserId === filter.authorUserId);
    if (filter.subjectId) items = items.filter((q) => q.subjectId === filter.subjectId);
    if (filter.status) items = items.filter((q) => q.status === filter.status);
    if (filter.needsTutorReview) {
      items = items.filter((q) => q.status === "open" || q.status === "needs_tutor_review");
    }
    if (filter.search) {
      const needle = filter.search.toLowerCase();
      items = items.filter(
        (q) => q.title.toLowerCase().includes(needle) || q.body.toLowerCase().includes(needle),
      );
    }
    items.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    const limit = filter.limit ?? 20;
    return {
      items: items.slice(0, limit).map((question) => ({
        question,
        answerCount: [...this.answers.values()].filter(
          (a) => a.questionId === question.id && !a.deletedAt,
        ).length,
        tutorAnswerCount: [...this.answers.values()].filter(
          (a) => a.questionId === question.id && !a.deletedAt && a.isTutorAnswer,
        ).length,
        commentCount: [...this.comments.values()].filter(
          (c) => c.questionId === question.id && !c.deletedAt,
        ).length,
        helpfulCount: this.votes.filter((v) =>
          [...this.answers.values()].some(
            (a) => a.id === v.answerId && a.questionId === question.id,
          ),
        ).length,
        topTutorRatingAverage:
          [...this.answers.values()]
            .filter(
              (a) =>
                a.questionId === question.id &&
                !a.deletedAt &&
                !a.isTutorAnswer &&
                a.tutorRatingAverage !== null,
            )
            .sort((a, b) => (b.tutorRatingAverage ?? 0) - (a.tutorRatingAverage ?? 0))[0]
            ?.tutorRatingAverage ?? null,
        topTutorRatingCount:
          [...this.answers.values()]
            .filter(
              (a) =>
                a.questionId === question.id &&
                !a.deletedAt &&
                !a.isTutorAnswer &&
                a.tutorRatingAverage !== null,
            )
            .sort((a, b) => (b.tutorRatingAverage ?? 0) - (a.tutorRatingAverage ?? 0))[0]
            ?.tutorRatingCount ?? 0,
        tags: [...(this.questionTags.get(question.id) ?? [])]
          .map((id) => this.tags.get(id))
          .filter((t): t is DiscussionTagRecord => Boolean(t)),
      })),
      nextCursor: null,
    };
  }
  async updateQuestionStatus(questionId: string, status: DiscussionQuestionRecord["status"]) {
    const question = this.questions.get(questionId);
    if (question) this.questions.set(questionId, { ...question, status, updatedAt: new Date() });
  }
  async updateQuestion(questionId: string, patch: Partial<DiscussionQuestionRecord>) {
    const question = this.questions.get(questionId);
    if (question) this.questions.set(questionId, { ...question, ...patch, updatedAt: new Date() });
  }
  async incrementQuestionViewCount(questionId: string) {
    const question = this.questions.get(questionId);
    if (question)
      this.questions.set(questionId, { ...question, viewCount: question.viewCount + 1 });
  }
  async touchQuestionActivity(questionId: string, at = new Date()) {
    const question = this.questions.get(questionId);
    if (question) this.questions.set(questionId, { ...question, lastActivityAt: at });
  }

  async saveAnswer(answer: DiscussionAnswerRecord) {
    this.answers.set(answer.id, answer);
  }
  async getAnswer(answerId: string) {
    return this.answers.get(answerId) ?? null;
  }
  async listAnswers(questionId: string) {
    return [...this.answers.values()].filter((answer) => answer.questionId === questionId);
  }
  async listAnswersByAuthorUserId(authorUserId: string, since?: Date) {
    return [...this.answers.values()].filter(
      (a) => a.authorUserId === authorUserId && (!since || a.createdAt >= since),
    );
  }
  async updateAnswerVerification(
    answerId: string,
    values: {
      verificationStatus: DiscussionAnswerRecord["verificationStatus"];
      verificationNote: string | null;
      verifiedByUserId: string;
      verifiedAt: Date;
    },
  ) {
    const answer = this.answers.get(answerId);
    if (answer)
      this.answers.set(answerId, {
        ...answer,
        ...values,
        updatedAt: values.verifiedAt,
      });
  }
  async updateAnswer(answerId: string, patch: Partial<DiscussionAnswerRecord>) {
    const answer = this.answers.get(answerId);
    if (answer) this.answers.set(answerId, { ...answer, ...patch, updatedAt: new Date() });
  }

  async saveAttachment(attachment: DiscussionAttachmentRecord) {
    this.attachments.set(attachment.id, attachment);
  }
  async getAttachment(attachmentId: string) {
    return this.attachments.get(attachmentId) ?? null;
  }
  async updateAttachmentScanStatus(attachmentId: string, status: AttachmentScanStatus) {
    const attachment = this.attachments.get(attachmentId);
    if (attachment) this.attachments.set(attachmentId, { ...attachment, virusScanStatus: status });
  }
  async listAttachments(questionId: string) {
    return [...this.attachments.values()].filter((a) => a.questionId === questionId);
  }

  async saveVote(vote: DiscussionVoteRecord) {
    this.votes.push(vote);
  }
  async hasVote(answerId: string, voterUserId: string) {
    return this.votes.some(
      (vote) => vote.answerId === answerId && vote.voterUserId === voterUserId,
    );
  }
  async countVotesByUserSince(voterUserId: string, since: Date) {
    return this.votes.filter((vote) => vote.voterUserId === voterUserId && vote.createdAt >= since)
      .length;
  }
  async countVotesForAnswer(answerId: string) {
    return this.votes.filter((vote) => vote.answerId === answerId).length;
  }

  async getOrCreateTagsByName(names: string[]): Promise<DiscussionTagRecord[]> {
    return names.map((name) => {
      const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
      const existing = [...this.tags.values()].find((t) => t.slug === slug);
      if (existing) return existing;
      const tag: DiscussionTagRecord = {
        id: crypto.randomUUID(),
        name: name.trim(),
        slug,
        description: null,
        colorToken: null,
        usageCount: 0,
      };
      this.tags.set(tag.id, tag);
      return tag;
    });
  }
  async listTags(search?: string) {
    const all = [...this.tags.values()];
    return search ? all.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())) : all;
  }
  async setQuestionTags(questionId: string, tagIds: string[]) {
    this.questionTags.set(questionId, new Set(tagIds));
  }
  async listTagsForQuestion(questionId: string) {
    return [...(this.questionTags.get(questionId) ?? [])]
      .map((id) => this.tags.get(id))
      .filter((t): t is DiscussionTagRecord => Boolean(t));
  }
  async listTagsForQuestions(questionIds: string[]) {
    const map = new Map<string, DiscussionTagRecord[]>();
    for (const id of questionIds) map.set(id, await this.listTagsForQuestion(id));
    return map;
  }

  async saveRating(rating: DiscussionAnswerTutorRatingRecord) {
    this.ratings.set(rating.id, rating);
  }
  async getActiveRatingByTutorAndAnswer(answerId: string, tutorId: string) {
    return (
      [...this.ratings.values()].find(
        (r) => r.answerId === answerId && r.tutorId === tutorId && !r.deletedAt && !r.invalidatedAt,
      ) ?? null
    );
  }
  async getRating(ratingId: string) {
    return this.ratings.get(ratingId) ?? null;
  }
  async listActiveRatingsForAnswer(answerId: string) {
    return [...this.ratings.values()].filter(
      (r) => r.answerId === answerId && !r.deletedAt && !r.invalidatedAt,
    );
  }
  async listAllRatingsForAnswer(answerId: string) {
    return [...this.ratings.values()].filter((r) => r.answerId === answerId);
  }
  async updateAnswerRatingAggregate(answerId: string, aggregate: DiscussionRatingAggregate) {
    const answer = this.answers.get(answerId);
    if (answer)
      this.answers.set(answerId, {
        ...answer,
        tutorRatingAverage: aggregate.average,
        tutorRatingCount: aggregate.count,
      });
  }

  async saveComment(comment: DiscussionCommentRecord) {
    this.comments.set(comment.id, comment);
  }
  async getComment(commentId: string) {
    return this.comments.get(commentId) ?? null;
  }
  async listCommentsForQuestion(questionId: string) {
    return [...this.comments.values()].filter((c) => c.questionId === questionId);
  }
  async listCommentsForAnswer(answerId: string) {
    return [...this.comments.values()].filter((c) => c.answerId === answerId);
  }
  async updateComment(commentId: string, patch: { body?: string; deletedAt?: Date }) {
    const comment = this.comments.get(commentId);
    if (comment) this.comments.set(commentId, { ...comment, ...patch, updatedAt: new Date() });
  }

  async saveFollow(userId: string, questionId: string) {
    this.follows.add(`${userId}:${questionId}`);
  }
  async removeFollow(userId: string, questionId: string) {
    this.follows.delete(`${userId}:${questionId}`);
  }
  async hasFollow(userId: string, questionId: string) {
    return this.follows.has(`${userId}:${questionId}`);
  }
  async listFollowerUserIds(questionId: string) {
    return [...this.follows]
      .filter((key) => key.endsWith(`:${questionId}`))
      .map((key) => key.split(":")[0] ?? "");
  }

  async saveBookmark(userId: string, questionId: string) {
    this.bookmarks.add(`${userId}:${questionId}`);
  }
  async removeBookmark(userId: string, questionId: string) {
    this.bookmarks.delete(`${userId}:${questionId}`);
  }
  async hasBookmark(userId: string, questionId: string) {
    return this.bookmarks.has(`${userId}:${questionId}`);
  }

  async saveCorrection(correction: DiscussionCorrectionRecord) {
    this.corrections.set(correction.id, correction);
  }
  async getCorrection(correctionId: string) {
    return this.corrections.get(correctionId) ?? null;
  }
  async listCorrectionsForAnswer(answerId: string) {
    return [...this.corrections.values()].filter((c) => c.answerId === answerId);
  }
  async updateCorrection(correctionId: string, patch: Partial<DiscussionCorrectionRecord>) {
    const correction = this.corrections.get(correctionId);
    if (correction)
      this.corrections.set(correctionId, { ...correction, ...patch, updatedAt: new Date() });
  }

  async saveRevision(revision: DiscussionRevisionRecord) {
    this.revisions.push(revision);
  }
  async listRevisions(entityType: DiscussionRevisionEntityType, entityId: string) {
    return this.revisions.filter((r) => r.entityType === entityType && r.entityId === entityId);
  }

  async saveNotification(notification: DiscussionNotificationRecord) {
    this.notifications.set(notification.id, notification);
  }
  async listNotifications(recipientId: string, options?: { unreadOnly?: boolean; limit?: number }) {
    let items = [...this.notifications.values()].filter((n) => n.recipientId === recipientId);
    if (options?.unreadOnly) items = items.filter((n) => !n.readAt);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items.slice(0, options?.limit ?? 50);
  }
  async markNotificationRead(notificationId: string, recipientId: string) {
    const notification = this.notifications.get(notificationId);
    if (notification && notification.recipientId === recipientId)
      this.notifications.set(notificationId, { ...notification, readAt: new Date() });
  }
  async countUnreadNotifications(recipientId: string) {
    return [...this.notifications.values()].filter(
      (n) => n.recipientId === recipientId && !n.readAt,
    ).length;
  }

  async saveReport(report: DiscussionReportRecord) {
    this.reports.set(report.id, report);
  }
  async getReport(reportId: string) {
    return this.reports.get(reportId) ?? null;
  }
  async listReports(filter: {
    status?: DiscussionReportStatus;
    severity?: DiscussionReportSeverity;
    assignedModeratorId?: string;
    targetType?: DiscussionReportTargetType;
  }) {
    return [...this.reports.values()].filter(
      (r) =>
        (!filter.status || r.status === filter.status) &&
        (!filter.severity || r.severity === filter.severity) &&
        (!filter.assignedModeratorId || r.assignedModeratorId === filter.assignedModeratorId) &&
        (!filter.targetType || r.targetType === filter.targetType),
    );
  }
  async updateReport(reportId: string, patch: Partial<DiscussionReportRecord>) {
    const report = this.reports.get(reportId);
    if (report) this.reports.set(reportId, { ...report, ...patch, updatedAt: new Date() });
  }

  async getSafeDisplayIdentity(userId: string) {
    return this.identities.get(userId) ?? null;
  }
  async isParentLinkedToStudent(parentUserId: string, studentProfileId: string) {
    return this.parentLinks.has(`${parentUserId}:${studentProfileId}`);
  }
  async isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string) {
    return this.tutorStudentAssignments.has(`${tutorUserId}:${studentProfileId}`);
  }
  async isStudentInGroup(studentProfileId: string, groupId: string) {
    return this.groupStudents.has(`${studentProfileId}:${groupId}`);
  }
  async isTutorAssignedToGroup(tutorUserId: string, groupId: string) {
    return this.groupTutors.has(`${tutorUserId}:${groupId}`);
  }
  async isApprovedStudentAnswerer(studentProfileId: string, groupId: string | null) {
    return this.approvedAnswerers.has(`${studentProfileId}:${groupId ?? "private"}`);
  }
  async listLinkedChildStudentProfileIds(parentUserId: string) {
    return [...this.parentLinks]
      .filter((key) => key.startsWith(`${parentUserId}:`))
      .map((key) => key.split(":")[1] ?? "");
  }
  async listAskScopeOptionsForStudent(studentProfileId: string) {
    return this.askScopeOptions.get(studentProfileId) ?? { courses: [], subjects: [] };
  }
}
