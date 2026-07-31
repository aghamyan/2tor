import type { CommunicationDatabase, RetentionCandidate } from "./models";
import type { CommunicationStorage } from "./storage";

export const ORDINARY_MESSAGE_RETENTION_YEARS = 2;

export function ordinaryMessageRetentionCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - ORDINARY_MESSAGE_RETENTION_YEARS);
  return cutoff;
}

/** Exposed query for audit previews; reported/incident-linked messages are excluded by the adapter. */
export function listOrdinaryMessagesEligibleForRetention(
  database: CommunicationDatabase,
  input: { now?: Date; limit?: number } = {},
): Promise<RetentionCandidate[]> {
  const limit = Math.max(1, Math.min(1_000, input.limit ?? 250));
  return database.listMessagesEligibleForRetention(
    ordinaryMessageRetentionCutoff(input.now),
    limit,
  );
}

/**
 * System-only retention executor. Private objects are removed before their database rows; safety
 * reports, incident-linked messages, and their attachments never enter the candidate set.
 */
export async function enforceOrdinaryMessageRetention(
  database: CommunicationDatabase,
  storage: CommunicationStorage,
  input: { now?: Date; limit?: number } = {},
): Promise<{ deletedMessages: number; deletedFiles: number }> {
  const candidates = await listOrdinaryMessagesEligibleForRetention(database, input);
  const keys = candidates.flatMap((candidate) => candidate.attachmentFileKeys);
  for (const key of keys) await storage.deletePrivate(key);
  const deletedMessages = await database.deleteMessagesForRetention(
    candidates.map((candidate) => candidate.messageId),
  );
  return { deletedMessages, deletedFiles: keys.length };
}
