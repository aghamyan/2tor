import type { Database } from "@app/db";
import {
  configureNotifications,
  createNotificationDispatcher,
  createWorkerNotificationQueue,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationRecipient,
  type NotificationRepository,
} from "@app/notifications";

import { getQueue } from "../../queue";
import {
  listRecipientNotificationPreferences,
  resolveRecipientAccountInfo,
} from "../../../../../packages/domain/scheduling/notification-recipients";

/** `notification_channel` (DB enum) uses different labels than `@app/notifications`'s `NotificationChannel`. */
function mapChannel(channel: "email" | "web_push" | "in_app"): NotificationChannel {
  if (channel === "web_push") return "push";
  if (channel === "in_app") return "inbox";
  return "email";
}

/**
 * A scheduling-scoped `NotificationRepository`. No shared composition root configures
 * `@app/notifications` anywhere in this repo yet (see README, "Known limitations") — every job
 * that wants to call `notify()` today has to wire its own, and this directory's `*.job.ts` files
 * are the only files this slice is allowed to touch that can do so (apps/worker/src/index.ts and
 * packages/notifications are out of scope). The actual DB queries live in
 * packages/domain/scheduling/notification-recipients.ts (drizzle-orm isn't a direct dependency of
 * apps/worker, only of packages/domain) — this file just maps that plain data into
 * `@app/notifications`'s shapes. Moving this to a real shared composition root, once one exists,
 * is a drop-in replacement — `notify()`'s call sites don't change.
 */
function createSchedulingNotificationRepository(database: Database): NotificationRepository {
  return {
    async getRecipient(userId): Promise<NotificationRecipient | undefined> {
      const account = await resolveRecipientAccountInfo(database, userId);
      if (!account) return undefined;
      return {
        locale: account.locale,
        accountKind: account.accountKind,
        email: account.email ?? undefined,
        // No web-push-subscription table exists in packages/db yet, so push is always skipped by
        // the dispatcher (empty subscription list) until one is added — email and in-app inbox
        // still work.
        pushSubscriptions: [],
      };
    },

    async getPreferences(userId): Promise<readonly NotificationPreference[]> {
      const rows = await listRecipientNotificationPreferences(database, userId);
      return rows.map((row) => ({
        category: row.category,
        channel: mapChannel(row.channel),
        isEnabled: row.isEnabled,
      }));
    },
  };
}

let configured = false;

/** Idempotent — safe to call at the top of every job handler in this directory. */
export function ensureSchedulingNotificationsConfigured(database: Database): void {
  if (configured) return;
  configured = true;
  configureNotifications(
    createNotificationDispatcher(
      createSchedulingNotificationRepository(database),
      createWorkerNotificationQueue(getQueue("notifications")),
    ),
  );
}
