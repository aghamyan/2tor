import { createDb } from "@app/db";

/**
 * Server-only DB reads for shell chrome (user identity, unread notification count). Mirrors
 * `app/api/auth/login/route.ts`'s `database()` singleton + relational-query-API pattern rather
 * than importing `drizzle-orm`'s `count`/`eq`/`and` directly — `drizzle-orm` doesn't resolve from
 * `apps/web` (pnpm workspace isolation; confirmed empirically, same constraint documented in
 * `packages/auth/src/session.ts`'s `RedisLike` comment), so the `where` callback's injected
 * operators are the only way to filter without a direct dependency.
 *
 * This file imports `@app/db` (Node `postgres` client) and must only ever be imported from a
 * server component. Importing it from a "use client" file would pull those into the client
 * bundle and hard-error at build time (see `app/providers.tsx`'s note on the same class of bug
 * for `node:fs/promises`) — `primaryRole()` (no DB dependency) lives in the separate
 * `./nav-roles.ts` for exactly this reason.
 */

let databaseSingleton: ReturnType<typeof createDb> | undefined;

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the app shell.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}

export interface ShellUserIdentity {
  email: string | null;
  username: string | null;
}

/**
 * No `name`/`displayName` column exists on `users` (see `packages/db/src/schema/identity.ts`) —
 * only email/username. A friendlier name lives on family/tutor profile records instead, but those
 * belong to `packages/domain/families` and `packages/domain/tutors`; reaching into either from
 * shell chrome would cross a module boundary `docs/CONVENTIONS.md` reserves for the owning module.
 * Falling back to email/username (already visible to the account owner) keeps this self-contained.
 */
export async function shellUserIdentity(userId: string): Promise<ShellUserIdentity> {
  const user = await database().query.users.findFirst({
    columns: { email: true, username: true },
    where: (table, { eq }) => eq(table.id, userId),
  });
  return { email: user?.email ?? null, username: user?.username ?? null };
}

/**
 * `@app/notifications` (`packages/notifications`) exposes dispatch/inbox helpers but no read
 * query — it's DB-agnostic by design (see its `NotificationRepository`/`NotificationDispatcher`
 * types), so counting unread rows is the consuming app's own read, same as this file's identity
 * query. The worker's `notifications.create-inbox` job (`apps/worker/src/jobs/notifications/
 * create-inbox.job.ts`) writes `channel: "in_app"`, `readAt: null`; nothing in this codebase marks
 * a row read yet (no follow-up route exists), so this only ever counts down once that ships.
 */
export async function unreadNotificationCount(userId: string): Promise<number> {
  const rows = await database().query.notifications.findMany({
    columns: { id: true },
    where: (table, { and, eq, isNull }) =>
      and(eq(table.userId, userId), eq(table.channel, "in_app"), isNull(table.readAt)),
  });
  return rows.length;
}
