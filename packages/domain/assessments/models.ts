export type AssessmentRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface AssessmentActor {
  userId: string;
  roles: readonly AssessmentRole[];
  studentProfileId?: string;
}

export type AssessmentType = "diagnostic" | "quiz" | "exam" | "practice";
export type AssessmentStatus = "draft" | "published" | "archived";
export type AssessmentQuestionType =
  "multiple_choice" | "short_answer" | "numeric" | "essay" | "code";
export type AssessmentAttemptStatus = "in_progress" | "submitted" | "graded" | "abandoned";

export type AssessmentEventType =
  | "start"
  | "end"
  | "answer_timestamp"
  | "focus_loss"
  | "fullscreen_exit"
  | "tab_switch"
  | "connectivity_interruption"
  | "copy_attempt"
  | "paste_attempt"
  | "answer_change";

export type StudentDetectableEventType =
  | "focus_loss"
  | "fullscreen_exit"
  | "tab_switch"
  | "connectivity_interruption"
  | "copy_attempt"
  | "paste_attempt";

export interface RandomValueRule {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface AssessmentChoice {
  key: string;
  label: string;
}

export interface AssessmentQuestionRecord {
  id: string;
  assessmentVersionId: string;
  orderIndex: number;
  type: AssessmentQuestionType;
  prompt: string;
  choices: AssessmentChoice[] | null;
  correctAnswer: string | null;
  points: number;
  poolId: string | null;
  randomizeOptions: boolean;
  randomValues: RandomValueRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentVersionSettings {
  durationSeconds: number | null;
  fullscreenRequired: boolean;
  randomizeQuestionOrder: boolean;
  poolSelections: Record<string, number>;
  camera: {
    required: boolean;
    policyVersion: string | null;
  };
}

export interface AssessmentVersionRecord {
  id: string;
  assessmentId: string;
  versionNumber: number;
  changeSummary: string | null;
  settings: AssessmentVersionSettings;
  publishedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  questions: AssessmentQuestionRecord[];
}

export interface AssessmentRecord {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  type: AssessmentType;
  createdByUserId: string;
  status: AssessmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentAnswerRecord {
  id: string;
  attemptId: string;
  questionId: string;
  answerText: string | null;
  timeSpentSeconds: number | null;
  answerChangeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentAttemptRecord {
  id: string;
  assessmentVersionId: string;
  studentProfileId: string;
  status: AssessmentAttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  proctorMode: "none" | "camera_required";
  cameraConsentAt: Date | null;
  honorStatementAcceptedAt: Date | null;
  randomizationSeed: string;
  selectedQuestionIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentEventRecord {
  id: string;
  attemptId: string;
  eventType: AssessmentEventType;
  occurredAt: Date;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface DiagnosticReportRecord {
  id: string;
  assessmentAttemptId: string;
  studentProfileId: string;
  subjectId: string | null;
  summary: string;
  strengths: string | null;
  gaps: string | null;
  recommendedNextSteps: string | null;
  writtenByUserId: string;
  writtenAt: Date;
  consultationAt: Date | null;
  releasedToParentAt: Date | null;
  createdAt: Date;
}

export interface PresentedQuestion {
  id: string;
  orderIndex: number;
  type: AssessmentQuestionType;
  prompt: string;
  choices: AssessmentChoice[] | null;
  points: number;
}

export interface AssessmentSession {
  assessment: AssessmentRecord;
  version: Omit<AssessmentVersionRecord, "questions">;
  attempt: AssessmentAttemptRecord;
  questions: PresentedQuestion[];
  answers: AssessmentAnswerRecord[];
  deadlineAt: Date | null;
}

export interface AssessmentAttemptReview {
  assessment: AssessmentRecord;
  version: AssessmentVersionRecord;
  attempt: AssessmentAttemptRecord;
  answers: AssessmentAnswerRecord[];
  events: AssessmentEventRecord[];
  eventCounts: Partial<Record<AssessmentEventType, number>>;
  report: DiagnosticReportRecord | null;
}

export interface AssessmentDatabase {
  transaction<T>(operation: (database: AssessmentDatabase) => Promise<T>): Promise<T>;

  saveAssessment(assessment: AssessmentRecord): Promise<void>;
  getAssessment(assessmentId: string): Promise<AssessmentRecord | null>;
  listAssessments(): Promise<AssessmentRecord[]>;

  saveVersion(version: AssessmentVersionRecord): Promise<void>;
  getVersion(versionId: string): Promise<AssessmentVersionRecord | null>;
  getLatestVersion(assessmentId: string): Promise<AssessmentVersionRecord | null>;
  getLatestPublishedVersion(assessmentId: string): Promise<AssessmentVersionRecord | null>;

  saveAttempt(attempt: AssessmentAttemptRecord): Promise<void>;
  getAttempt(attemptId: string): Promise<AssessmentAttemptRecord | null>;
  listExpiredAttempts(now: Date, limit: number): Promise<AssessmentAttemptRecord[]>;

  saveAnswer(answer: AssessmentAnswerRecord): Promise<void>;
  getAnswer(attemptId: string, questionId: string): Promise<AssessmentAnswerRecord | null>;
  listAnswers(attemptId: string): Promise<AssessmentAnswerRecord[]>;

  appendEvents(events: AssessmentEventRecord[]): Promise<void>;
  listEvents(attemptId: string): Promise<AssessmentEventRecord[]>;

  hasActiveCameraConsent(studentProfileId: string, policyVersion: string): Promise<boolean>;
  isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string): Promise<boolean>;
  isParentLinkedToStudent(parentUserId: string, studentProfileId: string): Promise<boolean>;
  findStudentProfileIdByUserId(userId: string): Promise<string | null>;

  saveDiagnosticReport(report: DiagnosticReportRecord): Promise<void>;
  getDiagnosticReport(reportId: string): Promise<DiagnosticReportRecord | null>;
  getDiagnosticReportForAttempt(attemptId: string): Promise<DiagnosticReportRecord | null>;
}
