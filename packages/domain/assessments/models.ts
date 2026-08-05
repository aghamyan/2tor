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
  | "answer_change"
  | "browser_minimized"
  | "cut_attempt"
  | "select_all_attempt"
  | "print_attempt"
  | "save_attempt"
  | "view_source_attempt"
  | "context_menu_attempt"
  | "drag_attempt"
  | "devtools_shortcut"
  | "camera_ready"
  | "camera_disconnected"
  | "face_missing"
  | "face_returned"
  | "multiple_faces"
  | "gaze_away"
  | "external_device_suspected"
  | "warning_shown";

export type StudentDetectableEventType =
  | "focus_loss"
  | "fullscreen_exit"
  | "tab_switch"
  | "connectivity_interruption"
  | "copy_attempt"
  | "paste_attempt"
  | "browser_minimized"
  | "cut_attempt"
  | "select_all_attempt"
  | "print_attempt"
  | "save_attempt"
  | "view_source_attempt"
  | "context_menu_attempt"
  | "drag_attempt"
  | "devtools_shortcut"
  | "camera_ready"
  | "camera_disconnected"
  | "face_missing"
  | "face_returned"
  | "multiple_faces"
  | "gaze_away"
  | "external_device_suspected";

/**
 * The "left the exam" cluster a tutor's integrity policy counts against — deliberately narrower
 * than every `StudentDetectableEventType`: it excludes benign/neutral signals (`camera_ready`,
 * `face_returned`, `connectivity_interruption`) that would otherwise trip an honest student's
 * count. Matches the same cluster `DEFAULT_SUSPICION_WEIGHTS` in suspicion.ts treats as the core
 * "stepped away from the assessment" signals.
 */
export const INTEGRITY_VIOLATION_EVENT_TYPES: readonly AssessmentEventType[] = [
  "tab_switch",
  "focus_loss",
  "fullscreen_exit",
  "browser_minimized",
];

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

/** Who may start an attempt. `"everyone"` matches this slice's long-standing default behavior. */
export type AssessmentAudience =
  | { mode: "everyone" }
  | { mode: "selected"; studentProfileIds: string[] };

export type IntegrityPolicyAction = "log_only" | "warn" | "auto_submit";

/**
 * A tutor-configured, disclosed, opt-in response to the "left the exam" event cluster
 * (`INTEGRITY_VIOLATION_EVENT_TYPES`) — distinct from the always-on suspicion score, which never
 * gates anything (see README "Signals are not proof"). `violationLimit: null` (the default)
 * preserves that exact contract: nothing automated happens. Setting a limit only ever takes
 * effect for `"warn"` (client-shown notice) or `"auto_submit"` (server ends the attempt), and the
 * student sees the configured policy before starting — see `entry.notice`.
 */
export interface AssessmentIntegrityPolicy {
  violationLimit: number | null;
  action: IntegrityPolicyAction;
}

export interface AssessmentVersionSettings {
  durationSeconds: number | null;
  fullscreenRequired: boolean;
  randomizeQuestionOrder: boolean;
  poolSelections: Record<string, number>;
  camera: {
    required: boolean;
    policyVersion: string | null;
    /** Opt-in, client-side-only face presence/count/gaze checks — see README "Camera boundary". */
    headTrackingEnabled: boolean;
  };
  audience: AssessmentAudience;
  /** Null means unlimited. Counts only `submitted`/`graded` attempts — see services.ts. */
  maxAttempts: number | null;
  integrityPolicy: AssessmentIntegrityPolicy;
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

/**
 * A review signal, never a verdict — see packages/domain/assessments/README.md "Signals are not
 * proof". Tutors see this alongside answers; nothing here sets a status flag or blocks submission.
 */
export interface SuspicionBreakdownEntry {
  eventType: AssessmentEventType;
  count: number;
  points: number;
}

export type SuspicionSeverity = "low" | "medium" | "high";

export interface SuspicionSummary {
  score: number;
  severity: SuspicionSeverity;
  breakdown: SuspicionBreakdownEntry[];
  stats: {
    /** null when no face-presence signals were ever recorded (camera not required, or head tracking off). */
    faceVisiblePercent: number | null;
    tabSwitchCount: number;
    fullscreenExitCount: number;
    copyAttemptCount: number;
    pasteAttemptCount: number;
    cameraDisconnectCount: number;
    multipleFacesCount: number;
    warningCount: number;
    totalDurationSeconds: number | null;
  };
}

export interface AssessmentAttemptReview {
  assessment: AssessmentRecord;
  version: AssessmentVersionRecord;
  attempt: AssessmentAttemptRecord;
  answers: AssessmentAnswerRecord[];
  events: AssessmentEventRecord[];
  eventCounts: Partial<Record<AssessmentEventType, number>>;
  suspicion: SuspicionSummary;
  report: DiagnosticReportRecord | null;
}

export interface AssessmentSubjectOption {
  id: string;
  name: string;
}

/** One row in a tutor's or staff member's "assign to these students" picker. */
export interface AssessmentStudentOption {
  studentProfileId: string;
  studentName: string;
}

/** One row in the tutor-facing "did this student finish, and was anything flagged" list. */
export interface AssessmentAttemptListItem {
  id: string;
  studentProfileId: string;
  studentName: string;
  status: AssessmentAttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  proctorMode: "none" | "camera_required";
}

export interface AssessmentAttemptListEntry extends AssessmentAttemptListItem {
  suspicion: SuspicionSummary;
}

export interface AssessmentAttemptListPage {
  items: AssessmentAttemptListEntry[];
  nextCursor: string | null;
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
  /** `tutorUserId: null` means unrestricted (staff); otherwise scoped to that tutor's assigned students. */
  listAttemptsForAssessment(
    assessmentId: string,
    options: { tutorUserId: string | null; cursor: string | null; limit: number },
  ): Promise<AssessmentAttemptListItem[]>;

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

  listActiveSubjects(): Promise<AssessmentSubjectOption[]>;

  /** Powers the "assign to specific students" picker for a tutor authoring an assessment. */
  listActiveStudentsForTutor(tutorUserId: string): Promise<AssessmentStudentOption[]>;
  /** Same picker, for staff authoring an assessment not scoped to one tutor's roster. */
  listAllActiveStudents(): Promise<AssessmentStudentOption[]>;
  /**
   * How many of this student's attempts on this assessment (any version) already reached
   * `submitted`/`graded` — the basis for `maxAttempts`. Deliberately excludes `in_progress`/
   * `abandoned` so a reload or a dropped connection never burns part of a student's allowance.
   */
  countCompletedAttemptsForStudent(assessmentId: string, studentProfileId: string): Promise<number>;
}
