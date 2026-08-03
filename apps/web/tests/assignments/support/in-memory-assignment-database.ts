import type {
  AssignmentDatabase,
  AssignmentListFilter,
  AssignmentRecord,
  AssignmentSummaryRecord,
  GradingRecord,
  RubricRecord,
  RubricScoreRecord,
  SubmissionAnswerRecord,
  SubmissionFileRecord,
  SubmissionRecord,
  TutorAssignmentFact,
  VirusScanStatus,
} from "../../../../../packages/domain/assignments/models";

export class InMemoryAssignmentDatabase implements AssignmentDatabase {
  readonly assignments = new Map<string, AssignmentRecord>();
  readonly submissions = new Map<string, SubmissionRecord>();
  readonly files = new Map<string, SubmissionFileRecord>();
  readonly rubrics = new Map<string, RubricRecord>();
  readonly gradings = new Map<string, GradingRecord>();
  readonly rubricScores = new Map<string, RubricScoreRecord[]>();
  /** `"tutorUserId:studentProfileId"` pairs with an active relationship — also drives {@link getTutorAssignmentFact}. */
  readonly tutorAssignments = new Set<string>();
  /** `"tutorUserId:studentProfileId"` pairs for a relationship fact that is not currently active (e.g. ended/rejected). */
  readonly inactiveTutorAssignmentFacts = new Map<string, TutorAssignmentFact>();
  /** `"parentUserId:studentProfileId"` pairs. */
  readonly parentLinks = new Set<string>();
  readonly studentProfiles = new Map<string, string>();
  readonly studentNames = new Map<string, string>();
  readonly subjectNames = new Map<string, string>();
  async transaction<T>(operation: (database: AssignmentDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async saveAssignment(assignment: AssignmentRecord) {
    this.assignments.set(assignment.id, assignment);
  }
  async getAssignment(assignmentId: string) {
    return this.assignments.get(assignmentId) ?? null;
  }
  async listAssignments(filter: AssignmentListFilter): Promise<AssignmentSummaryRecord[]> {
    const scope = filter.studentProfileIds === null ? null : new Set(filter.studentProfileIds);
    const rows = [...this.assignments.values()]
      .filter((assignment) => scope === null || scope.has(assignment.studentProfileId))
      .filter((assignment) => !filter.status || assignment.status === filter.status)
      .filter((assignment) => !filter.subjectId || assignment.subjectId === filter.subjectId)
      .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
      .filter((assignment) => !filter.cursor || assignment.id < filter.cursor)
      .slice(0, filter.limit);
    return rows.map((assignment) => {
      const submission = [...this.submissions.values()].find(
        (candidate) =>
          candidate.assignmentId === assignment.id &&
          candidate.studentProfileId === assignment.studentProfileId,
      );
      const grading = submission ? this.gradings.get(submission.id) : undefined;
      return {
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        dueAt: assignment.dueAt,
        maxScore: assignment.maxScore,
        studentProfileId: assignment.studentProfileId,
        studentName:
          this.studentNames.get(assignment.studentProfileId) ?? assignment.studentProfileId,
        subjectId: assignment.subjectId,
        subjectName: assignment.subjectId
          ? (this.subjectNames.get(assignment.subjectId) ?? null)
          : null,
        submissionStatus: submission?.status ?? null,
        score: grading?.score ?? null,
        createdAt: assignment.createdAt,
      };
    });
  }
  async updateAssignmentStatus(
    assignmentId: string,
    status: AssignmentRecord["status"],
    updatedAt: Date,
  ) {
    const assignment = this.assignments.get(assignmentId);
    if (assignment) this.assignments.set(assignmentId, { ...assignment, status, updatedAt });
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
  async listSubmissionFiles(submissionId: string) {
    return [...this.files.values()].filter((file) => file.submissionId === submissionId);
  }
  async updateSubmissionFileScanStatus(fileId: string, status: VirusScanStatus) {
    const file = this.files.get(fileId);
    if (file) this.files.set(fileId, { ...file, virusScanStatus: status });
  }
  async saveGrading(grading: GradingRecord) {
    this.gradings.set(grading.submissionId, grading);
  }
  async getGradingForSubmission(submissionId: string) {
    return this.gradings.get(submissionId) ?? null;
  }
  async replaceRubricScores(submissionId: string, scores: RubricScoreRecord[]) {
    this.rubricScores.set(submissionId, scores);
  }
  async listRubricScoresForSubmission(submissionId: string) {
    return this.rubricScores.get(submissionId) ?? [];
  }
  async saveRubric(rubric: RubricRecord) {
    this.rubrics.set(rubric.id, rubric);
  }
  async getRubric(rubricId: string) {
    return this.rubrics.get(rubricId) ?? null;
  }
  async listAssignmentRubrics() {
    return [...this.rubrics.values()]
      .filter((rubric) => rubric.scope === "assignment")
      .sort((a, b) => a.title.localeCompare(b.title));
  }
  async findStudentProfileIdByUserId(userId: string) {
    return this.studentProfiles.get(userId) ?? null;
  }
  async getStudentDisplayName(studentProfileId: string) {
    return this.studentNames.get(studentProfileId) ?? null;
  }
  async isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string) {
    return this.tutorAssignments.has(`${tutorUserId}:${studentProfileId}`);
  }
  async getTutorAssignmentFact(tutorUserId: string, studentProfileId: string) {
    const key = `${tutorUserId}:${studentProfileId}`;
    if (this.tutorAssignments.has(key)) return { status: "active" as const, endAt: null };
    return this.inactiveTutorAssignmentFacts.get(key) ?? null;
  }
  async isParentLinkedToStudent(parentUserId: string, studentProfileId: string) {
    return this.parentLinks.has(`${parentUserId}:${studentProfileId}`);
  }
  async listActiveStudentsForTutor(tutorUserId: string) {
    return [...this.tutorAssignments]
      .filter((key) => key.startsWith(`${tutorUserId}:`))
      .map((key) => {
        const studentProfileId = key.slice(tutorUserId.length + 1);
        return {
          studentProfileId,
          studentName: this.studentNames.get(studentProfileId) ?? studentProfileId,
        };
      });
  }
  async listLinkedStudentProfileIdsForParent(parentUserId: string) {
    return [...this.parentLinks]
      .filter((key) => key.startsWith(`${parentUserId}:`))
      .map((key) => key.slice(parentUserId.length + 1));
  }
  async listStaleAssignmentReminders() {
    return [];
  }
}
