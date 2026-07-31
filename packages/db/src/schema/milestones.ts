import { date, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { studentProfiles } from "./families";
import { subjects, learningPlans } from "./academic";

/** Milestones domain: longer-horizon progress markers (spec §6.4) and the rewards tied to them. */

export const milestoneCategoryEnum = pgEnum("milestone_category", [
  "academic_mastery",
  "assignment_consistency",
  "attendance_consistency",
  "independent_problem_solving",
  "project_completion",
  "communication_presentation",
  "exam_readiness",
  "armenian_reading",
  "armenian_speaking",
  "programming_project",
  "personal_confidence",
  "other",
]);
export const milestoneStatusEnum = pgEnum("milestone_status", [
  "not_started",
  "in_progress",
  "at_risk",
  "completed",
  "abandoned",
]);
export const milestoneEvidenceTypeEnum = pgEnum("milestone_evidence_type", [
  "assignment_result",
  "project_rubric",
  "tutor_observation",
  "assessment",
  "file",
]);
export const rewardTypeEnum = pgEnum("reward_type", ["badge", "points", "certificate", "custom"]);

/** Completion normally requires evidence (spec §6.4) — see `milestone_evidence`, not a hard DB constraint. */
export const milestones = pgTable("milestones", {
  id: ulidPk(),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  learningPlanId: ulidFk("learning_plan_id").references(() => learningPlans.id, {
    onDelete: "restrict",
  }),
  category: milestoneCategoryEnum("category").notNull(),
  objective: text("objective").notNull(),
  baseline: text("baseline"),
  target: text("target").notNull(),
  targetDate: date("target_date"),
  progressPercentage: integer("progress_percentage").notNull().default(0),
  status: milestoneStatusEnum("status").notNull().default("not_started"),
  parentVisibleStatus: text("parent_visible_status"),
  completedAt: utcTimestamp("completed_at"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
});

export const milestoneUpdates = pgTable("milestone_updates", {
  id: ulidPk(),
  milestoneId: ulidFk("milestone_id")
    .notNull()
    .references(() => milestones.id, { onDelete: "cascade" }),
  authorUserId: ulidFk("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  progressPercentage: integer("progress_percentage"),
  note: text("note").notNull(),
  createdAt: timestamps.createdAt,
});

/** `referenceId` is a loose pointer into whichever table `evidenceType` names — no DB FK, since the target table varies. */
export const milestoneEvidence = pgTable("milestone_evidence", {
  id: ulidPk(),
  milestoneId: ulidFk("milestone_id")
    .notNull()
    .references(() => milestones.id, { onDelete: "cascade" }),
  evidenceType: milestoneEvidenceTypeEnum("evidence_type").notNull(),
  referenceId: text("reference_id"),
  fileKey: text("file_key"),
  description: text("description"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamps.createdAt,
});

export const rewards = pgTable("rewards", {
  id: ulidPk(),
  milestoneId: ulidFk("milestone_id").references(() => milestones.id, { onDelete: "restrict" }),
  studentProfileId: ulidFk("student_profile_id")
    .notNull()
    .references(() => studentProfiles.id, { onDelete: "restrict" }),
  type: rewardTypeEnum("type").notNull(),
  description: text("description").notNull(),
  grantedAt: utcTimestamp("granted_at"),
  grantedByUserId: ulidFk("granted_by_user_id").references(() => users.id),
  createdAt: timestamps.createdAt,
});
