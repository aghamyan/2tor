import {
  abuseReports,
  adminAccessReasons,
  auditEvents,
  conversationMembers,
  conversations,
  incidents,
  messageAttachments,
  messageReads,
  messages,
  roles,
  userRoles,
  users,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, desc, eq, gt, inArray, isNull, lt, notExists, or, sql } from "drizzle-orm";

import type {
  AbuseReportRecord,
  CommunicationDatabase,
  CommunicationMemberRoleSet,
  ConversationMemberRecord,
  ConversationSummary,
  MessageAttachmentRecord,
  MessageReadRecord,
  MessageRecord,
} from "./models";

type Executor = Database | Transaction;

const memberFromRow = (row: typeof conversationMembers.$inferSelect): ConversationMemberRecord => ({
  id: row.id,
  conversationId: row.conversationId,
  userId: row.userId,
  role: row.role,
  joinedAt: row.joinedAt,
  leftAt: row.leftAt,
  createdAt: row.createdAt,
});

const attachmentFromRow = (
  row: typeof messageAttachments.$inferSelect,
): MessageAttachmentRecord => ({
  id: row.id,
  messageId: row.messageId,
  fileKey: row.fileKey,
  fileName: row.fileName,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  virusScanStatus: row.virusScanStatus,
  createdAt: row.createdAt,
});

const readFromRow = (row: typeof messageReads.$inferSelect): MessageReadRecord => ({
  id: row.id,
  messageId: row.messageId,
  userId: row.userId,
  readAt: row.readAt,
});

async function membersFor(
  executor: Executor,
  conversationId: string,
): Promise<ConversationMemberRecord[]> {
  return (
    await executor
      .select()
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId))
      .orderBy(asc(conversationMembers.joinedAt))
  ).map(memberFromRow);
}

async function summaryFromRow(
  executor: Executor,
  row: typeof conversations.$inferSelect,
): Promise<ConversationSummary> {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    createdByUserId: row.createdByUserId,
    isMonitored: row.isMonitored,
    members: await membersFor(executor, row.id),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function hydrateMessages(
  executor: Executor,
  rows: (typeof messages.$inferSelect)[],
): Promise<MessageRecord[]> {
  const messageIds = rows.map((row) => row.id);
  const [attachmentRows, readRows] = messageIds.length
    ? await Promise.all([
        executor
          .select()
          .from(messageAttachments)
          .where(inArray(messageAttachments.messageId, messageIds))
          .orderBy(asc(messageAttachments.createdAt)),
        executor
          .select()
          .from(messageReads)
          .where(inArray(messageReads.messageId, messageIds))
          .orderBy(asc(messageReads.readAt)),
      ])
    : [[], []];
  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    senderUserId: row.senderUserId,
    body: row.isRedacted ? "" : row.body,
    sentAt: row.sentAt,
    editedAt: row.editedAt,
    isRedacted: row.isRedacted,
    createdAt: row.createdAt,
    attachments: attachmentRows
      .filter((attachment) => attachment.messageId === row.id)
      .map(attachmentFromRow),
    reads: readRows.filter((read) => read.messageId === row.id).map(readFromRow),
  }));
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): CommunicationDatabase {
  return {
    async transaction<T>(operation: (database: CommunicationDatabase) => Promise<T>) {
      return insideTransaction
        ? operation(repository(executor, root, true))
        : root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async findAccountCommunicationRoles(userIds) {
      const result = new Map<string, CommunicationMemberRoleSet>();
      userIds.forEach((userId) =>
        result.set(userId, { parent: false, student: false, tutor: false, staff: false }),
      );
      if (userIds.length === 0) return result;
      const rows = await executor
        .select({ userId: userRoles.userId, roleKey: roles.key })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(inArray(userRoles.userId, [...userIds]), isNull(userRoles.revokedAt)));
      rows.forEach((row) => {
        const set = result.get(row.userId);
        if (!set) return;
        if (row.roleKey === "parent") set.parent = true;
        if (row.roleKey === "student") set.student = true;
        if (row.roleKey === "tutor") set.tutor = true;
        if (row.roleKey === "administrator" || row.roleKey === "super_administrator") {
          set.staff = true;
        }
      });
      return result;
    },

    async saveConversation(conversation) {
      const write = async (target: Executor) => {
        await target.insert(conversations).values({
          id: conversation.id,
          type: conversation.type,
          title: conversation.title,
          createdByUserId: conversation.createdByUserId,
          isMonitored: true,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        });
        await target.insert(conversationMembers).values(
          conversation.members.map((member) => ({
            id: member.id,
            conversationId: member.conversationId,
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt,
            leftAt: member.leftAt,
            createdAt: member.createdAt,
          })),
        );
      };
      if (insideTransaction) await write(executor);
      else await root.transaction(write);
    },

    async getConversationSummary(conversationId) {
      const [row] = await executor
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      return row ? summaryFromRow(executor, row) : null;
    },

    async listConversationsForActor(userId, includeAll, cursor, limit) {
      const baseCondition = cursor ? lt(conversations.id, cursor) : undefined;
      const rows = includeAll
        ? await executor
            .select()
            .from(conversations)
            .where(baseCondition)
            .orderBy(desc(conversations.id))
            .limit(limit)
        : await executor
            .select({
              id: conversations.id,
              type: conversations.type,
              title: conversations.title,
              createdByUserId: conversations.createdByUserId,
              isMonitored: conversations.isMonitored,
              createdAt: conversations.createdAt,
              updatedAt: conversations.updatedAt,
            })
            .from(conversations)
            .innerJoin(
              conversationMembers,
              and(
                eq(conversationMembers.conversationId, conversations.id),
                eq(conversationMembers.userId, userId),
                isNull(conversationMembers.leftAt),
              ),
            )
            .where(baseCondition)
            .orderBy(desc(conversations.id))
            .limit(limit);
      return Promise.all(rows.map((row) => summaryFromRow(executor, row)));
    },

    async saveMessage(message) {
      await executor.insert(messages).values({
        id: message.id,
        conversationId: message.conversationId,
        senderUserId: message.senderUserId,
        body: message.body,
        sentAt: message.sentAt,
        editedAt: null,
        isRedacted: false,
        createdAt: message.createdAt,
      });
    },

    async getMessage(messageId) {
      const [row] = await executor
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);
      return row ? ((await hydrateMessages(executor, [row]))[0] ?? null) : null;
    },

    async getMessageLocator(messageId) {
      const [row] = await executor
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderUserId: messages.senderUserId,
        })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);
      return row ?? null;
    },

    async listMessages(conversationId, cursor, limit) {
      const rows = await executor
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            cursor ? gt(messages.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(messages.id))
        .limit(limit);
      return hydrateMessages(executor, rows);
    },

    async saveAttachment(attachment) {
      await executor.insert(messageAttachments).values(attachment);
    },

    async getAttachment(attachmentId) {
      const [row] = await executor
        .select()
        .from(messageAttachments)
        .where(eq(messageAttachments.id, attachmentId))
        .limit(1);
      return row ? attachmentFromRow(row) : null;
    },

    async updateAttachmentScanStatus(attachmentId, status) {
      await executor
        .update(messageAttachments)
        .set({ virusScanStatus: status })
        .where(eq(messageAttachments.id, attachmentId));
    },

    async saveRead(read) {
      await executor.insert(messageReads).values(read).onConflictDoNothing();
      const [saved] = await executor
        .select()
        .from(messageReads)
        .where(
          and(eq(messageReads.messageId, read.messageId), eq(messageReads.userId, read.userId)),
        )
        .limit(1);
      return saved ? readFromRow(saved) : read;
    },

    async saveAbuseReport(report: AbuseReportRecord) {
      await executor.insert(abuseReports).values(report);
    },

    async saveAdminAccessReason(reason) {
      await executor.insert(adminAccessReasons).values({
        ...reason,
        createdAt: reason.accessedAt,
      });
    },

    async appendAudit(event) {
      await executor.insert(auditEvents).values({
        id: event.id,
        actorUserId: event.actorUserId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        reason: event.reason,
        previousValue: event.previousValue,
        newValue: event.newValue,
      });
    },

    async redactMessage(messageId) {
      await executor
        .update(messages)
        .set({ body: "[redacted]", isRedacted: true, editedAt: new Date() })
        .where(eq(messages.id, messageId));
    },

    async listMessagesEligibleForRetention(cutoff, limit) {
      const activeMemberExists = executor
        .select({ id: conversationMembers.id })
        .from(conversationMembers)
        .innerJoin(users, eq(users.id, conversationMembers.userId))
        .where(
          and(
            eq(conversationMembers.conversationId, messages.conversationId),
            gt(sql<Date>`coalesce(${users.lastLoginAt}, ${users.createdAt})`, cutoff),
          ),
        );
      const safetyReportExists = executor
        .select({ id: abuseReports.id })
        .from(abuseReports)
        .where(and(eq(abuseReports.targetType, "message"), eq(abuseReports.targetId, messages.id)));
      const incidentExists = executor
        .select({ id: incidents.id })
        .from(incidents)
        .where(
          or(
            and(
              or(
                eq(incidents.relatedEntityType, "message"),
                eq(incidents.relatedEntityType, "messages"),
              ),
              eq(incidents.relatedEntityId, messages.id),
            ),
            and(
              or(
                eq(incidents.relatedEntityType, "conversation"),
                eq(incidents.relatedEntityType, "conversations"),
              ),
              eq(incidents.relatedEntityId, messages.conversationId),
            ),
          ),
        );
      const rows = await executor
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            lt(messages.sentAt, cutoff),
            notExists(activeMemberExists),
            notExists(safetyReportExists),
            notExists(incidentExists),
          ),
        )
        .orderBy(asc(messages.sentAt))
        .limit(limit);
      const ids = rows.map((row) => row.id);
      const attachmentRows = ids.length
        ? await executor
            .select({
              messageId: messageAttachments.messageId,
              fileKey: messageAttachments.fileKey,
            })
            .from(messageAttachments)
            .where(inArray(messageAttachments.messageId, ids))
        : [];
      return ids.map((messageId) => ({
        messageId,
        attachmentFileKeys: attachmentRows
          .filter((attachment) => attachment.messageId === messageId)
          .map((attachment) => attachment.fileKey),
      }));
    },

    async deleteMessagesForRetention(messageIds) {
      if (messageIds.length === 0) return 0;
      const deleted = await executor
        .delete(messages)
        .where(inArray(messages.id, [...messageIds]))
        .returning({ id: messages.id });
      return deleted.length;
    },
  };
}

export function createDrizzleCommunicationDatabase(database: Database): CommunicationDatabase {
  return repository(database, database, false);
}
