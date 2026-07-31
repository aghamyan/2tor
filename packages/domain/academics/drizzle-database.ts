import {
  learningPlanItems,
  learningPlanVersions,
  learningPlans,
  lessonFeedback,
  milestoneEvidence,
  milestones,
  parentProfiles,
  parentStudentLinks,
  progressReviews,
  tutorNotes,
  tutorProfiles,
  tutorStudentAssignments,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import type {
  AcademicDatabase,
  LearningPlanSnapshot,
  LearningPlanVersionRecord,
  LessonFeedbackRecord,
} from "./models";

type Executor = Database | Transaction;
type StoredSnapshot = {
  data: LearningPlanSnapshot;
  meta?: Pick<
    LearningPlanVersionRecord,
    "isMajorChange" | "effective" | "acknowledgedByUserId" | "acknowledgedAt"
  >;
};

function storedSnapshot(snapshot: LearningPlanVersionRecord): StoredSnapshot {
  return {
    data: snapshot.snapshot,
    meta: {
      isMajorChange: snapshot.isMajorChange,
      effective: snapshot.effective,
      acknowledgedByUserId: snapshot.acknowledgedByUserId,
      acknowledgedAt: snapshot.acknowledgedAt,
    },
  };
}
function readSnapshot(value: unknown): StoredSnapshot {
  if (typeof value === "object" && value !== null && "data" in value)
    return value as StoredSnapshot;
  return {
    data: value as LearningPlanSnapshot,
    meta: {
      isMajorChange: false,
      effective: true,
      acknowledgedByUserId: null,
      acknowledgedAt: null,
    },
  };
}
function planFields(snapshot: LearningPlanSnapshot) {
  return {
    title: snapshot.title,
    startDate: snapshot.startDate,
    reviewDate: snapshot.reviewDate,
    parentGoal: snapshot.parentGoal ?? snapshot.mainGoal,
    studentGoal: snapshot.studentGoal,
    tutorGoal: snapshot.tutorGoal,
    currentBaseline: snapshot.currentBaseline,
    expectedLessonFrequency: snapshot.expectedLessonFrequency,
    homeworkExpectations: snapshot.homeworkExpectations,
    projectWork: snapshot.projectWork,
  };
}
function feedbackFromRow(
  row: typeof lessonFeedback.$inferSelect,
  staffOnlyNote: string | null,
): LessonFeedbackRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    studentProfileId: row.studentProfileId,
    topicsCovered: row.topicsCovered ?? "",
    objectiveMet: row.objectiveMet,
    assignmentCompletionStatus: row.assignmentCompletionStatus,
    assignmentAccuracyNote: row.assignmentAccuracyNote,
    effortEngagementNote: row.effortEngagementNote,
    strengthsDemonstrated: row.strengthsDemonstrated ?? "",
    skillsToImprove: row.skillsToImprove ?? "",
    nextLessonFocus: row.nextLessonFocus ?? "",
    assignedHomework: row.assignedHomework ?? "",
    parentActionNeeded: row.parentActionNeeded ?? "",
    studentActionNeeded: row.studentActionNeeded ?? "",
    milestoneProgressNote: row.milestoneProgressNote ?? "",
    tutorConfidence: row.tutorConfidence,
    freeTextComment: row.freeTextComment ?? "",
    staffOnlyNote,
    status: row.status,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): AcademicDatabase {
  async function feedbackNote(feedbackId: string, lessonId: string, studentProfileId: string) {
    const [row] = await executor
      .select({ note: tutorNotes.note })
      .from(tutorNotes)
      .where(
        and(
          eq(tutorNotes.lessonId, lessonId),
          eq(tutorNotes.studentProfileId, studentProfileId),
          eq(tutorNotes.visibility, "staff_only"),
        ),
      )
      .orderBy(desc(tutorNotes.createdAt))
      .limit(1);
    return row?.note.startsWith(`[feedback:${feedbackId}] `)
      ? row.note.slice(feedbackId.length + 12)
      : null;
  }
  return {
    async transaction<T>(operation: (database: AcademicDatabase) => Promise<T>) {
      return insideTransaction
        ? operation(repository(executor, root, true))
        : root.transaction((tx) => operation(repository(tx, root, true)));
    },
    async getLearningPlan(id) {
      const [row] = await executor
        .select()
        .from(learningPlans)
        .where(eq(learningPlans.id, id))
        .limit(1);
      if (!row) return null;
      const versions = await executor
        .select()
        .from(learningPlanVersions)
        .where(eq(learningPlanVersions.learningPlanId, id))
        .orderBy(desc(learningPlanVersions.versionNumber));
      const effective =
        versions.find((version) => readSnapshot(version.snapshot).meta?.effective !== false) ??
        versions[0];
      const snapshot = effective
        ? readSnapshot(effective.snapshot).data
        : {
            title: row.title,
            startDate: row.startDate,
            reviewDate: row.reviewDate,
            mainGoal: row.parentGoal ?? row.tutorGoal ?? row.title,
            parentGoal: row.parentGoal,
            studentGoal: row.studentGoal,
            tutorGoal: row.tutorGoal,
            currentBaseline: row.currentBaseline,
            expectedLessonFrequency: row.expectedLessonFrequency,
            homeworkExpectations: row.homeworkExpectations,
            projectWork: row.projectWork,
            items: [],
          };
      return {
        id: row.id,
        studentProfileId: row.studentProfileId,
        subjectId: row.subjectId,
        authorUserId: row.authorUserId,
        activeSnapshot: snapshot,
        activeVersionNumber: effective?.versionNumber ?? 1,
        parentApprovalStatus: row.parentApprovalStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
    async saveLearningPlan(plan) {
      const existing = await executor
        .select({ id: learningPlans.id })
        .from(learningPlans)
        .where(eq(learningPlans.id, plan.id))
        .limit(1);
      const values = {
        ...planFields(plan.activeSnapshot),
        parentApprovalStatus: plan.parentApprovalStatus,
        updatedAt: plan.updatedAt,
      };
      if (existing[0])
        await executor.update(learningPlans).set(values).where(eq(learningPlans.id, plan.id));
      else
        await executor.insert(learningPlans).values({
          id: plan.id,
          studentProfileId: plan.studentProfileId,
          subjectId: plan.subjectId,
          authorUserId: plan.authorUserId,
          status: "active",
          ...values,
        });
      await executor.delete(learningPlanItems).where(eq(learningPlanItems.learningPlanId, plan.id));
      await executor.insert(learningPlanItems).values(
        plan.activeSnapshot.items.map((item) => ({
          id: ulid(),
          learningPlanId: plan.id,
          type: item.type,
          title: item.title,
          description: item.description,
          orderIndex: item.orderIndex,
          status: item.status,
        })),
      );
    },
    async listPlanVersions(planId) {
      const rows = await executor
        .select()
        .from(learningPlanVersions)
        .where(eq(learningPlanVersions.learningPlanId, planId))
        .orderBy(asc(learningPlanVersions.versionNumber));
      return rows.map((row) => {
        const stored = readSnapshot(row.snapshot);
        return {
          id: row.id,
          learningPlanId: row.learningPlanId,
          versionNumber: row.versionNumber,
          snapshot: stored.data,
          changeSummary: row.changeSummary ?? "",
          isMajorChange: stored.meta?.isMajorChange ?? false,
          effective: stored.meta?.effective ?? true,
          createdByUserId: row.createdByUserId,
          createdAt: row.createdAt,
          acknowledgedByUserId: stored.meta?.acknowledgedByUserId ?? null,
          acknowledgedAt: stored.meta?.acknowledgedAt ? new Date(stored.meta.acknowledgedAt) : null,
        };
      });
    },
    async savePlanVersion(version) {
      const existing = await executor
        .select({ id: learningPlanVersions.id })
        .from(learningPlanVersions)
        .where(
          and(
            eq(learningPlanVersions.learningPlanId, version.learningPlanId),
            eq(learningPlanVersions.versionNumber, version.versionNumber),
          ),
        )
        .limit(1);
      const values = {
        snapshot: storedSnapshot(version),
        changeSummary: version.changeSummary,
        createdByUserId: version.createdByUserId,
      };
      if (existing[0])
        await executor
          .update(learningPlanVersions)
          .set(values)
          .where(eq(learningPlanVersions.id, existing[0].id));
      else
        await executor.insert(learningPlanVersions).values({
          id: version.id,
          learningPlanId: version.learningPlanId,
          versionNumber: version.versionNumber,
          ...values,
        });
    },
    async getPlanVersion(planId, versionNumber) {
      return (
        (await this.listPlanVersions(planId)).find(
          (version) => version.versionNumber === versionNumber,
        ) ?? null
      );
    },
    async saveFeedback(feedback) {
      await executor.insert(lessonFeedback).values({
        id: feedback.id,
        lessonId: feedback.lessonId,
        studentProfileId: feedback.studentProfileId,
        topicsCovered: feedback.topicsCovered,
        objectiveMet: feedback.objectiveMet,
        assignmentCompletionStatus: feedback.assignmentCompletionStatus,
        assignmentAccuracyNote: feedback.assignmentAccuracyNote,
        effortEngagementNote: feedback.effortEngagementNote,
        strengthsDemonstrated: feedback.strengthsDemonstrated,
        skillsToImprove: feedback.skillsToImprove,
        nextLessonFocus: feedback.nextLessonFocus,
        assignedHomework: feedback.assignedHomework,
        parentActionNeeded: feedback.parentActionNeeded,
        studentActionNeeded: feedback.studentActionNeeded,
        milestoneProgressNote: feedback.milestoneProgressNote,
        tutorConfidence: feedback.tutorConfidence,
        freeTextComment: feedback.freeTextComment,
        status: feedback.status,
        createdByUserId: feedback.createdByUserId,
      });
      if (feedback.staffOnlyNote) {
        const [tutor] = await executor
          .select({ id: tutorProfiles.id })
          .from(tutorProfiles)
          .where(eq(tutorProfiles.userId, feedback.createdByUserId))
          .limit(1);
        if (tutor)
          await executor.insert(tutorNotes).values({
            tutorProfileId: tutor.id,
            studentProfileId: feedback.studentProfileId,
            lessonId: feedback.lessonId,
            visibility: "staff_only",
            note: `[feedback:${feedback.id}] ${feedback.staffOnlyNote}`,
          });
      }
    },
    async getFeedback(id) {
      const [row] = await executor
        .select()
        .from(lessonFeedback)
        .where(eq(lessonFeedback.id, id))
        .limit(1);
      return row
        ? feedbackFromRow(row, await feedbackNote(row.id, row.lessonId, row.studentProfileId))
        : null;
    },
    async listFeedbackForStudent(studentProfileId) {
      const rows = await executor
        .select()
        .from(lessonFeedback)
        .where(eq(lessonFeedback.studentProfileId, studentProfileId))
        .orderBy(desc(lessonFeedback.createdAt));
      return Promise.all(
        rows.map(async (row) =>
          feedbackFromRow(row, await feedbackNote(row.id, row.lessonId, row.studentProfileId)),
        ),
      );
    },
    async saveMilestone(milestone) {
      const values = {
        studentProfileId: milestone.studentProfileId,
        subjectId: milestone.subjectId,
        learningPlanId: milestone.learningPlanId,
        category: milestone.category,
        objective: milestone.objective,
        baseline: milestone.baseline,
        target: milestone.target,
        targetDate: milestone.targetDate,
        progressPercentage: milestone.progressPercentage,
        status: milestone.status,
        parentVisibleStatus: milestone.parentVisibleStatus,
        completedAt: milestone.completedAt,
        createdByUserId: milestone.createdByUserId,
        updatedAt: milestone.updatedAt,
      };
      const [existing] = await executor
        .select({ id: milestones.id })
        .from(milestones)
        .where(eq(milestones.id, milestone.id))
        .limit(1);
      if (existing)
        await executor.update(milestones).set(values).where(eq(milestones.id, milestone.id));
      else await executor.insert(milestones).values({ id: milestone.id, ...values });
    },
    async getMilestone(id) {
      const [row] = await executor.select().from(milestones).where(eq(milestones.id, id)).limit(1);
      return row
        ? {
            ...row,
            subjectId: row.subjectId,
            learningPlanId: row.learningPlanId,
            baseline: row.baseline,
            targetDate: row.targetDate,
            parentVisibleStatus: row.parentVisibleStatus ?? "Not started",
          }
        : null;
    },
    async saveMilestoneEvidence(evidence) {
      await executor.insert(milestoneEvidence).values(evidence);
    },
    async listMilestoneEvidence(milestoneId) {
      const rows = await executor
        .select()
        .from(milestoneEvidence)
        .where(eq(milestoneEvidence.milestoneId, milestoneId));
      return rows.map((row) => ({ ...row, description: row.description ?? "" }));
    },
    async saveProgressReview(review) {
      await executor.insert(progressReviews).values(review);
    },
    async isParentLinkedToStudent(parentUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: parentStudentLinks.id })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(
          and(
            eq(parentProfiles.userId, parentUserId),
            eq(parentStudentLinks.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async isTutorAssignedToStudent(tutorUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: tutorStudentAssignments.id })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .where(
          and(
            eq(tutorProfiles.userId, tutorUserId),
            eq(tutorStudentAssignments.studentProfileId, studentProfileId),
            eq(tutorStudentAssignments.status, "active"),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
  };
}
export function createDrizzleAcademicDatabase(database: Database): AcademicDatabase {
  return repository(database, database, false);
}
