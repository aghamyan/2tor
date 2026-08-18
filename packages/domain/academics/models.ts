export type AcademicRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface AcademicActor {
  userId: string;
  roles: readonly AcademicRole[];
  /** Present for a student viewing their own record. */
  studentProfileId?: string;
}

export type PlanItemType = "focus_area" | "module_topic" | "target_outcome";
export type PlanItemStatus = "planned" | "in_progress" | "completed";
export type PlanApprovalStatus = "not_required" | "pending" | "approved" | "changes_requested";
export type FeedbackObjectiveMet = "yes" | "partly" | "no";
export type AssignmentStatus = "not_applicable" | "complete" | "partial" | "incomplete";
export type Confidence = "low" | "medium" | "high";
export type MilestoneStatus = "not_started" | "in_progress" | "at_risk" | "completed" | "abandoned";
export type MilestoneCategory =
  | "academic_mastery"
  | "assignment_consistency"
  | "attendance_consistency"
  | "independent_problem_solving"
  | "project_completion"
  | "communication_presentation"
  | "exam_readiness"
  | "armenian_reading"
  | "armenian_speaking"
  | "programming_project"
  | "personal_confidence"
  | "other";
export type EvidenceType =
  "assignment_result" | "project_rubric" | "tutor_observation" | "assessment" | "file";
export type ProgressTrend = "improving" | "steady" | "declining" | "insufficient_data";

export interface LearningPlanItem {
  type: PlanItemType;
  title: string;
  description: string | null;
  orderIndex: number;
  status: PlanItemStatus;
  /** Exam goals are tracked explicitly so dropping one cannot silently take effect. */
  isExamGoal: boolean;
}

export interface LearningPlanSnapshot {
  title: string;
  startDate: string;
  reviewDate: string | null;
  mainGoal: string;
  parentGoal: string | null;
  studentGoal: string | null;
  tutorGoal: string | null;
  currentBaseline: string | null;
  expectedLessonFrequency: string | null;
  homeworkExpectations: string | null;
  projectWork: string | null;
  items: LearningPlanItem[];
}

export interface LearningPlanRecord {
  id: string;
  studentProfileId: string;
  subjectId: string;
  authorUserId: string;
  activeSnapshot: LearningPlanSnapshot;
  activeVersionNumber: number;
  parentApprovalStatus: PlanApprovalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningPlanVersionRecord {
  id: string;
  learningPlanId: string;
  versionNumber: number;
  snapshot: LearningPlanSnapshot;
  changeSummary: string;
  isMajorChange: boolean;
  effective: boolean;
  createdByUserId: string;
  createdAt: Date;
  acknowledgedByUserId: string | null;
  acknowledgedAt: Date | null;
}

export interface LessonFeedbackRecord {
  id: string;
  lessonId: string;
  studentProfileId: string;
  topicsCovered: string;
  objectiveMet: FeedbackObjectiveMet;
  assignmentCompletionStatus: AssignmentStatus;
  assignmentAccuracyNote: string | null;
  effortEngagementNote: string;
  strengthsDemonstrated: string;
  skillsToImprove: string;
  nextLessonFocus: string;
  assignedHomework: string;
  parentActionNeeded: string;
  studentActionNeeded: string;
  milestoneProgressNote: string;
  tutorConfidence: Confidence;
  freeTextComment: string;
  /** Never return this field from a parent/student projection. */
  staffOnlyNote: string | null;
  /** Tutor-selected recipients — independently controls whether a linked parent or the student themself can view this record. Not mutually exclusive: both may be true. */
  visibleToParent: boolean;
  visibleToStudent: boolean;
  status: "draft" | "published" | "revised";
  createdByUserId: string;
  createdAt: Date;
}

export type ParentVisibleFeedback = Omit<LessonFeedbackRecord, "staffOnlyNote">;

export interface MilestoneEvidenceRecord {
  id: string;
  milestoneId: string;
  evidenceType: EvidenceType;
  referenceId: string | null;
  fileKey: string | null;
  description: string;
  createdByUserId: string;
  createdAt: Date;
}

export interface MilestoneRecord {
  id: string;
  studentProfileId: string;
  subjectId: string | null;
  learningPlanId: string | null;
  category: MilestoneCategory;
  objective: string;
  baseline: string | null;
  target: string;
  targetDate: string | null;
  progressPercentage: number;
  status: MilestoneStatus;
  parentVisibleStatus: string;
  completedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SkillMasteryStatus =
  | "mastered"
  | "secure"
  | "developing"
  | "needs_attention"
  | "not_demonstrated"
  | "not_assessed"
  | "in_progress"
  | "upcoming";
export type SkillEvidenceType =
  "tutor_observation" | "homework" | "lesson_activity" | "diagnostic" | "assessment";
/** `automatic` is reserved for a future graded-homework integration; nothing writes it yet. */
export type SkillCalculationMethod = "tutor" | "automatic";
export type SkillTrend = "up" | "down" | "steady" | "new";

export interface SubjectRecord {
  id: string;
  name: string;
}

export interface CourseRecord {
  id: string;
  subjectId: string;
  code: string | null;
  title: string;
  description: string | null;
  level: string | null;
  gradeLabel: string | null;
  hours: number | null;
  isGroup: boolean;
}

export interface CurriculumUnitRecord {
  id: string;
  courseId: string;
  orderIndex: number;
  nameEn: string;
  nameHy: string | null;
  lessons: number | null;
  note: string | null;
}

/** The codebase's "topic" table — see `discussion_questions.topicId` in the DB schema. */
export interface SkillRecord {
  id: string;
  subjectId: string | null;
  unitId: string | null;
  orderIndex: number;
  code: string | null;
  key: string;
  name: string;
  description: string | null;
  masteryCriteria: string[];
  misconceptions: Array<{ issue: string; response: string }>;
  createdByUserId: string | null;
}

/** Append-only. One row per tutor-recorded (or future automatic) observation of a skill. */
export interface SkillAssessmentEventRecord {
  id: string;
  studentProfileId: string;
  skillId: string;
  lessonId: string | null;
  feedbackId: string | null;
  /** Numeric-string, 0.0-10.0 (matches the `numeric` column convention elsewhere in this domain). */
  score: string | null;
  /** Always tutor-selected — never derived from `score` (spec: no fabricated judgment). */
  status: SkillMasteryStatus;
  confidence: Confidence | null;
  evidenceType: SkillEvidenceType;
  calculationMethod: SkillCalculationMethod;
  note: string | null;
  visibleToParent: boolean;
  visibleToStudent: boolean;
  recordedByUserId: string;
  createdAt: Date;
}

/** Maintained rollup of `SkillAssessmentEventRecord` — mirrors the gamification points-ledger/balance split. */
export interface StudentSkillRecord {
  id: string;
  studentProfileId: string;
  skillId: string;
  status: SkillMasteryStatus;
  score: string | null;
  confidence: Confidence | null;
  trend: SkillTrend;
  evidenceCount: number;
  /** Denormalized from the latest event's `note`. */
  lastNote: string | null;
  visibleToParent: boolean;
  visibleToStudent: boolean;
  lastAssessedAt: Date | null;
  lastEventId: string | null;
  updatedAt: Date;
}

export interface ProgressReviewRecord {
  id: string;
  studentProfileId: string;
  subjectId: string | null;
  periodStart: string;
  periodEnd: string;
  summary: string;
  progressTrend: ProgressTrend;
  evidenceNotes: string;
  reviewedByUserId: string;
  sharedWithParentAt: Date | null;
  createdAt: Date;
}

export interface AcademicDatabase {
  transaction<T>(operation: (database: AcademicDatabase) => Promise<T>): Promise<T>;
  getLearningPlan(id: string): Promise<LearningPlanRecord | null>;
  saveLearningPlan(plan: LearningPlanRecord): Promise<void>;
  listPlanVersions(planId: string): Promise<LearningPlanVersionRecord[]>;
  savePlanVersion(version: LearningPlanVersionRecord): Promise<void>;
  getPlanVersion(planId: string, versionNumber: number): Promise<LearningPlanVersionRecord | null>;
  saveFeedback(feedback: LessonFeedbackRecord): Promise<void>;
  getFeedback(id: string): Promise<LessonFeedbackRecord | null>;
  listFeedbackForStudent(studentProfileId: string): Promise<LessonFeedbackRecord[]>;
  /** The most recent non-draft feedback recorded for a lesson, or `null` if none exists yet — backs the Classes page's lesson-detail view. */
  getFeedbackForLesson(lessonId: string): Promise<LessonFeedbackRecord | null>;
  saveMilestone(milestone: MilestoneRecord): Promise<void>;
  getMilestone(id: string): Promise<MilestoneRecord | null>;
  saveMilestoneEvidence(evidence: MilestoneEvidenceRecord): Promise<void>;
  listMilestoneEvidence(milestoneId: string): Promise<MilestoneEvidenceRecord[]>;
  saveProgressReview(review: ProgressReviewRecord): Promise<void>;
  isParentLinkedToStudent(parentUserId: string, studentProfileId: string): Promise<boolean>;
  isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string): Promise<boolean>;
  findStudentProfileIdByUserId(userId: string): Promise<string | null>;
  /** Active subjects — reference data available to any authenticated actor, not scheduling-scoped. */
  listSubjects(): Promise<SubjectRecord[]>;
  listCoursesForSubject(subjectId: string): Promise<CourseRecord[]>;
  listCurriculumUnits(courseId: string): Promise<CurriculumUnitRecord[]>;
  listSkillsForSubject(subjectId: string): Promise<SkillRecord[]>;
  getSkill(skillId: string): Promise<SkillRecord | null>;
  saveSkill(skill: SkillRecord): Promise<void>;
  listSkillPrerequisiteIds(skillId: string): Promise<string[]>;
  saveSkillPrerequisite(skillId: string, prerequisiteSkillId: string): Promise<void>;
  listStudentSkillRecords(studentProfileId: string, subjectId: string): Promise<StudentSkillRecord[]>;
  getStudentSkillRecord(
    studentProfileId: string,
    skillId: string,
  ): Promise<StudentSkillRecord | null>;
  upsertStudentSkillRecord(record: StudentSkillRecord): Promise<void>;
  saveSkillAssessmentEvent(event: SkillAssessmentEventRecord): Promise<void>;
  listSkillAssessmentEvents(
    studentProfileId: string,
    skillId: string,
  ): Promise<SkillAssessmentEventRecord[]>;
  /** Most recent events across every skill in a subject — backs the mastery timeline view. */
  listRecentSkillAssessmentEvents(
    studentProfileId: string,
    subjectId: string,
    limit: number,
  ): Promise<SkillAssessmentEventRecord[]>;
}
