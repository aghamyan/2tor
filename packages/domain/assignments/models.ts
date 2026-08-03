export type AssignmentRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";
export type AssignmentStatus = "draft" | "published" | "closed";
export type AssignmentQuestionType =
  "short_answer" | "multiple_choice" | "file_upload" | "essay" | "code";
export type SubmissionStatus = "not_started" | "in_progress" | "submitted" | "graded" | "returned";
export type VirusScanStatus = "pending" | "clean" | "infected" | "error";
export type TutorAssignmentRelationStatus = "proposed" | "active" | "ended" | "rejected";

export interface AssignmentActor {
  userId: string;
  roles: readonly AssignmentRole[];
  studentProfileId?: string;
}

export interface AssignmentQuestionRecord {
  id: string;
  assignmentId: string;
  orderIndex: number;
  type: AssignmentQuestionType;
  prompt: string;
  options: { key: string; label: string }[] | null;
  points: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentRecord {
  id: string;
  createdByUserId: string;
  studentProfileId: string;
  subjectId: string | null;
  lessonId: string | null;
  title: string;
  instructions: string | null;
  dueAt: Date | null;
  status: AssignmentStatus;
  maxScore: number | null;
  questions: AssignmentQuestionRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionAnswerRecord {
  id: string;
  submissionId: string;
  questionId: string;
  answerText: string | null;
  selectedOptionKey: string | null;
  pointsAwarded: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionRecord {
  id: string;
  assignmentId: string;
  studentProfileId: string;
  status: SubmissionStatus;
  attemptNumber: number;
  submittedAt: Date | null;
  answers: SubmissionAnswerRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionFileRecord {
  id: string;
  submissionId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  virusScanStatus: VirusScanStatus;
  uploadedAt: Date;
}

export interface GradingRecord {
  id: string;
  submissionId: string;
  gradedByUserId: string;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  gradedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RubricRecord {
  id: string;
  title: string;
  description: string | null;
  createdByUserId: string;
  subjectId: string | null;
  scope: "assignment" | "project";
  createdAt: Date;
  updatedAt: Date;
}

export interface RubricScoreRecord {
  id: string;
  rubricId: string;
  submissionId: string;
  criterionKey: string;
  criterionLabel: string;
  scoreValue: number;
  maxValue: number;
  comments: string | null;
  scoredByUserId: string;
  scoredAt: Date;
  createdAt: Date;
}

export interface AssignmentListFilter {
  /** `null` means no student restriction (staff, sees every assignment). Never `[]` reaching the DB — callers short-circuit an empty scope before querying. */
  studentProfileIds: string[] | null;
  status?: AssignmentStatus;
  subjectId?: string;
  cursor?: string | null;
  limit: number;
}

export interface AssignmentSummaryRecord {
  id: string;
  title: string;
  status: AssignmentStatus;
  dueAt: Date | null;
  maxScore: number | null;
  studentProfileId: string;
  studentName: string;
  subjectId: string | null;
  subjectName: string | null;
  submissionStatus: SubmissionStatus | null;
  score: number | null;
  createdAt: Date;
}

export interface AssignmentPage {
  items: AssignmentSummaryRecord[];
  nextCursor: string | null;
}

export interface TutorAssignmentFact {
  status: TutorAssignmentRelationStatus;
  endAt: Date | null;
}

export interface AssignmentDatabase {
  transaction<T>(operation: (database: AssignmentDatabase) => Promise<T>): Promise<T>;
  saveAssignment(assignment: AssignmentRecord): Promise<void>;
  getAssignment(assignmentId: string): Promise<AssignmentRecord | null>;
  listAssignments(filter: AssignmentListFilter): Promise<AssignmentSummaryRecord[]>;
  updateAssignmentStatus(
    assignmentId: string,
    status: AssignmentStatus,
    updatedAt: Date,
  ): Promise<void>;
  saveSubmission(submission: SubmissionRecord): Promise<void>;
  getSubmission(submissionId: string): Promise<SubmissionRecord | null>;
  getSubmissionForAssignmentStudent(
    assignmentId: string,
    studentProfileId: string,
  ): Promise<SubmissionRecord | null>;
  replaceSubmissionAnswers(submissionId: string, answers: SubmissionAnswerRecord[]): Promise<void>;
  saveSubmissionFile(file: SubmissionFileRecord): Promise<void>;
  getSubmissionFile(fileId: string): Promise<SubmissionFileRecord | null>;
  listSubmissionFiles(submissionId: string): Promise<SubmissionFileRecord[]>;
  updateSubmissionFileScanStatus(fileId: string, status: VirusScanStatus): Promise<void>;
  saveGrading(grading: GradingRecord): Promise<void>;
  getGradingForSubmission(submissionId: string): Promise<GradingRecord | null>;
  replaceRubricScores(submissionId: string, scores: RubricScoreRecord[]): Promise<void>;
  listRubricScoresForSubmission(submissionId: string): Promise<RubricScoreRecord[]>;
  saveRubric(rubric: RubricRecord): Promise<void>;
  getRubric(rubricId: string): Promise<RubricRecord | null>;
  listAssignmentRubrics(): Promise<RubricRecord[]>;
  findStudentProfileIdByUserId(userId: string): Promise<string | null>;
  getStudentDisplayName(studentProfileId: string): Promise<string | null>;
  isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string): Promise<boolean>;
  /** The raw relationship fact, for the web-boundary `@app/auth` `authorize()` gate — see `apps/web/app/(app)/assignments/authorization.ts`. */
  getTutorAssignmentFact(
    tutorUserId: string,
    studentProfileId: string,
  ): Promise<TutorAssignmentFact | null>;
  isParentLinkedToStudent(parentUserId: string, studentProfileId: string): Promise<boolean>;
  /** Also powers the "create assignment" student picker, hence the display name alongside each id. */
  listActiveStudentsForTutor(
    tutorUserId: string,
  ): Promise<{ studentProfileId: string; studentName: string }[]>;
  listLinkedStudentProfileIdsForParent(parentUserId: string): Promise<string[]>;
  listStaleAssignmentReminders(
    before: Date,
    limit: number,
  ): Promise<
    { assignmentId: string; studentProfileId: string; studentUserId: string; dueAt: Date }[]
  >;
}
