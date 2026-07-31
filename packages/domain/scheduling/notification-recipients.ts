import { notificationPreferences, studentProfiles, users, type Database } from "@app/db";
import { eq } from "drizzle-orm";

/**
 * Plain DB-shaped lookups backing the reminder job's `NotificationRepository` (see
 * apps/worker/src/jobs/scheduling/_notifications.ts). Deliberately returns plain data, not
 * `@app/notifications` types — this package has no dependency on `@app/notifications` (see
 * services.ts's module-boundary discipline in README.md), so the mapping into that package's
 * `NotificationRecipient`/`NotificationPreference` shapes happens in apps/worker, the one place
 * that actually declares `@app/notifications` as a dependency.
 */

export interface RecipientAccountInfo {
  locale: "en" | "hy";
  accountKind: "adult" | "child";
  email: string | null;
}

export interface RawNotificationPreference {
  category: string;
  channel: "email" | "web_push" | "in_app";
  isEnabled: boolean;
}

export async function resolveRecipientAccountInfo(
  database: Database,
  userId: string,
): Promise<RecipientAccountInfo | null> {
  const [account] = await database
    .select({ email: users.email, locale: users.locale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!account) return null;

  const [studentProfile] = await database
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1);

  return {
    locale: account.locale,
    accountKind: studentProfile ? "child" : "adult",
    email: account.email,
  };
}

export async function listRecipientNotificationPreferences(
  database: Database,
  userId: string,
): Promise<RawNotificationPreference[]> {
  return database
    .select({
      category: notificationPreferences.category,
      channel: notificationPreferences.channel,
      isEnabled: notificationPreferences.isEnabled,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
}
