import { describe, expect, it } from "vitest";
import { AcademicError } from "../../../../packages/domain/academics/errors";
import {
  acknowledgeMajorPlanChange,
  createLearningPlan,
  createMilestone,
  getParentVisibleFeedback,
  reviseLearningPlan,
  updateMilestoneProgress,
  writeLessonFeedback,
} from "../../../../packages/domain/academics/services";
import { InMemoryAcademicDatabase } from "./support/in-memory-academic-database";

const tutor = { userId: "tutor-1", roles: ["tutor"] as const };
const parent = { userId: "parent-1", roles: ["parent"] as const };
const student = {
  userId: "student-user",
  studentProfileId: "student-1",
  roles: ["student"] as const,
};
const snapshot = (mainGoal = "Build algebra fluency", exam = true) => ({
  title: "Algebra plan",
  startDate: "2026-08-01",
  reviewDate: "2026-09-01",
  mainGoal,
  parentGoal: null,
  studentGoal: "Feel confident",
  tutorGoal: null,
  currentBaseline: "Can solve one-step equations",
  expectedLessonFrequency: "Weekly",
  homeworkExpectations: "Two short practice sets",
  projectWork: null,
  items: [
    {
      type: "target_outcome" as const,
      title: "Placement exam",
      description: null,
      orderIndex: 0,
      status: "planned" as const,
      isExamGoal: exam,
    },
  ],
});
const feedbackInput = () => ({
  lessonId: "lesson-1",
  studentProfileId: "student-1",
  topicsCovered: "Solving two-step equations",
  objectiveMet: "partly" as const,
  assignmentCompletionStatus: "partial" as const,
  assignmentAccuracyNote: "Checked questions 1–4",
  effortEngagementNote: "Asked for an example before independently completing a similar problem.",
  strengthsDemonstrated: "Accurate inverse operations",
  skillsToImprove: "Checking arithmetic",
  nextLessonFocus: "Word problems",
  assignedHomework: "Practice set 3",
  parentActionNeeded: "None",
  studentActionNeeded: "Bring one question",
  milestoneProgressNote: "Moving toward independent problem solving",
  tutorConfidence: "high" as const,
  freeTextComment: "A steady lesson with useful questions.",
  staffOnlyNote: "Discuss pacing with coordinator",
  visibleToParent: true,
  visibleToStudent: true,
  status: "published" as const,
});

describe("academics services", () => {
  it("holds a major learning-plan change until a linked parent acknowledges its version", async () => {
    const database = new InMemoryAcademicDatabase();
    database.parentLinks.add("parent-1:student-1");
    const plan = await createLearningPlan(database, tutor, {
      studentProfileId: "student-1",
      subjectId: "math",
      snapshot: snapshot(),
    });
    const revised = await reviseLearningPlan(database, tutor, plan.id, {
      snapshot: snapshot("Prepare for the fall exam"),
      changeSummary: "Adjusted the main goal after baseline review.",
    });
    expect(revised.pendingAcknowledgment).toBe(true);
    expect((await database.getLearningPlan(plan.id))?.activeSnapshot.mainGoal).toBe(
      "Build algebra fluency",
    );
    await acknowledgeMajorPlanChange(database, parent, plan.id, revised.version.versionNumber);
    expect((await database.getLearningPlan(plan.id))?.activeSnapshot.mainGoal).toBe(
      "Prepare for the fall exam",
    );
  });

  it("rejects feedback missing a required structured field", async () => {
    const database = new InMemoryAcademicDatabase();
    await expect(
      writeLessonFeedback(database, tutor, { ...feedbackInput(), nextLessonFocus: "" }),
    ).rejects.toBeTruthy();
  });

  it("never exposes a staff-only note to a student or linked parent", async () => {
    const database = new InMemoryAcademicDatabase();
    database.parentLinks.add("parent-1:student-1");
    const feedback = await writeLessonFeedback(database, tutor, feedbackInput());
    const parentView = await getParentVisibleFeedback(database, parent, feedback.id);
    const studentView = await getParentVisibleFeedback(database, student, feedback.id);
    expect(parentView).not.toHaveProperty("staffOnlyNote");
    expect(studentView).not.toHaveProperty("staffOnlyNote");
  });

  it("hides feedback from a recipient the tutor did not select, while staff and the assigned tutor keep full access", async () => {
    const database = new InMemoryAcademicDatabase();
    database.parentLinks.add("parent-1:student-1");
    database.tutorAssignments.add("tutor-1:student-1");
    const feedback = await writeLessonFeedback(database, tutor, {
      ...feedbackInput(),
      visibleToParent: false,
      visibleToStudent: true,
    });

    await expect(getParentVisibleFeedback(database, parent, feedback.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      getParentVisibleFeedback(database, student, feedback.id),
    ).resolves.toMatchObject({ id: feedback.id });
    await expect(
      getParentVisibleFeedback(database, tutor, feedback.id),
    ).resolves.toMatchObject({ id: feedback.id });
  });

  it("does not complete a milestone without evidence", async () => {
    const database = new InMemoryAcademicDatabase();
    const milestone = await createMilestone(database, tutor, {
      studentProfileId: "student-1",
      subjectId: "math",
      learningPlanId: null,
      category: "academic_mastery",
      objective: "Solve equations",
      baseline: null,
      target: "Solve independently",
      targetDate: null,
    });
    await expect(
      updateMilestoneProgress(database, tutor, milestone.id, 100, "completed"),
    ).rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" } satisfies Partial<AcademicError>);
  });
});
