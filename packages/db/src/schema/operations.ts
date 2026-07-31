import { boolean, integer, jsonb, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { privacyRequests } from "./families";

/**
 * Operations domain: notifications, support, incidents, and the compliance backbone — admin
 * access reasons, the append-only audit log, data exports, and deletion jobs. `audit_events` has
 * no `updatedAt`/soft-delete column and is never mutated by the app layer; its immutability is
 * additionally enforced by a `BEFORE UPDATE OR DELETE` trigger added in a hand-written migration
 * (see `packages/db/migrations`), because a schema-only constraint can't stop an `UPDATE`.
 */

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "web_push",
  "in_app",
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
  "read",
]);
export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
]);
export const supportPriorityEnum = pgEnum("support_priority", ["low", "normal", "high", "urgent"]);
export const incidentSeverityEnum = pgEnum("incident_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "investigating",
  "resolved",
  "closed",
]);
export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const deletionScopeEnum = pgEnum("deletion_scope", ["full_erase", "anonymize"]);
export const deletionJobStatusEnum = pgEnum("deletion_job_status", [
  "scheduled",
  "running",
  "completed",
  "failed",
  "blocked",
]);

export const notifications = pgTable("notifications", {
  id: ulidPk(),
  userId: ulidFk("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channel: notificationChannelEnum("channel").notNull(),
  category: text("category").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  status: notificationStatusEnum("status").notNull().default("pending"),
  sentAt: utcTimestamp("sent_at"),
  readAt: utcTimestamp("read_at"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  createdAt: timestamps.createdAt,
});

/**
 * Per-category/channel opt-out. Mandatory categories (schedule/safety/account) simply have no
 * enabled=false effect at the app layer for child accounts — enforced in `@app/domain`, not here.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: ulidPk(),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_preferences_unique").on(table.userId, table.category, table.channel),
  ],
);

export const supportTickets = pgTable("support_tickets", {
  id: ulidPk(),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: supportTicketStatusEnum("status").notNull().default("open"),
  priority: supportPriorityEnum("priority").notNull().default("normal"),
  assignedToUserId: ulidFk("assigned_to_user_id").references(() => users.id),
  ...timestamps,
});

export const supportComments = pgTable("support_comments", {
  id: ulidPk(),
  ticketId: ulidFk("ticket_id")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),
  authorUserId: ulidFk("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamps.createdAt,
});

export const incidents = pgTable("incidents", {
  id: ulidPk(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: incidentSeverityEnum("severity").notNull(),
  status: incidentStatusEnum("status").notNull().default("open"),
  reportedByUserId: ulidFk("reported_by_user_id").references(() => users.id),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  ...timestamps,
});

export const incidentActions = pgTable("incident_actions", {
  id: ulidPk(),
  incidentId: ulidFk("incident_id")
    .notNull()
    .references(() => incidents.id, { onDelete: "cascade" }),
  actionTakenByUserId: ulidFk("action_taken_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  notes: text("notes"),
  createdAt: timestamps.createdAt,
});

/** Logs every staff message/record access performed "for a valid operational or safety reason" (spec §4.5). */
export const adminAccessReasons = pgTable("admin_access_reasons", {
  id: ulidPk(),
  adminUserId: ulidFk("admin_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: text("target_entity_id").notNull(),
  reason: text("reason").notNull(),
  accessedAt: utcTimestamp("accessed_at").notNull().defaultNow(),
  createdAt: timestamps.createdAt,
});

/** Append-only. No `updatedAt`. See module docstring — mutation is additionally blocked by a DB trigger. */
export const auditEvents = pgTable("audit_events", {
  id: ulidPk(),
  actorUserId: ulidFk("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  reason: text("reason"),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  ipAddress: text("ip_address"),
  createdAt: timestamps.createdAt,
});

export const exports = pgTable("exports", {
  id: ulidPk(),
  requestedByUserId: ulidFk("requested_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  filters: jsonb("filters"),
  status: exportStatusEnum("status").notNull().default("pending"),
  fileKey: text("file_key"),
  expiresAt: utcTimestamp("expires_at"),
  /** High-risk exports require second-person approval (spec §16.4). */
  approvedByUserId: ulidFk("approved_by_user_id").references(() => users.id),
  ...timestamps,
});

/** Executes `privacy_requests` (deletion type) or standalone retention-policy erasure/anonymization. */
export const deletionJobs = pgTable("deletion_jobs", {
  id: ulidPk(),
  privacyRequestId: ulidFk("privacy_request_id").references(() => privacyRequests.id, {
    onDelete: "restrict",
  }),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: text("target_entity_id").notNull(),
  scope: deletionScopeEnum("scope").notNull(),
  status: deletionJobStatusEnum("status").notNull().default("scheduled"),
  scheduledFor: utcTimestamp("scheduled_for"),
  completedAt: utcTimestamp("completed_at"),
  blockReason: text("block_reason"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
});

export const featureFlags = pgTable("feature_flags", {
  id: ulidPk(),
  key: text("key").notNull().unique(),
  description: text("description"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  rolloutPercentage: integer("rollout_percentage").notNull().default(0),
  ...timestamps,
});

export const systemSettings = pgTable("system_settings", {
  id: ulidPk(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedByUserId: ulidFk("updated_by_user_id").references(() => users.id),
  updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
});
