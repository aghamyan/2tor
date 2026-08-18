import { ulid } from "ulid";
import { AcademicError } from "./errors";
import type {
  AcademicActor,
  AcademicDatabase,
  CourseRecord,
  CurriculumUnitRecord,
  LearningPlanSnapshot,
  ParentVisibleFeedback,
  SkillAssessmentEventRecord,
  SkillRecord,
  SkillTrend,
  StudentSkillRecord,
} from "./models";
import {
  createCustomSkillSchema,
  createLearningPlanSchema,
  lessonFeedbackSchema,
  milestoneEvidenceSchema,
  milestoneSchema,
  progressReviewSchema,
  recordSkillAssessmentsSchema,
  reviseLearningPlanSchema,
  type CreateCustomSkillInput,
  type CreateLearningPlanInput,
  type LessonFeedbackInput,
  type MilestoneEvidenceInput,
  type MilestoneInput,
  type ProgressReviewInput,
  type RecordSkillAssessmentsInput,
  type ReviseLearningPlanInput,
} from "./schemas";

function hasRole(actor: AcademicActor, ...roles: AcademicActor["roles"][number][]) {
  return roles.some((role) => actor.roles.includes(role));
}
function requireActor(actor: AcademicActor | null | undefined): asserts actor is AcademicActor {
  if (!actor) throw new AcademicError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}
function requireStaffOrTutor(actor: AcademicActor) {
  if (!hasRole(actor, "tutor", "administrator", "super_administrator"))
    throw new AcademicError("FORBIDDEN", "Only teaching staff can make this change.", 403);
}

/** A major revision is deliberately narrow: main goal change or removal of any exam goal. */
export function isMajorPlanChange(
  previous: LearningPlanSnapshot,
  next: LearningPlanSnapshot,
): boolean {
  if (previous.mainGoal.trim() !== next.mainGoal.trim()) return true;
  const nextExamGoals = new Set(
    next.items
      .filter((item) => item.isExamGoal)
      .map((item) => item.title.trim().toLocaleLowerCase()),
  );
  return previous.items
    .filter((item) => item.isExamGoal)
    .some((item) => !nextExamGoals.has(item.title.trim().toLocaleLowerCase()));
}

export async function createLearningPlan(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  input: CreateLearningPlanInput,
) {
  requireActor(actor);
  requireStaffOrTutor(actor);
  const values = createLearningPlanSchema.parse(input);
  const timestamp = new Date();
  const id = ulid();
  const plan = {
    id,
    studentProfileId: values.studentProfileId,
    subjectId: values.subjectId,
    authorUserId: actor.userId,
    activeSnapshot: values.snapshot,
    activeVersionNumber: 1,
    parentApprovalStatus: "not_required" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const version = {
    id: ulid(),
    learningPlanId: id,
    versionNumber: 1,
    snapshot: values.snapshot,
    changeSummary: "Initial learning plan.",
    isMajorChange: false,
    effective: true,
    createdByUserId: actor.userId,
    createdAt: timestamp,
    acknowledgedByUserId: null,
    acknowledgedAt: null,
  };
  await database.transaction(async (tx) => {
    await tx.saveLearningPlan(plan);
    await tx.savePlanVersion(version);
  });
  return plan;
}

export async function reviseLearningPlan(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  planId: string,
  input: ReviseLearningPlanInput,
) {
  requireActor(actor);
  requireStaffOrTutor(actor);
  const values = reviseLearningPlanSchema.parse(input);
  return database.transaction(async (tx) => {
    const plan = await tx.getLearningPlan(planId);
    if (!plan) throw new AcademicError("PLAN_NOT_FOUND", "Learning plan was not found.", 404);
    if (plan.parentApprovalStatus === "pending") {
      throw new AcademicError(
        "ACKNOWLEDGMENT_REQUIRED",
        "A pending major change must be acknowledged before another revision.",
        409,
      );
    }
    const versionNumber = plan.activeVersionNumber + 1;
    const major = isMajorPlanChange(plan.activeSnapshot, values.snapshot);
    const timestamp = new Date();
    const version = {
      id: ulid(),
      learningPlanId: planId,
      versionNumber,
      snapshot: values.snapshot,
      changeSummary: values.changeSummary,
      isMajorChange: major,
      effective: !major,
      createdByUserId: actor.userId,
      createdAt: timestamp,
      acknowledgedByUserId: null,
      acknowledgedAt: null,
    };
    await tx.savePlanVersion(version);
    if (major) {
      await tx.saveLearningPlan({ ...plan, parentApprovalStatus: "pending", updatedAt: timestamp });
      return { plan, version, pendingAcknowledgment: true };
    }
    const effectivePlan = {
      ...plan,
      activeSnapshot: values.snapshot,
      activeVersionNumber: versionNumber,
      parentApprovalStatus: "not_required" as const,
      updatedAt: timestamp,
    };
    await tx.saveLearningPlan(effectivePlan);
    return { plan: effectivePlan, version, pendingAcknowledgment: false };
  });
}

export async function acknowledgeMajorPlanChange(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  planId: string,
  versionNumber: number,
) {
  requireActor(actor);
  if (!hasRole(actor, "parent"))
    throw new AcademicError("FORBIDDEN", "Only a linked parent may acknowledge this change.", 403);
  return database.transaction(async (tx) => {
    const plan = await tx.getLearningPlan(planId);
    if (!plan) throw new AcademicError("PLAN_NOT_FOUND", "Learning plan was not found.", 404);
    if (!(await tx.isParentLinkedToStudent(actor.userId, plan.studentProfileId)))
      throw new AcademicError("FORBIDDEN", "The student is not in this family.", 403);
    const version = await tx.getPlanVersion(planId, versionNumber);
    if (!version)
      throw new AcademicError("VERSION_NOT_FOUND", "Learning plan version was not found.", 404);
    if (!version.isMajorChange || version.effective || plan.parentApprovalStatus !== "pending")
      throw new AcademicError(
        "ACKNOWLEDGMENT_NOT_PENDING",
        "This change does not need acknowledgment.",
        409,
      );
    const now = new Date();
    const acknowledged = {
      ...version,
      effective: true,
      acknowledgedByUserId: actor.userId,
      acknowledgedAt: now,
    };
    const effectivePlan = {
      ...plan,
      activeSnapshot: version.snapshot,
      activeVersionNumber: version.versionNumber,
      parentApprovalStatus: "approved" as const,
      updatedAt: now,
    };
    await tx.savePlanVersion(acknowledged);
    await tx.saveLearningPlan(effectivePlan);
    return effectivePlan;
  });
}

export async function writeLessonFeedback(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  input: LessonFeedbackInput,
) {
  requireActor(actor);
  requireStaffOrTutor(actor);
  const values = lessonFeedbackSchema.parse(input);
  const now = new Date();
  const feedback = { id: ulid(), ...values, createdByUserId: actor.userId, createdAt: now };
  await database.saveFeedback(feedback);
  return feedback;
}

/** The only parent/student projection. It removes the staff-only field before any caller can render it. */
export async function getParentVisibleFeedback(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  feedbackId: string,
): Promise<ParentVisibleFeedback> {
  requireActor(actor);
  const feedback = await database.getFeedback(feedbackId);
  if (!feedback)
    throw new AcademicError("FEEDBACK_NOT_FOUND", "Lesson feedback was not found.", 404);
  const staff = hasRole(actor, "administrator", "super_administrator", "tutor");
  const ownStudent =
    hasRole(actor, "student") &&
    actor.studentProfileId === feedback.studentProfileId &&
    feedback.visibleToStudent;
  const linkedParent =
    hasRole(actor, "parent") &&
    feedback.visibleToParent &&
    (await database.isParentLinkedToStudent(actor.userId, feedback.studentProfileId));
  const assignedTutor =
    hasRole(actor, "tutor") &&
    (await database.isTutorAssignedToStudent(actor.userId, feedback.studentProfileId));
  if (!staff && !ownStudent && !linkedParent && !assignedTutor)
    throw new AcademicError("FORBIDDEN", "You cannot view this feedback.", 403);
  const { staffOnlyNote, ...visible } = feedback;
  void staffOnlyNote;
  return visible;
}

export async function createMilestone(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  input: MilestoneInput,
) {
  requireActor(actor);
  requireStaffOrTutor(actor);
  const values = milestoneSchema.parse(input);
  const now = new Date();
  const milestone = {
    id: ulid(),
    ...values,
    progressPercentage: 0,
    status: "not_started" as const,
    parentVisibleStatus: "Not started",
    completedAt: null,
    createdByUserId: actor.userId,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveMilestone(milestone);
  return milestone;
}

export async function addMilestoneEvidence(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  milestoneId: string,
  input: MilestoneEvidenceInput,
) {
  requireActor(actor);
  requireStaffOrTutor(actor);
  const values = milestoneEvidenceSchema.parse(input);
  if (!(await database.getMilestone(milestoneId)))
    throw new AcademicError("MILESTONE_NOT_FOUND", "Milestone was not found.", 404);
  const evidence = {
    id: ulid(),
    milestoneId,
    ...values,
    createdByUserId: actor.userId,
    createdAt: new Date(),
  };
  await database.saveMilestoneEvidence(evidence);
  return evidence;
}

export async function updateMilestoneProgress(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  milestoneId: string,
  progressPercentage: number,
  status: "not_started" | "in_progress" | "at_risk" | "completed" | "abandoned",
) {
  requireActor(actor);
  requireStaffOrTutor(actor);
  if (!Number.isInteger(progressPercentage) || progressPercentage < 0 || progressPercentage > 100)
    throw new AcademicError("INVALID_INPUT", "Progress must be an integer between 0 and 100.");
  const milestone = await database.getMilestone(milestoneId);
  if (!milestone) throw new AcademicError("MILESTONE_NOT_FOUND", "Milestone was not found.", 404);
  const evidence = await database.listMilestoneEvidence(milestoneId);
  if (status === "completed" && evidence.length === 0)
    throw new AcademicError("EVIDENCE_REQUIRED", "Completion requires recorded evidence.", 409);
  const parentVisibleStatus =
    status === "at_risk"
      ? "Needs attention"
      : status === "completed"
        ? "Completed"
        : status === "in_progress"
          ? "In progress"
          : status === "abandoned"
            ? "Paused"
            : "Not started";
  const next = {
    ...milestone,
    progressPercentage,
    status,
    parentVisibleStatus,
    completedAt: status === "completed" ? new Date() : null,
    updatedAt: new Date(),
  };
  await database.saveMilestone(next);
  return next;
}

export async function createProgressReview(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  input: ProgressReviewInput,
) {
  requireActor(actor);
  requireStaffOrTutor(actor);
  const values = progressReviewSchema.parse(input);
  const review = {
    id: ulid(),
    studentProfileId: values.studentProfileId,
    subjectId: values.subjectId,
    periodStart: values.periodStart,
    periodEnd: values.periodEnd,
    summary: values.summary,
    progressTrend: values.progressTrend,
    evidenceNotes: values.evidenceNotes,
    reviewedByUserId: actor.userId,
    sharedWithParentAt: values.shareWithParent ? new Date() : null,
    createdAt: new Date(),
  };
  await database.saveProgressReview(review);
  return review;
}

/** Reference data — the subject picker for every role, not scoped to who may schedule a lesson. */
export async function listSubjects(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
) {
  requireActor(actor);
  return database.listSubjects();
}

/** Resolves view access to a learner's mastery data. Mirrors gamification's `requireStudentView`. */
async function requireMasteryView(
  database: AcademicDatabase,
  actor: AcademicActor,
  studentProfileId: string,
): Promise<{ canSeeEverything: boolean }> {
  if (hasRole(actor, "administrator", "super_administrator")) return { canSeeEverything: true };
  if (hasRole(actor, "tutor") && (await database.isTutorAssignedToStudent(actor.userId, studentProfileId)))
    return { canSeeEverything: true };
  if (hasRole(actor, "student") && actor.studentProfileId === studentProfileId)
    return { canSeeEverything: false };
  if (
    hasRole(actor, "parent") &&
    (await database.isParentLinkedToStudent(actor.userId, studentProfileId))
  )
    return { canSeeEverything: false };
  throw new AcademicError("FORBIDDEN", "You cannot view this learner's mastery map.", 403);
}

function isVisibleToRestrictedActor(
  actor: AcademicActor,
  visibleToParent: boolean,
  visibleToStudent: boolean,
): boolean {
  if (hasRole(actor, "parent")) return visibleToParent;
  if (hasRole(actor, "student")) return visibleToStudent;
  return true;
}

/**
 * Records one tutor "class review": several topics observed in the same session, sharing a
 * lesson/evidence context. Status is always tutor-selected (never derived from `score`), matching
 * this domain's "no fabricated judgment" rule already applied to `progress_reviews`. One append-only
 * event per topic, plus a transactionally-updated rollup — the same ledger/balance split gamification
 * uses for points.
 */
export async function recordSkillAssessments(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  input: RecordSkillAssessmentsInput,
): Promise<SkillAssessmentEventRecord[]> {
  requireActor(actor);
  requireStaffOrTutor(actor);
  const values = recordSkillAssessmentsSchema.parse(input);
  const now = new Date();
  return database.transaction(async (tx) => {
    const events: SkillAssessmentEventRecord[] = [];
    for (const entry of values.entries) {
      const score = entry.score === null ? null : entry.score.toFixed(1);
      const event: SkillAssessmentEventRecord = {
        id: ulid(),
        studentProfileId: values.studentProfileId,
        skillId: entry.skillId,
        lessonId: values.lessonId,
        feedbackId: null,
        score,
        status: entry.status,
        confidence: entry.confidence,
        evidenceType: values.evidenceType,
        calculationMethod: "tutor",
        note: entry.note ?? values.sharedNote,
        visibleToParent: values.visibleToParent,
        visibleToStudent: values.visibleToStudent,
        recordedByUserId: actor.userId,
        createdAt: now,
      };
      await tx.saveSkillAssessmentEvent(event);
      const previous = await tx.getStudentSkillRecord(values.studentProfileId, entry.skillId);
      const previousScore = previous?.score == null ? null : Number(previous.score);
      const trend: SkillTrend =
        entry.score === null || previousScore === null
          ? "new"
          : entry.score > previousScore
            ? "up"
            : entry.score < previousScore
              ? "down"
              : "steady";
      const record: StudentSkillRecord = {
        id: previous?.id ?? ulid(),
        studentProfileId: values.studentProfileId,
        skillId: entry.skillId,
        status: entry.status,
        score,
        confidence: entry.confidence,
        trend,
        evidenceCount: (previous?.evidenceCount ?? 0) + 1,
        lastNote: event.note,
        visibleToParent: values.visibleToParent,
        visibleToStudent: values.visibleToStudent,
        lastAssessedAt: now,
        lastEventId: event.id,
        updatedAt: now,
      };
      await tx.upsertStudentSkillRecord(record);
      events.push(event);
    }
    return events;
  });
}

export interface SkillMasteryTopic {
  skill: SkillRecord;
  /** `null` if never assessed, or hidden from this viewer by the tutor's visibility choice. */
  record: StudentSkillRecord | null;
  prerequisiteSkillIds: string[];
}

export interface SkillMasteryDomain {
  unit: CurriculumUnitRecord;
  topics: SkillMasteryTopic[];
}

export interface StudentMasteryMap {
  course: CourseRecord | null;
  domains: SkillMasteryDomain[];
  /** Tutor-created topics with no seeded unit. */
  unsorted: SkillMasteryTopic[];
}

/** The read behind the map/table/timeline views — one subject's full mastery picture for a student. */
export async function getStudentMasteryMap(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  studentProfileId: string,
  subjectId: string,
): Promise<StudentMasteryMap> {
  requireActor(actor);
  const { canSeeEverything } = await requireMasteryView(database, actor, studentProfileId);

  const [courses, skills, records] = await Promise.all([
    database.listCoursesForSubject(subjectId),
    database.listSkillsForSubject(subjectId),
    database.listStudentSkillRecords(studentProfileId, subjectId),
  ]);
  const course = courses[0] ?? null;
  const units = course ? await database.listCurriculumUnits(course.id) : [];
  const recordBySkill = new Map(records.map((record) => [record.skillId, record]));

  const topics = await Promise.all(
    skills.map(async (skill): Promise<SkillMasteryTopic> => {
      const raw = recordBySkill.get(skill.id) ?? null;
      const record =
        raw && !canSeeEverything && !isVisibleToRestrictedActor(actor, raw.visibleToParent, raw.visibleToStudent)
          ? null
          : raw;
      return { skill, record, prerequisiteSkillIds: await database.listSkillPrerequisiteIds(skill.id) };
    }),
  );

  const byUnit = new Map<string, SkillMasteryTopic[]>();
  const unsorted: SkillMasteryTopic[] = [];
  for (const topic of topics) {
    if (!topic.skill.unitId) {
      unsorted.push(topic);
      continue;
    }
    const bucket = byUnit.get(topic.skill.unitId) ?? [];
    bucket.push(topic);
    byUnit.set(topic.skill.unitId, bucket);
  }
  const domains = units
    .map((unit) => ({
      unit,
      topics: (byUnit.get(unit.id) ?? []).sort((a, b) => a.skill.orderIndex - b.skill.orderIndex),
    }))
    .sort((a, b) => a.unit.orderIndex - b.unit.orderIndex);

  return { course, domains, unsorted };
}

/** Recent cross-topic activity for the timeline view. */
export async function getRecentSkillActivity(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  studentProfileId: string,
  subjectId: string,
  limit = 20,
): Promise<SkillAssessmentEventRecord[]> {
  requireActor(actor);
  const { canSeeEverything } = await requireMasteryView(database, actor, studentProfileId);
  const events = await database.listRecentSkillAssessmentEvents(studentProfileId, subjectId, limit);
  return canSeeEverything
    ? events
    : events.filter((event) =>
        isVisibleToRestrictedActor(actor, event.visibleToParent, event.visibleToStudent),
      );
}

/** Full evidence history for the topic drawer. */
export async function getSkillDetail(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  studentProfileId: string,
  skillId: string,
) {
  requireActor(actor);
  const { canSeeEverything } = await requireMasteryView(database, actor, studentProfileId);
  const skill = await database.getSkill(skillId);
  if (!skill) throw new AcademicError("SKILL_NOT_FOUND", "Topic was not found.", 404);
  const [events, prerequisiteSkillIds] = await Promise.all([
    database.listSkillAssessmentEvents(studentProfileId, skillId),
    database.listSkillPrerequisiteIds(skillId),
  ]);
  const visibleEvents = canSeeEverything
    ? events
    : events.filter((event) =>
        isVisibleToRestrictedActor(actor, event.visibleToParent, event.visibleToStudent),
      );
  return { skill, events: visibleEvents, prerequisiteSkillIds };
}

/** Tutor-only escape hatch for a topic the seeded curriculum doesn't cover. */
export async function createCustomSkill(
  database: AcademicDatabase,
  actor: AcademicActor | null | undefined,
  input: CreateCustomSkillInput,
): Promise<SkillRecord> {
  requireActor(actor);
  requireStaffOrTutor(actor);
  const values = createCustomSkillSchema.parse(input);
  const skill: SkillRecord = {
    id: ulid(),
    subjectId: values.subjectId,
    unitId: null,
    orderIndex: 0,
    code: null,
    key: `custom:${ulid()}`,
    name: values.name,
    description: values.description,
    masteryCriteria: [],
    misconceptions: [],
    createdByUserId: actor.userId,
  };
  await database.saveSkill(skill);
  return skill;
}
