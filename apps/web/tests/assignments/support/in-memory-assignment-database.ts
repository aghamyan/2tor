import type {
  AssignmentDatabase,
  AssignmentRecord,
  GradingRecord,
  RubricRecord,
  RubricScoreRecord,
  SubmissionAnswerRecord,
  SubmissionFileRecord,
  SubmissionRecord,
  VirusScanStatus,
} from "../../../../../packages/domain/assignments/models";

export class InMemoryAssignmentDatabase implements AssignmentDatabase {
  readonly assignments = new Map<string, AssignmentRecord>();
  readonly submissions = new Map<string, SubmissionRecord>();
  readonly files = new Map<string, SubmissionFileRecord>();
  readonly rubrics = new Map<string, RubricRecord>();
  readonly gradings = new Map<string, GradingRecord>();
  readonly rubricScores = new Map<string, RubricScoreRecord[]>();
  readonly tutorAssignments = new Set<string>();
  readonly studentProfiles = new Map<string, string>();
  async transaction<T>(operation: (database: AssignmentDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async saveAssignment(assignment: AssignmentRecord) {
    this.assignments.set(assignment.id, assignment);
  }
  async getAssignment(assignmentId: string) {
    return this.assignments.get(assignmentId) ?? null;
  }
  async saveSubmission(submission: SubmissionRecord) {
    this.submissions.set(submission.id, submission);
  }
  async getSubmission(submissionId: string) {
    return this.submissions.get(submissionId) ?? null;
  }
  async getSubmissionForAssignmentStudent(assignmentId: string, studentProfileId: string) {
    return (
      [...this.submissions.values()].find(
        (submission) =>
          submission.assignmentId === assignmentId &&
          submission.studentProfileId === studentProfileId,
      ) ?? null
    );
  }
  async replaceSubmissionAnswers(submissionId: string, answers: SubmissionAnswerRecord[]) {
    const submission = this.submissions.get(submissionId);
    if (submission) this.submissions.set(submissionId, { ...submission, answers });
  }
  async saveSubmissionFile(file: SubmissionFileRecord) {
    this.files.set(file.id, file);
  }
  async getSubmissionFile(fileId: string) {
    return this.files.get(fileId) ?? null;
  }
  async updateSubmissionFileScanStatus(fileId: string, status: VirusScanStatus) {
    const file = this.files.get(fileId);
    if (file) this.files.set(fileId, { ...file, virusScanStatus: status });
  }
  async saveGrading(grading: GradingRecord) {
    this.gradings.set(grading.submissionId, grading);
  }
  async replaceRubricScores(submissionId: string, scores: RubricScoreRecord[]) {
    this.rubricScores.set(submissionId, scores);
  }
  async saveRubric(rubric: RubricRecord) {
    this.rubrics.set(rubric.id, rubric);
  }
  async getRubric(rubricId: string) {
    return this.rubrics.get(rubricId) ?? null;
  }
  async findStudentProfileIdByUserId(userId: string) {
    return this.studentProfiles.get(userId) ?? null;
  }
  async isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string) {
    return this.tutorAssignments.has(`${tutorUserId}:${studentProfileId}`);
  }
  async listStaleAssignmentReminders() {
    return [];
  }
}
