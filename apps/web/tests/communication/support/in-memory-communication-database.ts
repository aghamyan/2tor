import type {
  AbuseReportRecord,
  AdminAccessReasonValues,
  CommunicationAuditValues,
  CommunicationDatabase,
  CommunicationMemberRoleSet,
  ConversationSummary,
  MessageAttachmentRecord,
  MessageReadRecord,
  MessageRecord,
  RetentionCandidate,
  VirusScanStatus,
} from "../../../../../packages/domain/communication/models";

export class InMemoryCommunicationDatabase implements CommunicationDatabase {
  readonly accountRoles = new Map<string, CommunicationMemberRoleSet>();
  readonly conversations = new Map<string, ConversationSummary>();
  readonly messages = new Map<string, MessageRecord>();
  readonly attachments = new Map<string, MessageAttachmentRecord>();
  readonly reports: AbuseReportRecord[] = [];
  readonly accessReasons: AdminAccessReasonValues[] = [];
  readonly audits: CommunicationAuditValues[] = [];
  readonly events: string[] = [];
  retentionCandidates: RetentionCandidate[] = [];

  setRoles(userId: string, roles: Partial<CommunicationMemberRoleSet>): void {
    this.accountRoles.set(userId, {
      parent: false,
      student: false,
      tutor: false,
      staff: false,
      ...roles,
    });
  }

  async transaction<T>(operation: (database: CommunicationDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findAccountCommunicationRoles(userIds: readonly string[]) {
    return new Map(
      userIds.flatMap((userId) => {
        const roles = this.accountRoles.get(userId);
        return roles ? [[userId, roles] as const] : [];
      }),
    );
  }

  async saveConversation(conversation: ConversationSummary) {
    this.conversations.set(conversation.id, conversation);
  }

  async getConversationSummary(conversationId: string) {
    return this.conversations.get(conversationId) ?? null;
  }

  async listConversationsForActor(
    userId: string,
    includeAll: boolean,
    cursor: string | null,
    limit: number,
  ) {
    return [...this.conversations.values()]
      .filter(
        (conversation) =>
          includeAll ||
          conversation.members.some((member) => member.userId === userId && member.leftAt === null),
      )
      .filter((conversation) => !cursor || conversation.id < cursor)
      .sort((left, right) => right.id.localeCompare(left.id))
      .slice(0, limit);
  }

  async saveMessage(message: MessageRecord) {
    this.messages.set(message.id, message);
  }

  async getMessage(messageId: string) {
    return this.messages.get(messageId) ?? null;
  }

  async getMessageLocator(messageId: string) {
    const message = this.messages.get(messageId);
    return message
      ? {
          id: message.id,
          conversationId: message.conversationId,
          senderUserId: message.senderUserId,
        }
      : null;
  }

  async listMessages(conversationId: string, cursor: string | null, limit: number) {
    this.events.push("messages:list");
    return [...this.messages.values()]
      .filter(
        (message) => message.conversationId === conversationId && (!cursor || message.id > cursor),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, limit);
  }

  async saveAttachment(attachment: MessageAttachmentRecord) {
    this.attachments.set(attachment.id, attachment);
    const message = this.messages.get(attachment.messageId);
    if (message) {
      this.messages.set(message.id, {
        ...message,
        attachments: [...message.attachments, attachment],
      });
    }
  }

  async getAttachment(attachmentId: string) {
    return this.attachments.get(attachmentId) ?? null;
  }

  async updateAttachmentScanStatus(attachmentId: string, status: VirusScanStatus) {
    const attachment = this.attachments.get(attachmentId);
    if (attachment) this.attachments.set(attachmentId, { ...attachment, virusScanStatus: status });
  }

  async saveRead(read: MessageReadRecord) {
    const message = this.messages.get(read.messageId);
    const existing = message?.reads.find((candidate) => candidate.userId === read.userId);
    if (existing) return existing;
    if (message) this.messages.set(message.id, { ...message, reads: [...message.reads, read] });
    return read;
  }

  async saveAbuseReport(report: AbuseReportRecord) {
    this.reports.push(report);
  }

  async saveAdminAccessReason(reason: AdminAccessReasonValues) {
    this.events.push("staff-reason:write");
    this.accessReasons.push(reason);
  }

  async appendAudit(event: CommunicationAuditValues) {
    this.events.push("audit:write");
    this.audits.push(event);
  }

  async redactMessage(messageId: string) {
    const message = this.messages.get(messageId);
    if (message) this.messages.set(message.id, { ...message, body: "", isRedacted: true });
  }

  async listMessagesEligibleForRetention(_cutoff: Date, limit: number) {
    return this.retentionCandidates.slice(0, limit);
  }

  async deleteMessagesForRetention(messageIds: readonly string[]) {
    let deleted = 0;
    messageIds.forEach((messageId) => {
      if (this.messages.delete(messageId)) deleted += 1;
    });
    return deleted;
  }
}
