import { boolean, index, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ianaTimezone, timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";

/**
 * Identity domain: authentication accounts, role assignment, sessions, MFA, and auth audit
 * trails (login attempts, password resets). Every other domain hangs off `users` for "who did
 * this" / "who does this belong to."
 */

export const userStatusEnum = pgEnum("user_status", ["pending", "active", "suspended", "deleted"]);
export const localeEnum = pgEnum("locale", ["en", "hy"]);
export const mfaMethodTypeEnum = pgEnum("mfa_method_type", ["totp", "webauthn", "recovery_code"]);
export const mfaStatusEnum = pgEnum("mfa_status", ["pending", "active", "disabled"]);

/**
 * A person, not a role. Parents/tutors/admins log in with email; students (who "cannot create an
 * account independently," spec §4.2) log in via a username provisioned by a parent/admin — so
 * exactly one of `email`/`username` is required in practice, enforced at the app boundary, not
 * here. `phone` and any exact-DOB-adjacent fields elsewhere are field-level encrypted per spec
 * §12.3; this column stores ciphertext, not plaintext.
 */
export const users = pgTable(
  "users",
  {
    id: ulidPk(),
    email: text("email").unique(),
    username: text("username").unique(),
    passwordHash: text("password_hash"),
    status: userStatusEnum("status").notNull().default("pending"),
    primaryTimezone: ianaTimezone("primary_timezone").notNull(),
    locale: localeEnum("locale").notNull().default("en"),
    emailVerifiedAt: utcTimestamp("email_verified_at"),
    phoneVerifiedAt: utcTimestamp("phone_verified_at"),
    lastLoginAt: utcTimestamp("last_login_at"),
    /** Soft-delete flag only — NOT the privacy deletion mechanism. See `deletion_jobs` (operations domain). */
    deletedAt: utcTimestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [index("users_status_idx").on(table.status)],
);

/** Dynamic role catalog (super-admin can "configure roles and permissions", spec §4.6) — not a fixed enum. */
export const roles = pgTable("roles", {
  id: ulidPk(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamps.createdAt,
});

/** Many-to-many user↔role assignment. A revoked grant is kept for history, not deleted. */
export const userRoles = pgTable(
  "user_roles",
  {
    id: ulidPk(),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: ulidFk("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    grantedAt: utcTimestamp("granted_at").notNull().defaultNow(),
    grantedByUserId: ulidFk("granted_by_user_id").references(() => users.id),
    revokedAt: utcTimestamp("revoked_at"),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("user_roles_active_unique")
      .on(table.userId, table.roleId)
      .where(sql`${table.revokedAt} is null`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: ulidPk(),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: utcTimestamp("expires_at").notNull(),
    revokedAt: utcTimestamp("revoked_at"),
    lastSeenAt: utcTimestamp("last_seen_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

/** `secretReference` holds a KMS-wrapped secret or reference, never a plaintext TOTP seed. */
export const mfaMethods = pgTable(
  "mfa_methods",
  {
    id: ulidPk(),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: mfaMethodTypeEnum("type").notNull(),
    status: mfaStatusEnum("status").notNull().default("pending"),
    secretReference: text("secret_reference"),
    verifiedAt: utcTimestamp("verified_at"),
    lastUsedAt: utcTimestamp("last_used_at"),
    ...timestamps,
  },
  (table) => [index("mfa_methods_user_id_idx").on(table.userId)],
);

/** Append-only login attempt log (spec §12.5: "log login and failed login"). */
export const loginEvents = pgTable(
  "login_events",
  {
    id: ulidPk(),
    userId: ulidFk("user_id").references(() => users.id),
    emailAttempted: text("email_attempted"),
    success: boolean("success").notNull(),
    failureReason: text("failure_reason"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("login_events_user_id_idx").on(table.userId)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: ulidPk(),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    usedAt: utcTimestamp("used_at"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("password_reset_tokens_user_id_idx").on(table.userId)],
);
