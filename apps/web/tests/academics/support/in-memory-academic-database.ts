import type {
  AcademicDatabase,
  LearningPlanRecord,
  LearningPlanVersionRecord,
  LessonFeedbackRecord,
  MilestoneEvidenceRecord,
  MilestoneRecord,
  ProgressReviewRecord,
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
}
