export type DiscussionRole =
  "parent" | "student" | "tutor" | "administrator" | "super_administrator";
export type DiscussionVisibility = "private_support" | "group_shared" | "tutors_only" | "community";
export type DiscussionStatus =
  | "open"
  | "answered"
  | "accepted"
  | "tutor_verified"
  | "needs_tutor_review"
  | "needs_clarification"
  | "closed"
  | "locked"
  | "duplicate"
  | "resolved"
  | "pending_moderation";
export type DiscussionQuestionType =
  | "concept_explanation"
  | "homework_help"
  | "check_my_solution"
  | "alternative_method"
  | "exam_preparation"
  | "proof_review"
  | "general_discussion";
export type AnswerVerificationStatus =
  | "unverified"
  | "correct"
  | "mostly_correct"
  | "correct_approach_arithmetic_error"
  | "needs_revision"
  | "incorrect"
  | "incomplete_explanation";
export type AttachmentScanStatus = "pending" | "clean" | "infected" | "error";
export type DiscussionCorrectionStatus =
  "pending" | "accepted" | "partially_accepted" | "rejected" | "resolved";
export type DiscussionReportStatus = "open" | "reviewing" | "resolved" | "dismissed" | "escalated";
export type DiscussionReportSeverity = "low" | "medium" | "high" | "critical";
export type DiscussionReportTargetType =
  "discussion_question" | "discussion_answer" | "discussion_comment";
export type DiscussionRevisionEntityType = "question" | "answer";
export type DiscussionNotificationType =
  | "question_answered"
  | "question_commented"
  | "user_mentioned"
  | "answer_accepted"
  | "answer_unaccepted"
  | "answer_tutor_verified"
  | "answer_revision_requested"
  | "answer_tutor_rated"
  | "answer_tutor_rating_updated"
  | "answer_tutor_rating_removed"
  | "answer_correction_suggested"
  | "answer_correction_resolved"
  | "followed_question_activity"
  | "content_moderation_updated";

export interface DiscussionActor {
  /** Authenticated account ID. Anonymous actors are deliberately not representable. */
  userId: string;
  roles: readonly DiscussionRole[];
  studentProfileId?: string;
}

/** This deliberately contains no surname, legal name, email, phone, or address. */
export interface SafeDisplayIdentity {
  firstName: string;
  controlledIdentifier: string;
}

export interface DiscussionScope {
  courseId: string | null;
  groupId: string | null;
  subjectId: string | null;
}

export interface PiiFlag {
  kind: "email" | "phone" | "address" | "government_identifier";
  /** Detection metadata only; never persist the matched personal data itself. */
  detectedAt: Date;
}

export interface DiscussionQuestionRecord extends DiscussionScope {
  id: string;
  studentProfileId: string;
  authorUserId: string;
  authorDisplayName: string;
  title: string;
  slug: string;
  body: string;
  bodyFormat: "markdown";
  topicId: string | null;
  gradeLevel: string | null;
  questionType: DiscussionQuestionType;
  whatTried: string | null;
  visibility: DiscussionVisibility;
  relatedClassId: string | null;
  status: DiscussionStatus;
  acceptedAnswerId: string | null;
  duplicateOfQuestionId: string | null;
  piiFlags: PiiFlag[];
  viewCount: number;
  lastActivityAt: Date;
  lockedAt: Date | null;
  lockedById: string | null;
  closedAt: Date | null;
  closedById: string | null;
  closedReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionAnswerRecord {
  id: string;
  questionId: string;
  authorUserId: string;
  authorDisplayName: string;
  authorKind: "student" | "tutor";
  isTutorAnswer: boolean;
  body: string;
  bodyFormat: "markdown";
  isAccepted: boolean;
  verificationStatus: AnswerVerificationStatus;
  verificationNote: string | null;
  verifiedByUserId: string | null;
  verifiedAt: Date | null;
  tutorRatingAverage: number | null;
  tutorRatingCount: number;
  revisedAfterRatingAt: Date | null;
  piiFlags: PiiFlag[];
  lockedAt: Date | null;
  lockedById: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionAttachmentRecord {
  id: string;
  questionId: string;
  uploadedByUserId: string;
  fileKey: string;
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  sizeBytes: number;
  virusScanStatus: AttachmentScanStatus;
  createdAt: Date;
}

export interface DiscussionVoteRecord {
  id: string;
  answerId: string;
  voterUserId: string;
  createdAt: Date;
}

export interface DiscussionTagRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  colorToken: string | null;
  usageCount: number;
}

export interface DiscussionAnswerTutorRatingRecord {
  id: string;
  answerId: string;
  tutorId: string;
  tutorDisplayName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  publicFeedback: string | null;
  deletedAt: Date | null;
  invalidatedAt: Date | null;
  invalidatedById: string | null;
  invalidationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionRatingAggregate {
  average: number | null;
  count: number;
}

export interface DiscussionCommentRecord {
  id: string;
  authorUserId: string;
  authorDisplayName: string;
  questionId: string | null;
  answerId: string | null;
  parentCommentId: string | null;
  body: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionCorrectionRecord {
  id: string;
  answerId: string;
  proposedById: string;
  proposedByDisplayName: string;
  issueDescription: string;
  proposedCorrection: string;
  explanation: string | null;
  status: DiscussionCorrectionStatus;
  authorResponse: string | null;
  resolvedById: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionRevisionRecord {
  id: string;
  entityType: DiscussionRevisionEntityType;
  entityId: string;
  editorId: string;
  previousBody: string;
  newBody: string;
  editReason: string | null;
  createdAt: Date;
}

export interface DiscussionNotificationRecord {
  id: string;
  recipientId: string;
  actorId: string | null;
  type: DiscussionNotificationType;
  questionId: string | null;
  answerId: string | null;
  ratingId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface DiscussionReportRecord {
  id: string;
  reporterId: string;
  targetType: DiscussionReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  severity: DiscussionReportSeverity | null;
  status: DiscussionReportStatus;
  assignedModeratorId: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TutorResponseSlaMetric {
  questionId: string;
  targetServiceHours: 12;
  firstTutorResponseAt: Date | null;
  serviceHoursElapsed: number;
  met: boolean | null;
}

/** Cursor-paginated feed filter. Every field is optional; `null`/absent means "no filter." */
export interface DiscussionFeedFilter {
  search?: string;
  subjectId?: string;
  topicId?: string;
  courseId?: string;
  gradeLevel?: string;
  questionType?: DiscussionQuestionType;
  status?: DiscussionStatus;
  tutorVerified?: boolean;
  minTutorRating?: number;
  tagSlug?: string;
  authorUserId?: string;
  followedByUserId?: string;
  savedByUserId?: string;
  needsTutorReview?: boolean;
  excludeStatuses?: DiscussionStatus[];
  sort?:
    | "recent_activity"
    | "newest"
    | "most_helpful"
    | "most_answered"
    | "unanswered"
    | "highest_rated"
    | "needs_tutor_review";
  cursor?: string | null;
  limit?: number;
}

export interface DiscussionFeedItem {
  question: DiscussionQuestionRecord;
  answerCount: number;
  /** Feed-level signals only; answer bodies remain on the detail page. */
  tutorAnswerCount: number;
  commentCount: number;
  helpfulCount: number;
  /** The strongest already-persisted tutor rating on a student answer, when one exists. */
  topTutorRatingAverage: number | null;
  topTutorRatingCount: number;
  tags: DiscussionTagRecord[];
}

export interface DiscussionFeedPage {
  items: DiscussionFeedItem[];
  nextCursor: string | null;
}

/**
 * The persistence boundary intentionally exposes relationships, not arbitrary people lookup.
 * This prevents this slice from becoming a people directory or a direct-message primitive.
 */
export interface DiscussionDatabase {
  transaction<T>(operation: (database: DiscussionDatabase) => Promise<T>): Promise<T>;

  saveQuestion(question: DiscussionQuestionRecord): Promise<void>;
  getQuestion(questionId: string): Promise<DiscussionQuestionRecord | null>;
  getQuestionBySlug(slug: string): Promise<DiscussionQuestionRecord | null>;
  listQuestions(scope: DiscussionScope): Promise<DiscussionQuestionRecord[]>;
  listQuestionsByStudent(
    studentProfileId: string,
    since?: Date,
  ): Promise<DiscussionQuestionRecord[]>;
  getUserIdForStudentProfile(studentProfileId: string): Promise<string | null>;
  /** The student's own enrollment grade level, used only to auto-tag their own questions for
   *  grade-level browsing — never exposed as a lookup on other students. */
  getGradeLevelForStudentProfile(studentProfileId: string): Promise<string | null>;
  queryFeed(filter: DiscussionFeedFilter, viewer: DiscussionActor): Promise<DiscussionFeedPage>;
  updateQuestionStatus(questionId: string, status: DiscussionStatus): Promise<void>;
  updateQuestion(
    questionId: string,
    patch: Partial<
      Pick<
        DiscussionQuestionRecord,
        | "title"
        | "body"
        | "status"
        | "acceptedAnswerId"
        | "closedAt"
        | "closedById"
        | "closedReason"
        | "lockedAt"
        | "lockedById"
        | "duplicateOfQuestionId"
        | "deletedAt"
        | "lastActivityAt"
        | "viewCount"
      >
    >,
  ): Promise<void>;
  incrementQuestionViewCount(questionId: string): Promise<void>;
  touchQuestionActivity(questionId: string, at?: Date): Promise<void>;

  saveAnswer(answer: DiscussionAnswerRecord): Promise<void>;
  getAnswer(answerId: string): Promise<DiscussionAnswerRecord | null>;
  listAnswers(questionId: string): Promise<DiscussionAnswerRecord[]>;
  listAnswersByAuthorUserId(authorUserId: string, since?: Date): Promise<DiscussionAnswerRecord[]>;
  updateAnswerVerification(
    answerId: string,
    values: {
      verificationStatus: AnswerVerificationStatus;
      verificationNote: string | null;
      verifiedByUserId: string;
      verifiedAt: Date;
    },
  ): Promise<void>;
  updateAnswer(
    answerId: string,
    patch: Partial<
      Pick<
        DiscussionAnswerRecord,
        | "body"
        | "isAccepted"
        | "revisedAfterRatingAt"
        | "lockedAt"
        | "lockedById"
        | "deletedAt"
        | "tutorRatingAverage"
        | "tutorRatingCount"
      >
    >,
  ): Promise<void>;

  saveAttachment(attachment: DiscussionAttachmentRecord): Promise<void>;
  getAttachment(attachmentId: string): Promise<DiscussionAttachmentRecord | null>;
  updateAttachmentScanStatus(attachmentId: string, status: AttachmentScanStatus): Promise<void>;
  listAttachments(questionId: string): Promise<DiscussionAttachmentRecord[]>;

  saveVote(vote: DiscussionVoteRecord): Promise<void>;
  hasVote(answerId: string, voterUserId: string): Promise<boolean>;
  countVotesByUserSince(voterUserId: string, since: Date): Promise<number>;
  countVotesForAnswer(answerId: string): Promise<number>;

  getOrCreateTagsByName(names: string[]): Promise<DiscussionTagRecord[]>;
  listTags(search?: string): Promise<DiscussionTagRecord[]>;
  setQuestionTags(questionId: string, tagIds: string[]): Promise<void>;
  listTagsForQuestion(questionId: string): Promise<DiscussionTagRecord[]>;
  listTagsForQuestions(questionIds: string[]): Promise<Map<string, DiscussionTagRecord[]>>;

  saveRating(rating: DiscussionAnswerTutorRatingRecord): Promise<void>;
  getActiveRatingByTutorAndAnswer(
    answerId: string,
    tutorId: string,
  ): Promise<DiscussionAnswerTutorRatingRecord | null>;
  getRating(ratingId: string): Promise<DiscussionAnswerTutorRatingRecord | null>;
  listActiveRatingsForAnswer(answerId: string): Promise<DiscussionAnswerTutorRatingRecord[]>;
  listAllRatingsForAnswer(answerId: string): Promise<DiscussionAnswerTutorRatingRecord[]>;
  updateAnswerRatingAggregate(
    answerId: string,
    aggregate: DiscussionRatingAggregate,
  ): Promise<void>;

  saveComment(comment: DiscussionCommentRecord): Promise<void>;
  getComment(commentId: string): Promise<DiscussionCommentRecord | null>;
  listCommentsForQuestion(questionId: string): Promise<DiscussionCommentRecord[]>;
  listCommentsForAnswer(answerId: string): Promise<DiscussionCommentRecord[]>;
  updateComment(commentId: string, patch: { body?: string; deletedAt?: Date }): Promise<void>;

  saveFollow(userId: string, questionId: string): Promise<void>;
  removeFollow(userId: string, questionId: string): Promise<void>;
  hasFollow(userId: string, questionId: string): Promise<boolean>;
  listFollowerUserIds(questionId: string): Promise<string[]>;

  saveBookmark(userId: string, questionId: string): Promise<void>;
  removeBookmark(userId: string, questionId: string): Promise<void>;
  hasBookmark(userId: string, questionId: string): Promise<boolean>;

  saveCorrection(correction: DiscussionCorrectionRecord): Promise<void>;
  getCorrection(correctionId: string): Promise<DiscussionCorrectionRecord | null>;
  listCorrectionsForAnswer(answerId: string): Promise<DiscussionCorrectionRecord[]>;
  updateCorrection(
    correctionId: string,
    patch: Partial<
      Pick<
        DiscussionCorrectionRecord,
        "status" | "authorResponse" | "resolvedById" | "resolutionNote" | "resolvedAt"
      >
    >,
  ): Promise<void>;

  saveRevision(revision: DiscussionRevisionRecord): Promise<void>;
  listRevisions(
    entityType: DiscussionRevisionEntityType,
    entityId: string,
  ): Promise<DiscussionRevisionRecord[]>;

  saveNotification(notification: DiscussionNotificationRecord): Promise<void>;
  listNotifications(
    recipientId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ): Promise<DiscussionNotificationRecord[]>;
  markNotificationRead(notificationId: string, recipientId: string): Promise<void>;
  countUnreadNotifications(recipientId: string): Promise<number>;

  saveReport(report: DiscussionReportRecord): Promise<void>;
  getReport(reportId: string): Promise<DiscussionReportRecord | null>;
  listReports(filter: {
    status?: DiscussionReportStatus;
    severity?: DiscussionReportSeverity;
    assignedModeratorId?: string;
    targetType?: DiscussionReportTargetType;
  }): Promise<DiscussionReportRecord[]>;
  updateReport(
    reportId: string,
    patch: Partial<
      Pick<
        DiscussionReportRecord,
        | "status"
        | "severity"
        | "assignedModeratorId"
        | "resolvedByUserId"
        | "resolutionNote"
        | "resolvedAt"
      >
    >,
  ): Promise<void>;

  getSafeDisplayIdentity(userId: string): Promise<SafeDisplayIdentity | null>;
  isParentLinkedToStudent(parentUserId: string, studentProfileId: string): Promise<boolean>;
  isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string): Promise<boolean>;
  isStudentInGroup(studentProfileId: string, groupId: string): Promise<boolean>;
  isTutorAssignedToGroup(tutorUserId: string, groupId: string): Promise<boolean>;
  isApprovedStudentAnswerer(studentProfileId: string, groupId: string | null): Promise<boolean>;
  listLinkedChildStudentProfileIds(parentUserId: string): Promise<string[]>;
  /** Scope choices for the ask-question form's course/group/subject picker — the student's own
   *  active enrollments only, never the full catalog. */
  listAskScopeOptionsForStudent(studentProfileId: string): Promise<DiscussionAskScopeOptions>;
}

export interface DiscussionAskScopeOptions {
  courses: Array<{ id: string; title: string; isGroup: boolean }>;
  subjects: Array<{ id: string; name: string }>;
}
