import type {
  AcademicDatabase,
  CourseRecord,
  CurriculumUnitRecord,
  LearningPlanRecord,
  LearningPlanVersionRecord,
  LessonFeedbackRecord,
  MilestoneEvidenceRecord,
  MilestoneRecord,
  ProgressReviewRecord,
  SkillAssessmentEventRecord,
  SkillRecord,
  StudentSkillRecord,
  SubjectRecord,
} from "../../../../../packages/domain/academics/models";

export class InMemoryAcademicDatabase implements AcademicDatabase {
  readonly plans = new Map<string, LearningPlanRecord>();
  readonly versions = new Map<string, LearningPlanVersionRecord[]>();
  readonly feedback = new Map<string, LessonFeedbackRecord>();
  readonly milestones = new Map<string, MilestoneRecord>();
  readonly evidence = new Map<string, MilestoneEvidenceRecord[]>();
  readonly reviews: ProgressReviewRecord[] = [];
  readonly parentLinks = new Set<string>();
  readonly tutorAssignments = new Set<string>();
  readonly studentProfileIdByUserId = new Map<string, string>();
  readonly subjects = new Map<string, SubjectRecord>();
  readonly courses = new Map<string, CourseRecord>();
  readonly units = new Map<string, CurriculumUnitRecord>();
  readonly skills = new Map<string, SkillRecord>();
  readonly skillPrerequisites = new Set<string>();
  readonly skillRecords = new Map<string, StudentSkillRecord>();
  readonly skillEvents: SkillAssessmentEventRecord[] = [];
  async transaction<T>(operation: (database: AcademicDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async getLearningPlan(id: string) {
    return this.plans.get(id) ?? null;
  }
  async saveLearningPlan(plan: LearningPlanRecord) {
    this.plans.set(plan.id, plan);
  }
  async listPlanVersions(planId: string) {
    return [...(this.versions.get(planId) ?? [])];
  }
  async savePlanVersion(version: LearningPlanVersionRecord) {
    const all = this.versions.get(version.learningPlanId) ?? [];
    const index = all.findIndex((item) => item.versionNumber === version.versionNumber);
    if (index >= 0) all[index] = version;
    else all.push(version);
    this.versions.set(version.learningPlanId, all);
  }
  async getPlanVersion(planId: string, versionNumber: number) {
    return (
      (this.versions.get(planId) ?? []).find((item) => item.versionNumber === versionNumber) ?? null
    );
  }
  async saveFeedback(feedback: LessonFeedbackRecord) {
    this.feedback.set(feedback.id, feedback);
  }
  async getFeedback(id: string) {
    return this.feedback.get(id) ?? null;
  }
  async getFeedbackForLesson(lessonId: string) {
    const matches = [...this.feedback.values()]
      .filter((item) => item.lessonId === lessonId && item.status !== "draft")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matches[0] ?? null;
  }
  async listFeedbackForStudent(studentProfileId: string) {
    return [...this.feedback.values()].filter((item) => item.studentProfileId === studentProfileId);
  }
  async saveMilestone(milestone: MilestoneRecord) {
    this.milestones.set(milestone.id, milestone);
  }
  async getMilestone(id: string) {
    return this.milestones.get(id) ?? null;
  }
  async saveMilestoneEvidence(evidence: MilestoneEvidenceRecord) {
    this.evidence.set(evidence.milestoneId, [
      ...(this.evidence.get(evidence.milestoneId) ?? []),
      evidence,
    ]);
  }
  async listMilestoneEvidence(milestoneId: string) {
    return [...(this.evidence.get(milestoneId) ?? [])];
  }
  async saveProgressReview(review: ProgressReviewRecord) {
    this.reviews.push(review);
  }
  async isParentLinkedToStudent(parentUserId: string, studentProfileId: string) {
    return this.parentLinks.has(`${parentUserId}:${studentProfileId}`);
  }
  async isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string) {
    return this.tutorAssignments.has(`${tutorUserId}:${studentProfileId}`);
  }
  async findStudentProfileIdByUserId(userId: string) {
    return this.studentProfileIdByUserId.get(userId) ?? null;
  }
  async listSubjects() {
    return [...this.subjects.values()];
  }
  async listCoursesForSubject(subjectId: string) {
    return [...this.courses.values()].filter((course) => course.subjectId === subjectId);
  }
  async listCurriculumUnits(courseId: string) {
    return [...this.units.values()]
      .filter((unit) => unit.courseId === courseId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }
  async listSkillsForSubject(subjectId: string) {
    return [...this.skills.values()]
      .filter((skill) => skill.subjectId === subjectId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }
  async getSkill(skillId: string) {
    return this.skills.get(skillId) ?? null;
  }
  async saveSkill(skill: SkillRecord) {
    this.skills.set(skill.id, skill);
  }
  async listSkillPrerequisiteIds(skillId: string) {
    return [...this.skillPrerequisites]
      .filter((pair) => pair.startsWith(`${skillId}:`))
      .map((pair) => pair.slice(skillId.length + 1));
  }
  async saveSkillPrerequisite(skillId: string, prerequisiteSkillId: string) {
    this.skillPrerequisites.add(`${skillId}:${prerequisiteSkillId}`);
  }
  async listStudentSkillRecords(studentProfileId: string, subjectId: string) {
    return [...this.skillRecords.values()].filter(
      (record) =>
        record.studentProfileId === studentProfileId &&
        this.skills.get(record.skillId)?.subjectId === subjectId,
    );
  }
  async getStudentSkillRecord(studentProfileId: string, skillId: string) {
    return (
      [...this.skillRecords.values()].find(
        (record) => record.studentProfileId === studentProfileId && record.skillId === skillId,
      ) ?? null
    );
  }
  async upsertStudentSkillRecord(record: StudentSkillRecord) {
    const existing = [...this.skillRecords.values()].find(
      (item) => item.studentProfileId === record.studentProfileId && item.skillId === record.skillId,
    );
    this.skillRecords.set(existing?.id ?? record.id, record);
  }
  async saveSkillAssessmentEvent(event: SkillAssessmentEventRecord) {
    this.skillEvents.push(event);
  }
  async listSkillAssessmentEvents(studentProfileId: string, skillId: string) {
    return this.skillEvents
      .filter((event) => event.studentProfileId === studentProfileId && event.skillId === skillId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async listRecentSkillAssessmentEvents(studentProfileId: string, subjectId: string, limit: number) {
    return this.skillEvents
      .filter(
        (event) =>
          event.studentProfileId === studentProfileId &&
          this.skills.get(event.skillId)?.subjectId === subjectId,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
