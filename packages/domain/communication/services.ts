import { ulid } from "ulid";

import { isAssignmentError } from "../assignments/errors";
import { validateSubmissionUpload } from "../assignments/services";
import {
  authorizeConversationAction,
  authorizeStaffConversationAccess,
  hasUnsafeAdultChildMembership,
} from "./authorize";
import { CommunicationError } from "./errors";
import type {
  AbuseReportRecord,
  CommunicationActor,
  CommunicationDatabase,
  ConversationDetail,
  ConversationMemberRecord,
  ConversationMemberRole,
  ConversationPage,
  ConversationSummary,
  MessageAttachmentRecord,
  MessageReadRecord,
  MessageRecord,
  VirusScanStatus,
} from "./models";
import {
  conversationListSchema,
  createConversationSchema,
  markReadSchema,
  messageListSchema,
  reportMessageSchema,
  sendMessageSchema,
  staffAccessReasonSchema,
  type CreateConversationInput,
  type ReportMessageInput,
  type SendMessageInput,
} from "./schemas";
import type { CommunicationStorage } from "./storage";

function requireActor(
  actor: CommunicationActor | null | undefined,
): asserts actor is CommunicationActor {
  if (!actor) {
    throw new CommunicationError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
  }
}

function isStaff(actor: CommunicationActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

function roleAllowed(
  actual: Awaited<ReturnType<CommunicationDatabase["findAccountCommunicationRoles"]>>,
  userId: string,
  role: ConversationMemberRole,
): boolean {
  return actual.get(userId)?.[role] === true;
}

async function requireVerifiedMemberRoles(
  database: CommunicationDatabase,
  members: readonly { userId: string; role: ConversationMemberRole }[],
): Promise<void> {
  const actual = await database.findAccountCommunicationRoles(
    members.map((member) => member.userId),
  );
  for (const member of members) {
    if (!roleAllowed(actual, member.userId, member.role)) {
      throw new CommunicationError(
        "MEMBER_ROLE_MISMATCH",
        "A participant role does not match that account.",
        400,
      );
    }
  }
}

function assertParentInclusive(members: readonly Pick<ConversationMemberRecord, "role">[]): void {
  if (hasUnsafeAdultChildMembership(members)) {
    throw new CommunicationError(
      "PARENT_REQUIRED",
      "A child-visible conversation requires a parent plus at least one additional participant.",
      409,
    );
  }
}

async function getConversationOrThrow(
  database: CommunicationDatabase,
  conversationId: string,
): Promise<ConversationSummary> {
  const conversation = await database.getConversationSummary(conversationId);
  if (!conversation) {
    throw new CommunicationError("CONVERSATION_NOT_FOUND", "Conversation was not found.", 404);
  }
  return conversation;
}

async function recordStaffAccess(
  database: CommunicationDatabase,
  actor: CommunicationActor,
  conversation: ConversationSummary,
  reasonInput: string | null | undefined,
): Promise<void> {
  let reason: string;
  try {
    reason = staffAccessReasonSchema.parse(reasonInput);
  } catch {
    authorizeStaffConversationAccess(actor, conversation.members, false);
    return;
  }
  authorizeStaffConversationAccess(actor, conversation.members, true);
  const now = new Date();
  await database.saveAdminAccessReason({
    id: ulid(),
    adminUserId: actor.userId,
    targetEntityType: "conversation",
    targetEntityId: conversation.id,
    reason,
    accessedAt: now,
  });
  await database.appendAudit({
    id: ulid(),
    actorUserId: actor.userId,
    action: "communication.message.access_as_staff",
    resourceType: "conversations",
    resourceId: conversation.id,
    reason,
    newValue: { accessedAt: now.toISOString() },
  });
}

/** The sole conversation creation path: verified account roles and parent inclusion are atomic. */
export async function createConversation(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  input: CreateConversationInput,
): Promise<ConversationSummary> {
  requireActor(actor);
  const values = createConversationSchema.parse(input);
  await requireVerifiedMemberRoles(database, values.members);
  const now = new Date();
  const conversationId = ulid();
  const members: ConversationMemberRecord[] = values.members.map((member) => ({
    id: ulid(),
    conversationId,
    userId: member.userId,
    role: member.role,
    joinedAt: now,
    leftAt: null,
    createdAt: now,
  }));
  assertParentInclusive(members);
  authorizeConversationAction(actor, "message.send", members);

  if (
    values.type === "parent_tutor" &&
    (!members.some((member) => member.role === "parent") ||
      !members.some((member) => member.role === "tutor"))
  ) {
    throw new CommunicationError(
      "INVALID_INPUT",
      "A parent-tutor conversation requires both a parent and a tutor.",
      400,
    );
  }

  const conversation: ConversationSummary = {
    id: conversationId,
    type: values.type,
    title: values.title,
    createdByUserId: actor.userId,
    isMonitored: true,
    members,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveConversation(conversation);
  return conversation;
}

export async function listConversations(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  input: { cursor?: string | null; limit?: number },
): Promise<ConversationPage> {
  requireActor(actor);
  const values = conversationListSchema.parse(input);
  const rows = await database.listConversationsForActor(
    actor.userId,
    isStaff(actor),
    values.cursor,
    values.limit + 1,
  );
  const hasNext = rows.length > values.limit;
  const items = hasNext ? rows.slice(0, values.limit) : rows;
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}

/**
 * Staff logging happens in the same transaction before message rows are fetched. Merely having an
 * admin role or knowing a conversation ID is never sufficient to read message content.
 */
export async function getConversationForActor(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  conversationId: string,
  input: { cursor?: string | null; limit?: number; staffReason?: string | null } = {},
): Promise<ConversationDetail> {
  requireActor(actor);
  const values = messageListSchema.parse({ cursor: input.cursor, limit: input.limit });
  return database.transaction(async (transaction) => {
    const conversation = await getConversationOrThrow(transaction, conversationId);
    assertParentInclusive(conversation.members);
    if (isStaff(actor)) {
      await recordStaffAccess(transaction, actor, conversation, input.staffReason);
    } else {
      authorizeConversationAction(actor, "message.read", conversation.members);
    }
    const rows = await transaction.listMessages(conversationId, values.cursor, values.limit + 1);
    const hasNext = rows.length > values.limit;
    const messages = hasNext ? rows.slice(0, values.limit) : rows;
    return {
      ...conversation,
      messages,
      nextMessageCursor: hasNext ? (messages.at(-1)?.id ?? null) : null,
    };
  });
}

/** Authorizes one live SSE connection and records one staff-access reason before streaming. */
export async function openConversationEventStream(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  conversationId: string,
  staffReason?: string | null,
): Promise<ConversationSummary> {
  requireActor(actor);
  return database.transaction(async (transaction) => {
    const conversation = await getConversationOrThrow(transaction, conversationId);
    assertParentInclusive(conversation.members);
    if (isStaff(actor)) await recordStaffAccess(transaction, actor, conversation, staffReason);
    else authorizeConversationAction(actor, "message.read", conversation.members);
    return conversation;
  });
}

export async function sendMessage(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  conversationId: string,
  input: SendMessageInput,
): Promise<MessageRecord> {
  requireActor(actor);
  const values = sendMessageSchema.parse(input);
  const conversation = await getConversationOrThrow(database, conversationId);
  assertParentInclusive(conversation.members);
  authorizeConversationAction(actor, "message.send", conversation.members);
  const now = new Date();
  const message: MessageRecord = {
    id: ulid(),
    conversationId,
    senderUserId: actor.userId,
    body: values.body,
    sentAt: now,
    editedAt: null,
    isRedacted: false,
    createdAt: now,
    attachments: [],
    reads: [],
  };
  await database.saveMessage(message);
  return message;
}

export async function markMessageRead(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  conversationId: string,
  input: { messageId: string },
): Promise<MessageReadRecord> {
  requireActor(actor);
  if (isStaff(actor)) {
    throw new CommunicationError(
      "FORBIDDEN",
      "Staff access is logged at conversation open; staff read receipts are not exposed.",
      403,
    );
  }
  const values = markReadSchema.parse(input);
  const [conversation, message] = await Promise.all([
    getConversationOrThrow(database, conversationId),
    database.getMessage(values.messageId),
  ]);
  if (!message || message.conversationId !== conversationId) {
    throw new CommunicationError("MESSAGE_NOT_FOUND", "Message was not found.", 404);
  }
  authorizeConversationAction(actor, "message.read", conversation.members);
  return database.saveRead({
    id: ulid(),
    messageId: message.id,
    userId: actor.userId,
    readAt: new Date(),
  });
}

export async function uploadMessageAttachment(
  database: CommunicationDatabase,
  storage: CommunicationStorage,
  actor: CommunicationActor | null | undefined,
  messageId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number },
  bytes: Uint8Array,
): Promise<MessageAttachmentRecord> {
  requireActor(actor);
  const message = await database.getMessageLocator(messageId);
  if (!message) throw new CommunicationError("MESSAGE_NOT_FOUND", "Message was not found.", 404);
  const conversation = await getConversationOrThrow(database, message.conversationId);
  authorizeConversationAction(actor, "message.send", conversation.members);
  if (message.senderUserId !== actor.userId) {
    throw new CommunicationError(
      "FORBIDDEN",
      "Attachments can only be added by the message sender.",
      403,
    );
  }

  let validated: ReturnType<typeof validateSubmissionUpload>;
  try {
    validated = validateSubmissionUpload(input, bytes);
  } catch (error) {
    if (isAssignmentError(error)) {
      throw new CommunicationError(
        error.code as "UPLOAD_NOT_ALLOWED" | "UPLOAD_TOO_LARGE" | "UPLOAD_SIGNATURE_INVALID",
        error.message.replace("assignments", "messages"),
        error.status,
      );
    }
    throw error;
  }
  const attachment: MessageAttachmentRecord = {
    id: ulid(),
    messageId,
    fileKey: `communication/${message.conversationId}/${messageId}/${ulid()}.${validated.extension}`,
    fileName: input.fileName.trim().slice(0, 255) || "message-attachment",
    mimeType: validated.mimeType,
    sizeBytes: validated.safeBytes.byteLength,
    virusScanStatus: "pending",
    createdAt: new Date(),
  };
  await storage.putPrivate({
    key: attachment.fileKey,
    body: validated.safeBytes,
    mimeType: attachment.mimeType,
    metadata: {
      messageAttachmentId: attachment.id,
      quarantine: "pending",
      originalName: attachment.fileName,
    },
  });
  await database.saveAttachment(attachment);
  return attachment;
}

export async function recordAttachmentScanResult(
  database: CommunicationDatabase,
  attachmentId: string,
  status: Exclude<VirusScanStatus, "pending">,
): Promise<void> {
  if (!(await database.getAttachment(attachmentId))) {
    throw new CommunicationError("ATTACHMENT_NOT_FOUND", "Attachment was not found.", 404);
  }
  await database.updateAttachmentScanStatus(attachmentId, status);
}

export async function getMessageAttachmentForActor(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  attachmentId: string,
  staffReason?: string | null,
): Promise<MessageAttachmentRecord> {
  requireActor(actor);
  return database.transaction(async (transaction) => {
    const attachment = await transaction.getAttachment(attachmentId);
    if (!attachment) {
      throw new CommunicationError("ATTACHMENT_NOT_FOUND", "Attachment was not found.", 404);
    }
    const message = await transaction.getMessageLocator(attachment.messageId);
    if (!message) throw new CommunicationError("MESSAGE_NOT_FOUND", "Message was not found.", 404);
    const conversation = await getConversationOrThrow(transaction, message.conversationId);
    if (isStaff(actor)) await recordStaffAccess(transaction, actor, conversation, staffReason);
    else authorizeConversationAction(actor, "message.read", conversation.members);
    if (attachment.virusScanStatus !== "clean") {
      throw new CommunicationError(
        "FILE_NOT_READY",
        "This attachment remains quarantined until malware scanning clears it.",
        409,
      );
    }
    return attachment;
  });
}

export async function reportMessage(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  input: ReportMessageInput,
): Promise<AbuseReportRecord> {
  requireActor(actor);
  if (isStaff(actor)) {
    throw new CommunicationError(
      "FORBIDDEN",
      "Staff moderation uses the audited incident workflow, not participant abuse reports.",
      403,
    );
  }
  const values = reportMessageSchema.parse(input);
  const message = await database.getMessageLocator(values.messageId);
  if (!message) throw new CommunicationError("MESSAGE_NOT_FOUND", "Message was not found.", 404);
  const conversation = await getConversationOrThrow(database, message.conversationId);
  authorizeConversationAction(actor, "message.read", conversation.members);
  const now = new Date();
  const report: AbuseReportRecord = {
    id: ulid(),
    reportedByUserId: actor.userId,
    targetType: "message",
    targetId: message.id,
    reason: values.reason,
    status: "open",
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveAbuseReport(report);
  return report;
}

/**
 * Message deletion is never a participant operation. Safety concerns use reportMessage; staff
 * content removal uses separately audited redaction, preserving the append-only message row.
 */
export async function deleteMessage(
  _database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  _messageId: string,
): Promise<never> {
  requireActor(actor);
  throw new CommunicationError(
    "MESSAGE_APPEND_ONLY",
    "Messages cannot be deleted. Report unsafe content for staff review.",
    405,
  );
}

export async function redactMessage(
  database: CommunicationDatabase,
  actor: CommunicationActor | null | undefined,
  messageId: string,
  reasonInput: string,
): Promise<void> {
  requireActor(actor);
  if (!isStaff(actor)) throw new CommunicationError("FORBIDDEN", "Staff access is required.", 403);
  const reason = staffAccessReasonSchema.parse(reasonInput);
  const locator = await database.getMessageLocator(messageId);
  if (!locator) throw new CommunicationError("MESSAGE_NOT_FOUND", "Message was not found.", 404);
  await database.transaction(async (transaction) => {
    const conversation = await getConversationOrThrow(transaction, locator.conversationId);
    await recordStaffAccess(transaction, actor, conversation, reason);
    const message = await transaction.getMessage(messageId);
    if (!message) throw new CommunicationError("MESSAGE_NOT_FOUND", "Message was not found.", 404);
    await transaction.redactMessage(messageId);
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "communication.message.redacted",
      resourceType: "messages",
      resourceId: messageId,
      reason,
      previousValue: { isRedacted: message.isRedacted, body: message.body },
      newValue: { isRedacted: true },
    });
  });
}
