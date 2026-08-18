import { ulid } from "ulid";
import { requireActor } from "./capabilities";
import type {
  DiscussionActor,
  DiscussionDatabase,
  DiscussionNotificationRecord,
  DiscussionNotificationType,
} from "./models";

/**
 * Module-owned notification log — not routed through `@app/notifications`, whose `NotificationType`
 * union is closed and shared across every module (see `README.md`'s "Notifications" section for the
 * tradeoff this documents). Surfaced today inside MathOverflow's own "My activity" view; a
 * follow-up could additionally bridge the mandatory subset into `@app/notifications` once that
 * package's enum is extended by its owning team.
 */
export async function createNotification(
  database: DiscussionDatabase,
  input: {
    recipientId: string;
    actorId: string | null;
    type: DiscussionNotificationType;
    questionId?: string | null;
    answerId?: string | null;
    ratingId?: string | null;
  },
): Promise<void> {
  if (input.recipientId === input.actorId) return;
  const notification: DiscussionNotificationRecord = {
    id: ulid(),
    recipientId: input.recipientId,
    actorId: input.actorId ?? null,
    type: input.type,
    questionId: input.questionId ?? null,
    answerId: input.answerId ?? null,
    ratingId: input.ratingId ?? null,
    readAt: null,
    createdAt: new Date(),
  };
  await database.saveNotification(notification);
}

export async function listNotificationsForActor(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  options?: { unreadOnly?: boolean; limit?: number },
): Promise<DiscussionNotificationRecord[]> {
  requireActor(actor);
  return database.listNotifications(actor.userId, options);
}

export async function markNotificationRead(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
  notificationId: string,
): Promise<void> {
  requireActor(actor);
  await database.markNotificationRead(notificationId, actor.userId);
}

export async function countUnreadNotifications(
  database: DiscussionDatabase,
  actor: DiscussionActor | null | undefined,
): Promise<number> {
  requireActor(actor);
  return database.countUnreadNotifications(actor.userId);
}
