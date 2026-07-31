export type AssignmentRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";
export type AssignmentStatus = "draft" | "published" | "closed";
export type AssignmentQuestionType =
  "short_answer" | "multiple_choice" | "file_upload" | "essay" | "code";
export type SubmissionStatus = "not_started" | "in_progress" | "submitted" | "graded" | "returned";
export type VirusScanStatus = "pending" | "clean" | "infected" | "error";

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

export interface AssignmentDatabase {
  transaction<T>(operation: (database: AssignmentDatabase) => Promise<T>): Promise<T>;
  saveAssignment(assignment: AssignmentRecord): Promise<void>;
  getAssignment(assignmentId: string): Promise<AssignmentRecord | null>;
  saveSubmission(submission: SubmissionRecord): Promise<void>;
  getSubmission(submissionId: string): Promise<SubmissionRecord | null>;
  getSubmissionForAssignmentStudent(
    assignmentId: string,
    studentProfileId: string,
  ): Promise<SubmissionRecord | null>;
  replaceSubmissionAnswers(submissionId: string, answers: SubmissionAnswerRecord[]): Promise<void>;
  saveSubmissionFile(file: SubmissionFileRecord): Promise<void>;
  getSubmissionFile(fileId: string): Promise<SubmissionFileRecord | null>;
  updateSubmissionFileScanStatus(fileId: string, status: VirusScanStatus): Promise<void>;
  saveGrading(grading: GradingRecord): Promise<void>;
  replaceRubricScores(submissionId: string, scores: RubricScoreRecord[]): Promise<void>;
  saveRubric(rubric: RubricRecord): Promise<void>;
  getRubric(rubricId: string): Promise<RubricRecord | null>;
  findStudentProfileIdByUserId(userId: string): Promise<string | null>;
  isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string): Promise<boolean>;
  listStaleAssignmentReminders(
    before: Date,
    limit: number,
  ): Promise<
    { assignmentId: string; studentProfileId: string; studentUserId: string; dueAt: Date }[]
  >;
}
