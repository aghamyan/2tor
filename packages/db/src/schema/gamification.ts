import { integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { subjects } from "./academic";

/**
 * Gamification domain: points, levels, badges, streaks, and challenges (spec §7 "no more boring
 * lessons"). Parents can disable optional competition/gamification features per spec §4.1 — that
 * toggle lives in `notification_preferences`/app settings, not here.
 */

export const pointEventReasonEnum = pgEnum("point_event_reason", [
  "assignment_completed",
  "milestone_achieved",
  "streak",
  "challenge",
  "manual_adjustment",
  "other",
]);
export const streakTypeEnum = pgEnum("streak_type", [
  "attendance",
  "assignment_completion",
  "login",
]);
export const challengeStatusEnum = pgEnum("challenge_status", [
  "upcoming",
  "active",
  "completed",
  "cancelled",
]);

/** Append-only ledger. `student_point_balances.total_points` is a maintained rollup of this table. */
export const pointEvents = pgTable("point_events", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  points: integer("points").notNull(),
  reason: pointEventReasonEnum("reason").notNull(),
  referenceId: text("reference_id"),
  createdByUserId: ulidFk("created_by_user_id").references(() => users.id),
  createdAt: timestamps.createdAt,
});

export const levels = pgTable("levels", {
  id: ulidPk(),
  levelNumber: integer("level_number").notNull().unique(),
  name: text("name").notNull(),
  minPoints: integer("min_points").notNull(),
  createdAt: timestamps.createdAt,
});

export const studentPointBalances = pgTable("student_point_balances", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .unique()
    .references(() => studentProfiles.id, { onDelete: "cascade" }),
  totalPoints: integer("total_points").notNull().default(0),
  currentLevelId: ulidFk("current_level_id").references(() => levels.id, { onDelete: "restrict" }),
  updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
});

export const badges = pgTable("badges", {
  id: ulidPk(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  iconKey: text("icon_key"),
  createdAt: timestamps.createdAt,
});

export const studentBadges = pgTable(
  "student_badges",
  {
    id: ulidPk(),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    badgeId: ulidFk("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "restrict" }),
    awardedAt: utcTimestamp("awarded_at").notNull().defaultNow(),
    awardedByUserId: ulidFk("awarded_by_user_id").references(() => users.id),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("student_badges_unique").on(table.studentProfileId, table.badgeId)],
);

export const streaks = pgTable(
  "streaks",
  {
    id: ulidPk(),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    type: streakTypeEnum("type").notNull(),
    currentCount: integer("current_count").notNull().default(0),
    longestCount: integer("longest_count").notNull().default(0),
    lastIncrementedAt: utcTimestamp("last_incremented_at"),
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("streaks_unique").on(table.studentProfileId, table.type)],
);

export const challenges = pgTable("challenges", {
  id: ulidPk(),
  title: text("title").notNull(),
  description: text("description"),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  startAt: utcTimestamp("start_at").notNull(),
  endAt: utcTimestamp("end_at").notNull(),
  status: challengeStatusEnum("status").notNull().default("upcoming"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
});

export const challengeParticipants = pgTable(
  "challenge_participants",
  {
    id: ulidPk(),
    challengeId: ulidFk("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    studentProfileId: ulidFk("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    score: integer("score").notNull().default(0),
    rank: integer("rank"),
    joinedAt: utcTimestamp("joined_at").notNull().defaultNow(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("challenge_participants_unique").on(table.challengeId, table.studentProfileId),
  ],
);
