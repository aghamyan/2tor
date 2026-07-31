import type { NotificationType } from "./templates";

export const INBOX_RETENTION_DAYS = 365;

export type InboxNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntity?: { type: string; id: string; enduring: boolean };
  createdAt?: Date;
};

/** Enduring records (for example, a receipt) retain their attached notification indefinitely. */
export function inboxExpiresAt(notification: InboxNotification): Date | undefined {
  if (notification.relatedEntity?.enduring) return undefined;
  const createdAt = notification.createdAt ?? new Date();
  return new Date(createdAt.getTime() + INBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function isInboxNotificationExpired(
  notification: InboxNotification,
  now = new Date(),
): boolean {
  const expiresAt = inboxExpiresAt(notification);
  return expiresAt !== undefined && expiresAt <= now;
}
