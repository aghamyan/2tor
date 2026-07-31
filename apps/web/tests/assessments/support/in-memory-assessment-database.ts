import type {
  AssessmentAnswerRecord,
  AssessmentAttemptRecord,
  AssessmentDatabase,
  AssessmentEventRecord,
  AssessmentRecord,
  AssessmentVersionRecord,
  DiagnosticReportRecord,
} from "../../../../../packages/domain/assessments/models";

export class InMemoryAssessmentDatabase implements AssessmentDatabase {
  readonly assessments = new Map<string, AssessmentRecord>();
  readonly versions = new Map<string, AssessmentVersionRecord>();
  readonly attempts = new Map<string, AssessmentAttemptRecord>();
  readonly answers = new Map<string, AssessmentAnswerRecord>();
  readonly events: AssessmentEventRecord[] = [];
  readonly reports = new Map<string, DiagnosticReportRecord>();
  readonly cameraConsents = new Set<string>();
  readonly tutorAssignments = new Set<string>();
  readonly parentLinks = new Set<string>();
  readonly studentProfiles = new Map<string, string>();

  async transaction<T>(operation: (database: AssessmentDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async saveAssessment(assessment: AssessmentRecord) {
    this.assessments.set(assessment.id, assessment);
  }

  async getAssessment(assessmentId: string) {
    return this.assessments.get(assessmentId) ?? null;
  }

  async listAssessments() {
    return [...this.assessments.values()];
  }

  async saveVersion(version: AssessmentVersionRecord) {
    this.versions.set(version.id, version);
  }

  async getVersion(versionId: string) {
    return this.versions.get(versionId) ?? null;
  }

  async getLatestVersion(assessmentId: string) {
    return (
      [...this.versions.values()]
        .filter((version) => version.assessmentId === assessmentId)
        .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null
    );
  }

  async getLatestPublishedVersion(assessmentId: string) {
    return (
      [...this.versions.values()]
        .filter((version) => version.assessmentId === assessmentId && version.publishedAt !== null)
        .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null
    );
  }

  async saveAttempt(attempt: AssessmentAttemptRecord) {
    this.attempts.set(attempt.id, attempt);
  }

  async getAttempt(attemptId: string) {
    return this.attempts.get(attemptId) ?? null;
  }

  async listExpiredAttempts(now: Date, limit: number) {
    const expired: AssessmentAttemptRecord[] = [];
    for (const attempt of this.attempts.values()) {
      if (attempt.status !== "in_progress") continue;
      const version = this.versions.get(attempt.assessmentVersionId);
      const duration = version?.settings.durationSeconds;
      if (duration && attempt.startedAt.getTime() + duration * 1_000 < now.getTime()) {
        expired.push(attempt);
      }
    }
    return expired.slice(0, limit);
  }

  async saveAnswer(answer: AssessmentAnswerRecord) {
    this.answers.set(`${answer.attemptId}:${answer.questionId}`, answer);
  }

  async getAnswer(attemptId: string, questionId: string) {
    return this.answers.get(`${attemptId}:${questionId}`) ?? null;
  }

  async listAnswers(attemptId: string) {
    return [...this.answers.values()].filter((answer) => answer.attemptId === attemptId);
  }

  async appendEvents(events: AssessmentEventRecord[]) {
    this.events.push(...events);
  }

  async listEvents(attemptId: string) {
    return this.events.filter((event) => event.attemptId === attemptId);
  }

  async hasActiveCameraConsent(studentProfileId: string, policyVersion: string) {
    return this.cameraConsents.has(`${studentProfileId}:${policyVersion}`);
  }

  async isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string) {
    return this.tutorAssignments.has(`${tutorUserId}:${studentProfileId}`);
  }

  async isParentLinkedToStudent(parentUserId: string, studentProfileId: string) {
    return this.parentLinks.has(`${parentUserId}:${studentProfileId}`);
  }

  async findStudentProfileIdByUserId(userId: string) {
    return this.studentProfiles.get(userId) ?? null;
  }

  async saveDiagnosticReport(report: DiagnosticReportRecord) {
    this.reports.set(report.id, report);
  }

  async getDiagnosticReport(reportId: string) {
    return this.reports.get(reportId) ?? null;
  }

  async getDiagnosticReportForAttempt(attemptId: string) {
    return (
      [...this.reports.values()].find((report) => report.assessmentAttemptId === attemptId) ?? null
    );
  }
}
