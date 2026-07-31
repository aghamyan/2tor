export type DiscussionRole =
  "parent" | "student" | "tutor" | "administrator" | "super_administrator";
export type DiscussionVisibility = "private_support" | "group_shared";
export type DiscussionStatus = "open" | "pending_moderation" | "closed";
export type AnswerVerificationStatus = "unverified" | "verified";
export type AttachmentScanStatus = "pending" | "clean" | "infected" | "error";

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
  body: string;
  visibility: DiscussionVisibility;
  status: DiscussionStatus;
  piiFlags: PiiFlag[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionAnswerRecord {
  id: string;
  questionId: string;
  authorUserId: string;
  authorDisplayName: string;
  authorKind: "student" | "tutor";
  body: string;
  verificationStatus: AnswerVerificationStatus;
  verifiedByUserId: string | null;
  verifiedAt: Date | null;
  piiFlags: PiiFlag[];
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

export interface TutorResponseSlaMetric {
  questionId: string;
  targetServiceHours: 12;
  firstTutorResponseAt: Date | null;
  serviceHoursElapsed: number;
  met: boolean | null;
}

/**
 * The persistence boundary intentionally exposes relationships, not arbitrary people lookup.
 * This prevents this slice from becoming a people directory or a direct-message primitive.
 */
export interface DiscussionDatabase {
  transaction<T>(operation: (database: DiscussionDatabase) => Promise<T>): Promise<T>;
  saveQuestion(question: DiscussionQuestionRecord): Promise<void>;
  getQuestion(questionId: string): Promise<DiscussionQuestionRecord | null>;
  listQuestions(scope: DiscussionScope): Promise<DiscussionQuestionRecord[]>;
  updateQuestionStatus(questionId: string, status: DiscussionStatus): Promise<void>;
  saveAnswer(answer: DiscussionAnswerRecord): Promise<void>;
  getAnswer(answerId: string): Promise<DiscussionAnswerRecord | null>;
  listAnswers(questionId: string): Promise<DiscussionAnswerRecord[]>;
  updateAnswerVerification(
    answerId: string,
    verifiedByUserId: string,
    verifiedAt: Date,
  ): Promise<void>;
  saveAttachment(attachment: DiscussionAttachmentRecord): Promise<void>;
  getAttachment(attachmentId: string): Promise<DiscussionAttachmentRecord | null>;
  updateAttachmentScanStatus(attachmentId: string, status: AttachmentScanStatus): Promise<void>;
  saveVote(vote: DiscussionVoteRecord): Promise<void>;
  hasVote(answerId: string, voterUserId: string): Promise<boolean>;
  countVotesByUserSince(voterUserId: string, since: Date): Promise<number>;
  getSafeDisplayIdentity(userId: string): Promise<SafeDisplayIdentity | null>;
  isParentLinkedToStudent(parentUserId: string, studentProfileId: string): Promise<boolean>;
  isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string): Promise<boolean>;
  isStudentInGroup(studentProfileId: string, groupId: string): Promise<boolean>;
  isTutorAssignedToGroup(tutorUserId: string, groupId: string): Promise<boolean>;
  isApprovedStudentAnswerer(studentProfileId: string, groupId: string | null): Promise<boolean>;
}
