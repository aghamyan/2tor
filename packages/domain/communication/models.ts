export type CommunicationRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";
export type ConversationType = "parent_tutor" | "group_lesson" | "support" | "discussion_thread";
export type ConversationMemberRole = "parent" | "student" | "tutor" | "staff";
export type VirusScanStatus = "pending" | "clean" | "infected" | "error";

export interface CommunicationActor {
  userId: string;
  roles: readonly CommunicationRole[];
  mfaVerifiedAt?: Date | null;
}

export interface ConversationMemberRecord {
  id: string;
  conversationId: string;
  userId: string;
  role: ConversationMemberRole;
  joinedAt: Date;
  leftAt: Date | null;
  createdAt: Date;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title: string | null;
  createdByUserId: string;
  isMonitored: boolean;
  members: ConversationMemberRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageAttachmentRecord {
  id: string;
  messageId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  virusScanStatus: VirusScanStatus;
  createdAt: Date;
}

export interface MessageReadRecord {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  sentAt: Date;
  editedAt: Date | null;
  isRedacted: boolean;
  createdAt: Date;
  attachments: MessageAttachmentRecord[];
  reads: MessageReadRecord[];
}

export interface ConversationDetail extends ConversationSummary {
  messages: MessageRecord[];
  nextMessageCursor: string | null;
}

export interface ConversationPage {
  items: ConversationSummary[];
  nextCursor: string | null;
}

export interface AbuseReportRecord {
  id: string;
  reportedByUserId: string;
  targetType: "message";
  targetId: string;
  reason: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminAccessReasonValues {
  id: string;
  adminUserId: string;
  targetEntityType: "conversation";
  targetEntityId: string;
  reason: string;
  accessedAt: Date;
}

export interface CommunicationAuditValues {
  id: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  previousValue?: unknown;
  newValue?: unknown;
}

export interface RetentionCandidate {
  messageId: string;
  attachmentFileKeys: string[];
}

export interface CommunicationDatabase {
  transaction<T>(operation: (database: CommunicationDatabase) => Promise<T>): Promise<T>;

  findAccountCommunicationRoles(
    userIds: readonly string[],
  ): Promise<Map<string, CommunicationMemberRoleSet>>;
  saveConversation(conversation: ConversationSummary): Promise<void>;
  getConversationSummary(conversationId: string): Promise<ConversationSummary | null>;
  listConversationsForActor(
    userId: string,
    includeAll: boolean,
    cursor: string | null,
    limit: number,
  ): Promise<ConversationSummary[]>;

  saveMessage(message: MessageRecord): Promise<void>;
  getMessage(messageId: string): Promise<MessageRecord | null>;
  getMessageLocator(
    messageId: string,
  ): Promise<{ id: string; conversationId: string; senderUserId: string } | null>;
  listMessages(
    conversationId: string,
    cursor: string | null,
    limit: number,
  ): Promise<MessageRecord[]>;

  saveAttachment(attachment: MessageAttachmentRecord): Promise<void>;
  getAttachment(attachmentId: string): Promise<MessageAttachmentRecord | null>;
  updateAttachmentScanStatus(attachmentId: string, status: VirusScanStatus): Promise<void>;

  saveRead(read: MessageReadRecord): Promise<MessageReadRecord>;
  saveAbuseReport(report: AbuseReportRecord): Promise<void>;
  saveAdminAccessReason(reason: AdminAccessReasonValues): Promise<void>;
  appendAudit(event: CommunicationAuditValues): Promise<void>;
  redactMessage(messageId: string): Promise<void>;

  listMessagesEligibleForRetention(cutoff: Date, limit: number): Promise<RetentionCandidate[]>;
  deleteMessagesForRetention(messageIds: readonly string[]): Promise<number>;
}

export interface CommunicationMemberRoleSet {
  parent: boolean;
  student: boolean;
  tutor: boolean;
  staff: boolean;
}
