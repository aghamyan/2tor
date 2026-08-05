import { boolean, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { lessons } from "./scheduling";

/**
 * WhatsApp domain: the per-student WhatsApp group (Meta Business Platform Groups API — real
 * groups, not a simulated fan-out; see packages/domain/whatsapp/README.md), its membership, and
 * per-lesson notification bookkeeping for the two outbound sweep jobs
 * (apps/worker/src/jobs/whatsapp). Deliberately separate from `operations.notification_channel`/
 * `notification_preferences` — WhatsApp is business-initiated and template-constrained outside a
 * 24h service window, structurally unlike `@app/notifications`'s free-form email/push/inbox
 * render, so it gets its own preference row and send path instead of a fourth channel value.
 */

export const whatsappGroupStatusEnum = pgEnum("whatsapp_group_status", [
  "not_provisioned",
  "active",
  "disabled",
]);
export const whatsappGroupMemberRoleEnum = pgEnum("whatsapp_group_member_role", [
  "tutor",
  "parent",
  "student",
]);
export const whatsappGroupMemberStatusEnum = pgEnum("whatsapp_group_member_status", [
  "invited",
  "joined",
  "removed",
]);

/**
 * One row per student. `status` reflects only whether the group itself has been created with
 * Meta — never a separate "provisioning" state, since group creation and a given member actually
 * tapping their invite link are different concerns (the latter is `whatsappGroupMembers.status`).
 * A parent-configured setting (`reminderLeadMinutes`, `isEnabled`, `includeChild`) is folded into
 * the same row rather than a separate preferences table since both are 1:1 with the student.
 */
export const whatsappGroups = pgTable("whatsapp_groups", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .unique()
    .references(() => studentProfiles.id, { onDelete: "cascade" }),
  status: whatsappGroupStatusEnum("status").notNull().default("not_provisioned"),
  /** Meta's group id. Null until `createGroup` succeeds. */
  providerGroupId: text("provider_group_id"),
  /** `https://chat.whatsapp.com/...` — sent to each invited member; not itself sufficient to join them. */
  inviteLink: text("invite_link"),
  /** Parent-selected lead time for the pre-lesson reminder. */
  reminderLeadMinutes: integer("reminder_lead_minutes").notNull().default(60),
  /** Opt-in: no group is provisioned and no messages are sent until a parent enables this. */
  isEnabled: boolean("is_enabled").notNull().default(false),
  /** Separately opted-in and consent-gated (see services.ts) — the child's own number is never added by default. */
  includeChild: boolean("include_child").notNull().default(false),
  updatedByUserId: ulidFk("updated_by_user_id").references(() => users.id),
  ...timestamps,
});

/**
 * Roster of who has been invited (or removed). A student can have more than one active tutor
 * assignment, so this is kept in sync by `syncGroupMembership` on demand, not populated once at
 * group-creation time.
 */
export const whatsappGroupMembers = pgTable(
  "whatsapp_group_members",
  {
    id: ulidPk(),
    whatsappGroupId: ulidFk("whatsapp_group_id")
      .notNull()
      .references(() => whatsappGroups.id, { onDelete: "cascade" }),
    userId: ulidFk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: whatsappGroupMemberRoleEnum("role").notNull(),
    /** Snapshotted at invite time — a later phone-number change doesn't retroactively edit this row. */
    phoneNumber: text("phone_number").notNull(),
    /**
     * `"joined"` is never set by anything in this phase — that requires the phase-2 inbound
     * webhook (`group_participants_update`). The column exists now so phase 2 is additive.
     */
    status: whatsappGroupMemberStatusEnum("status").notNull().default("invited"),
    invitedAt: utcTimestamp("invited_at").notNull().defaultNow(),
    joinedAt: utcTimestamp("joined_at"),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("whatsapp_group_members_unique").on(table.whatsappGroupId, table.userId),
  ],
);

/**
 * Idempotency bookkeeping for the two sweep jobs, keyed per lesson rather than relying solely on
 * BullMQ's per-invocation idempotency key — a poll/sweep job re-scans the same lesson on every
 * tick until its window passes, so "already sent for this lesson" has to be remembered here.
 */
export const whatsappLessonNotifications = pgTable("whatsapp_lesson_notifications", {
  id: ulidPk(),
  lessonId: ulidFk("lesson_id")
    .notNull()
    .unique()
    .references(() => lessons.id, { onDelete: "cascade" }),
  reminderSentAt: utcTimestamp("reminder_sent_at"),
  /** Fires once `scheduledEndAt` passes, regardless of `lesson_feedback.status` — see README. */
  classEndedSentAt: utcTimestamp("class_ended_sent_at"),
  createdAt: timestamps.createdAt,
});
