import { ulid } from "ulid";
import { AssessmentError } from "./errors";
import { INTEGRITY_VIOLATION_EVENT_TYPES } from "./models";
import type {
  AssessmentActor,
  AssessmentAnswerRecord,
  AssessmentAttemptListPage,
  AssessmentAttemptRecord,
  AssessmentAttemptReview,
  AssessmentAttemptStatus,
  AssessmentDatabase,
  AssessmentEventRecord,
  AssessmentEventType,
  AssessmentEvidenceRecord,
  AssessmentNotifier,
  AssessmentRecord,
  AssessmentSession,
  AssessmentStudentOption,
  AssessmentSubjectOption,
  AssessmentVersionRecord,
  DiagnosticReportRecord,
} from "./models";
import { presentAssessmentQuestions } from "./randomization";
import {
  assessmentVersionInputSchema,
  attemptListSchema,
  consultationSchema,
  createAssessmentSchema,
  diagnosticReportSchema,
  EVIDENCE_CAPTURE_EVENT_TYPES,
  EVIDENCE_MAX_SIZE_BYTES,
  integritySignalBatchSchema,
  recordEvidenceSchema,
  saveAssessmentAnswerSchema,
  startAttemptSchema,
  submitAssessmentSchema,
  type AssessmentVersionInput,
  type AttemptListInput,
  type ConsultationInput,
  type CreateAssessmentInput,
  type DiagnosticReportInput,
  type IntegritySignalBatchInput,
  type IntegritySignalInput,
  type RecordEvidenceInput,
  type SaveAssessmentAnswerInput,
  type StartAttemptInput,
  type SubmitAssessmentInput,
} from "./schemas";
import type { AssessmentEvidenceStorage } from "./storage";
import { computeSuspicionSummary } from "./suspicion";

// Raised from 40 now that EVIDENCE_CAPTURE_EVENT_TYPES covers six trigger types instead of three
// (phone/unusual-item/eyes-closed added alongside the original face-tracking triggers) — more
// legitimate trigger types means the shared cap fills faster. Client-side per-type cooldowns
// (evidence-capture.ts) keep any one calmer signal from crowding out the higher-priority ones.
const MAX_EVIDENCE_PER_ATTEMPT = 60;
const EVIDENCE_FILE_KEY = "evidenceFileKey";
const EVIDENCE_MIME_KEY = "evidenceMimeType";
const EVIDENCE_SIZE_KEY = "evidenceSizeBytes";
const EVIDENCE_TRIGGER_KEY = "evidenceEventType";

function reviewUrl(attemptId: string): string {
  return `/assessments/attempts/${attemptId}/review`;
}

/** Default when a caller doesn't inject a real notifier (most tests, background jobs). */
const noopNotifier: AssessmentNotifier = { notify: async () => undefined };

/**
 * Best-effort: notifying the tutor is a side effect of the attempt closing, never a precondition
 * for it. A dispatcher misconfiguration, a missing recipient, or a queue outage must not turn into
 * a failed submission — the student's answers and honor statement are already durably saved by the
 * time this runs, so every failure here is caught and logged rather than rethrown.
 */
async function notifyAssignedTutors(
  database: AssessmentDatabase,
  notifier: AssessmentNotifier,
  attempt: AssessmentAttemptRecord,
): Promise<void> {
  if (attempt.proctorMode !== "camera_required") return;
  try {
    const tutorUserIds = await database.listAssignedTutorUserIds(attempt.studentProfileId);
    await Promise.all(
      tutorUserIds.map((userId) =>
        notifier.notify({
          userId,
          type: "progress_update",
          data: { actionUrl: reviewUrl(attempt.id) },
          relatedEntity: { type: "assessment_attempts", id: attempt.id },
        }),
      ),
    );
  } catch (error) {
    console.error(`Failed to notify tutors for assessment attempt "${attempt.id}".`, error);
  }
}

function hasRole(actor: AssessmentActor, ...roles: AssessmentActor["roles"][number][]) {
  return roles.some((role) => actor.roles.includes(role));
}

function requireActor(actor: AssessmentActor | null | undefined): asserts actor is AssessmentActor {
  if (!actor) throw new AssessmentError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}

function isStaff(actor: AssessmentActor) {
  return hasRole(actor, "administrator", "super_administrator");
}

function requireAuthor(actor: AssessmentActor) {
  if (!isStaff(actor) && !hasRole(actor, "tutor")) {
    throw new AssessmentError("FORBIDDEN", "Only teaching staff can author assessments.", 403);
  }
}

async function requireAssignedTutor(
  database: AssessmentDatabase,
  actor: AssessmentActor,
  studentProfileId: string,
) {
  if (isStaff(actor)) return;
  if (
    !hasRole(actor, "tutor") ||
    !(await database.isTutorAssignedToStudent(actor.userId, studentProfileId))
  ) {
    throw new AssessmentError("FORBIDDEN", "Only the assigned tutor can review this attempt.", 403);
  }
}

function requireStudent(actor: AssessmentActor): string {
  if (!hasRole(actor, "student") || !actor.studentProfileId) {
    throw new AssessmentError(
      "FORBIDDEN",
      "Only a student can start or answer an assessment.",
      403,
    );
  }
  return actor.studentProfileId;
}

function versionSettings(values: ReturnType<typeof assessmentVersionInputSchema.parse>) {
  return {
    durationSeconds: values.durationSeconds,
    fullscreenRequired: values.fullscreenRequired,
    randomizeQuestionOrder: values.randomizeQuestionOrder,
    poolSelections: values.poolSelections,
    camera: values.camera,
    audience: values.audience,
    maxAttempts: values.maxAttempts,
    integrityPolicy: values.integrityPolicy,
  };
}

/** A student is in scope for a version's audience — `"everyone"`, or explicitly named. */
function isInAudience(version: AssessmentVersionRecord, studentProfileId: string | undefined) {
  const audience = version.settings.audience;
  return audience.mode === "everyone" || (!!studentProfileId && audience.studentProfileIds.includes(studentProfileId));
}

/** Staff, or the assessment's own author — the same bar as creating a new version. */
export function canManageAssessment(actor: AssessmentActor, assessment: AssessmentRecord): boolean {
  return isStaff(actor) || assessment.createdByUserId === actor.userId;
}

function buildVersion(
  assessmentId: string,
  versionNumber: number,
  actor: AssessmentActor,
  input: AssessmentVersionInput,
  published: boolean,
  now: Date,
): AssessmentVersionRecord {
  const values = assessmentVersionInputSchema.parse(input);
  const versionId = ulid();
  return {
    id: versionId,
    assessmentId,
    versionNumber,
    changeSummary: values.changeSummary,
    settings: versionSettings(values),
    publishedAt: published ? now : null,
    createdByUserId: actor.userId,
    createdAt: now,
    questions: values.questions.map((question, orderIndex) => ({
      id: ulid(),
      assessmentVersionId: versionId,
      orderIndex,
      type: question.type,
      prompt: question.prompt,
      choices: question.choices,
      correctAnswer: question.correctAnswer,
      points: question.points,
      poolId: question.poolId,
      randomizeOptions: question.randomizeOptions,
      randomValues: question.randomValues,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

export async function createAssessment(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  input: CreateAssessmentInput,
): Promise<{ assessment: AssessmentRecord; version: AssessmentVersionRecord }> {
  requireActor(actor);
  requireAuthor(actor);
  const values = createAssessmentSchema.parse(input);
  const now = new Date();
  const assessment: AssessmentRecord = {
    id: ulid(),
    subjectId: values.subjectId,
    title: values.title,
    description: values.description,
    type: values.type,
    createdByUserId: actor.userId,
    status: values.status,
    createdAt: now,
    updatedAt: now,
  };
  const version = buildVersion(
    assessment.id,
    1,
    actor,
    values.version,
    values.status === "published",
    now,
  );
  await database.transaction(async (transaction) => {
    await transaction.saveAssessment(assessment);
    await transaction.saveVersion(version);
  });
  return { assessment, version };
}

export async function addAssessmentVersion(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  assessmentId: string,
  input: AssessmentVersionInput,
  publish = false,
): Promise<AssessmentVersionRecord> {
  requireActor(actor);
  requireAuthor(actor);
  const assessment = await database.getAssessment(assessmentId);
  if (!assessment)
    throw new AssessmentError("ASSESSMENT_NOT_FOUND", "Assessment was not found.", 404);
  if (!canManageAssessment(actor, assessment)) {
    throw new AssessmentError(
      "FORBIDDEN",
      "Only the assessment author can create a new version.",
      403,
    );
  }
  const latest = await database.getLatestVersion(assessmentId);
  const version = buildVersion(
    assessmentId,
    (latest?.versionNumber ?? 0) + 1,
    actor,
    input,
    publish,
    new Date(),
  );
  await database.transaction(async (transaction) => {
    await transaction.saveVersion(version);
    if (publish && assessment.status !== "published") {
      await transaction.saveAssessment({
        ...assessment,
        status: "published",
        updatedAt: new Date(),
      });
    }
  });
  return version;
}

/** Active subjects the actor may pick when authoring an assessment — the new-assessment form's subject picker. */
export async function listAssessableSubjects(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
): Promise<AssessmentSubjectOption[]> {
  requireActor(actor);
  requireAuthor(actor);
  return database.listActiveSubjects();
}

/** Students the actor may pick for a "selected students" audience — staff see everyone, a tutor sees their own roster. */
export async function listAssessableStudents(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
): Promise<AssessmentStudentOption[]> {
  requireActor(actor);
  requireAuthor(actor);
  return isStaff(actor)
    ? database.listAllActiveStudents()
    : database.listActiveStudentsForTutor(actor.userId);
}

export async function listAssessmentsForActor(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
): Promise<AssessmentRecord[]> {
  requireActor(actor);
  const assessments = (await database.listAssessments()).filter(
    (assessment) => assessment.status !== "archived",
  );
  if (isStaff(actor)) return assessments;
  if (hasRole(actor, "tutor")) {
    return assessments.filter(
      (assessment) =>
        assessment.status === "published" || assessment.createdByUserId === actor.userId,
    );
  }
  const published = assessments.filter((assessment) => assessment.status === "published");
  if (!hasRole(actor, "student")) return published;
  const visible: AssessmentRecord[] = [];
  for (const assessment of published) {
    const version = await database.getLatestPublishedVersion(assessment.id);
    if (version && isInAudience(version, actor.studentProfileId)) visible.push(assessment);
  }
  return visible;
}

export async function getAssessmentForActor(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  assessmentId: string,
): Promise<{ assessment: AssessmentRecord; version: AssessmentVersionRecord }> {
  requireActor(actor);
  const assessment = await database.getAssessment(assessmentId);
  if (!assessment)
    throw new AssessmentError("ASSESSMENT_NOT_FOUND", "Assessment was not found.", 404);
  const canSeeDraft = canManageAssessment(actor, assessment);
  if (assessment.status !== "published" && !canSeeDraft) {
    throw new AssessmentError("FORBIDDEN", "This assessment is not published.", 403);
  }
  const version = canSeeDraft
    ? await database.getLatestVersion(assessment.id)
    : await database.getLatestPublishedVersion(assessment.id);
  if (!version)
    throw new AssessmentError("VERSION_NOT_FOUND", "Assessment version was not found.", 404);
  if (!canSeeDraft && hasRole(actor, "student") && !isInAudience(version, actor.studentProfileId)) {
    throw new AssessmentError("FORBIDDEN", "This assessment is not assigned to you.", 403);
  }
  return { assessment, version };
}

/**
 * Soft delete: archives the assessment rather than removing rows, since attempts and diagnostic
 * reports (student educational history) may already reference it and `assessmentAttempts` has an
 * `onDelete: "restrict"` FK to `assessmentVersions` — a hard delete would throw once anyone has
 * taken it. Archived assessments drop out of every browsing list (`listAssessmentsForActor`) but
 * stay reachable by id for tutors/staff to review past attempts and reports.
 */
export async function deleteAssessment(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  assessmentId: string,
): Promise<void> {
  requireActor(actor);
  const assessment = await database.getAssessment(assessmentId);
  if (!assessment)
    throw new AssessmentError("ASSESSMENT_NOT_FOUND", "Assessment was not found.", 404);
  if (!canManageAssessment(actor, assessment)) {
    throw new AssessmentError("FORBIDDEN", "Only the assessment author can delete it.", 403);
  }
  if (assessment.status === "archived") return;
  await database.saveAssessment({ ...assessment, status: "archived", updatedAt: new Date() });
}

function event(
  attemptId: string,
  eventType: AssessmentEventType,
  occurredAt: Date,
  metadata: Record<string, unknown> | null = null,
): AssessmentEventRecord {
  return { id: ulid(), attemptId, eventType, occurredAt, metadata, createdAt: occurredAt };
}

function deadlineFor(version: AssessmentVersionRecord, startedAt: Date): Date | null {
  return version.settings.durationSeconds === null
    ? null
    : new Date(startedAt.getTime() + version.settings.durationSeconds * 1_000);
}

export async function startAssessmentAttempt(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  assessmentId: string,
  input: StartAttemptInput,
): Promise<AssessmentSession> {
  requireActor(actor);
  const studentProfileId = requireStudent(actor);
  const values = startAttemptSchema.parse(input);
  const assessment = await database.getAssessment(assessmentId);
  if (!assessment)
    throw new AssessmentError("ASSESSMENT_NOT_FOUND", "Assessment was not found.", 404);
  if (assessment.status !== "published") {
    throw new AssessmentError("ASSESSMENT_NOT_OPEN", "This assessment is not open.", 409);
  }
  const version = await database.getLatestPublishedVersion(assessment.id);
  if (!version?.publishedAt)
    throw new AssessmentError(
      "VERSION_NOT_FOUND",
      "A published assessment version was not found.",
      404,
    );

  if (!isInAudience(version, studentProfileId)) {
    throw new AssessmentError("FORBIDDEN", "This assessment is not assigned to you.", 403);
  }
  const maxAttempts = version.settings.maxAttempts;
  if (maxAttempts !== null) {
    const completed = await database.countCompletedAttemptsForStudent(
      assessment.id,
      studentProfileId,
    );
    if (completed >= maxAttempts) {
      throw new AssessmentError(
        "ATTEMPT_LIMIT_REACHED",
        `This assessment allows at most ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"}, and you have already completed that many.`,
        409,
      );
    }
  }

  const cameraPolicy = version.settings.camera;
  if (cameraPolicy.required) {
    if (!values.cameraConsent?.accepted) {
      throw new AssessmentError(
        "CAMERA_CONSENT_REQUIRED",
        "Explicit camera consent is required before this assessment can start.",
        409,
      );
    }
    if (values.cameraConsent.policyVersion !== cameraPolicy.policyVersion) {
      throw new AssessmentError(
        "CAMERA_POLICY_MISMATCH",
        "Camera consent does not match the current assessment policy.",
        409,
      );
    }
    if (
      !cameraPolicy.policyVersion ||
      !(await database.hasActiveCameraConsent(studentProfileId, cameraPolicy.policyVersion))
    ) {
      throw new AssessmentError(
        "CAMERA_CONSENT_REQUIRED",
        "An active consent record for the camera policy is required.",
        409,
      );
    }
  }

  const now = new Date();
  const attemptId = ulid();
  const seed = attemptId;
  const presented = presentAssessmentQuestions(version, seed);
  const attempt: AssessmentAttemptRecord = {
    id: attemptId,
    assessmentVersionId: version.id,
    studentProfileId,
    status: "in_progress",
    startedAt: now,
    submittedAt: null,
    score: null,
    maxScore: presented.reduce((sum, question) => sum + question.points, 0),
    proctorMode: cameraPolicy.required ? "camera_required" : "none",
    cameraConsentAt: cameraPolicy.required ? now : null,
    honorStatementAcceptedAt: null,
    randomizationSeed: seed,
    selectedQuestionIds: presented.map((question) => question.id),
    createdAt: now,
    updatedAt: now,
  };
  const answers: AssessmentAnswerRecord[] = presented.map((question) => ({
    id: ulid(),
    attemptId,
    questionId: question.id,
    answerText: null,
    timeSpentSeconds: null,
    answerChangeCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
  await database.transaction(async (transaction) => {
    await transaction.saveAttempt(attempt);
    for (const answer of answers) await transaction.saveAnswer(answer);
    await transaction.appendEvents([
      event(attemptId, "start", now, {
        noticeShown: true,
        selectedQuestionIds: attempt.selectedQuestionIds,
        randomizationSeed: seed,
        cameraConsentAt: attempt.cameraConsentAt?.toISOString() ?? null,
      }),
    ]);
  });
  return {
    assessment,
    version: { ...version, questions: undefined } as Omit<AssessmentVersionRecord, "questions">,
    attempt,
    questions: presented,
    answers,
    deadlineAt: deadlineFor(version, now),
  };
}

async function attemptContext(database: AssessmentDatabase, attemptId: string) {
  const attempt = await database.getAttempt(attemptId);
  if (!attempt)
    throw new AssessmentError("ATTEMPT_NOT_FOUND", "Assessment attempt was not found.", 404);
  const version = await database.getVersion(attempt.assessmentVersionId);
  if (!version)
    throw new AssessmentError("VERSION_NOT_FOUND", "Assessment version was not found.", 404);
  const assessment = await database.getAssessment(version.assessmentId);
  if (!assessment)
    throw new AssessmentError("ASSESSMENT_NOT_FOUND", "Assessment was not found.", 404);
  return { attempt, version, assessment };
}

function requireAttemptOwner(actor: AssessmentActor, attempt: AssessmentAttemptRecord) {
  const studentProfileId = requireStudent(actor);
  if (studentProfileId !== attempt.studentProfileId) {
    throw new AssessmentError(
      "FORBIDDEN",
      "This assessment attempt belongs to another student.",
      403,
    );
  }
}

function requireOpen(attempt: AssessmentAttemptRecord) {
  if (attempt.status !== "in_progress") {
    throw new AssessmentError(
      "ATTEMPT_NOT_OPEN",
      "This assessment attempt is no longer open.",
      409,
    );
  }
}

export async function getAssessmentSession(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
): Promise<AssessmentSession> {
  requireActor(actor);
  const { attempt, version, assessment } = await attemptContext(database, attemptId);
  requireAttemptOwner(actor, attempt);
  return {
    assessment,
    version: { ...version, questions: undefined } as Omit<AssessmentVersionRecord, "questions">,
    attempt,
    questions: presentAssessmentQuestions(
      version,
      attempt.randomizationSeed,
      attempt.selectedQuestionIds,
    ),
    answers: await database.listAnswers(attempt.id),
    deadlineAt: deadlineFor(version, attempt.startedAt),
  };
}

export async function saveAssessmentAnswer(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
  questionId: string,
  input: SaveAssessmentAnswerInput,
): Promise<AssessmentAnswerRecord> {
  requireActor(actor);
  const values = saveAssessmentAnswerSchema.parse(input);
  const { attempt, version } = await attemptContext(database, attemptId);
  requireAttemptOwner(actor, attempt);
  requireOpen(attempt);
  const deadline = deadlineFor(version, attempt.startedAt);
  if (deadline && Date.now() > deadline.getTime()) {
    throw new AssessmentError("TIME_EXPIRED", "The assessment time has elapsed.", 409);
  }
  if (!attempt.selectedQuestionIds.includes(questionId)) {
    throw new AssessmentError(
      "QUESTION_NOT_FOUND",
      "Question was not selected for this attempt.",
      404,
    );
  }
  const previous = await database.getAnswer(attempt.id, questionId);
  if (!previous)
    throw new AssessmentError("QUESTION_NOT_FOUND", "Assessment answer was not found.", 404);
  const now = new Date();
  const changed = previous.answerText !== null && previous.answerText !== values.answerText;
  const answer: AssessmentAnswerRecord = {
    ...previous,
    answerText: values.answerText,
    timeSpentSeconds: values.timeSpentSeconds,
    answerChangeCount: previous.answerChangeCount + (changed ? 1 : 0),
    updatedAt: now,
  };
  const events = [
    event(attempt.id, "answer_timestamp", now, { questionId }),
    ...(changed
      ? [
          event(attempt.id, "answer_change", now, {
            questionId,
            changeNumber: answer.answerChangeCount,
          }),
        ]
      : []),
  ];
  await database.transaction(async (transaction) => {
    await transaction.saveAnswer(answer);
    await transaction.appendEvents(events);
  });
  return answer;
}

/**
 * Guards (fullscreen/focus/shortcut/face-tracking listeners) can outlive the moment a student
 * submits — a keepalive request already in flight, or a listener that hasn't torn down yet. Once
 * an attempt is no longer open these are stale telemetry, not an error: skip silently rather than
 * rejecting, so a late signal never surfaces as a failure to the student.
 */
export interface RecordedAssessmentSignals {
  events: AssessmentEventRecord[];
  attemptStatus: AssessmentAttemptStatus;
}

export async function recordAssessmentSignals(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
  input: IntegritySignalBatchInput,
  notifier: AssessmentNotifier = noopNotifier,
): Promise<RecordedAssessmentSignals> {
  requireActor(actor);
  const values = integritySignalBatchSchema.parse(input);
  const { attempt, version } = await attemptContext(database, attemptId);
  requireAttemptOwner(actor, attempt);
  if (attempt.status !== "in_progress") return { events: [], attemptStatus: attempt.status };
  const occurredAt = new Date();
  const recorded = values.signals.map((signal) =>
    event(attempt.id, signal.eventType, occurredAt, {
      ...signal.metadata,
      clientOccurredAt: signal.clientOccurredAt,
    }),
  );
  await database.appendEvents(recorded);

  /**
   * `"auto_submit"` is the only tier enforced here — a tutor-configured, disclosed exception to
   * the "signals never gate submission" default (see `AssessmentIntegrityPolicy` in models.ts).
   * `"warn"` is enforced client-side only (see `use-exam-proctoring.ts`); `"log_only"` (the
   * default) leaves this branch dormant so every pre-existing assessment behaves identically.
   */
  const { violationLimit, action } = version.settings.integrityPolicy;
  if (action === "auto_submit" && violationLimit !== null) {
    const allEvents = await database.listEvents(attempt.id);
    const violationCount = allEvents.filter((item) =>
      INTEGRITY_VIOLATION_EVENT_TYPES.includes(item.eventType),
    ).length;
    if (violationCount >= violationLimit) {
      const closedAt = new Date();
      const closed: AssessmentAttemptRecord = { ...attempt, status: "abandoned", updatedAt: closedAt };
      await database.transaction(async (transaction) => {
        await transaction.saveAttempt(closed);
        await transaction.appendEvents([
          event(attempt.id, "end", closedAt, {
            submission: "integrity_policy_auto_submit",
            violationCount,
            violationLimit,
          }),
        ]);
      });
      await notifyAssignedTutors(database, notifier, closed);
      return { events: recorded, attemptStatus: "abandoned" };
    }
  }
  return { events: recorded, attemptStatus: "in_progress" };
}

/** Single-signal convenience wrapper over {@link recordAssessmentSignals}. */
export async function recordAssessmentSignal(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
  input: IntegritySignalInput,
  notifier: AssessmentNotifier = noopNotifier,
): Promise<AssessmentEventRecord | null> {
  const { events } = await recordAssessmentSignals(
    database,
    actor,
    attemptId,
    { signals: [input] },
    notifier,
  );
  return events[0] ?? null;
}

function isJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Records one evidence photo, captured client-side when an `EVIDENCE_CAPTURE_EVENT_TYPES` signal
 * fires — see README "Camera boundary". The underlying `assessment_events` row this appends
 * always carries `eventType: "evidence_captured"`, never the triggering type (`multiple_faces`
 * etc., which travels in `metadata[EVIDENCE_TRIGGER_KEY]` instead): both `computeSuspicionSummary`
 * and the review stats bucket purely by `eventType`, so reusing the triggering type here would
 * silently double-count every photographed violation.
 */
export async function recordAssessmentEvidence(
  database: AssessmentDatabase,
  storage: AssessmentEvidenceStorage,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
  input: RecordEvidenceInput,
  bytes: Uint8Array,
): Promise<AssessmentEvidenceRecord> {
  requireActor(actor);
  const values = recordEvidenceSchema.parse(input);
  const { attempt, version } = await attemptContext(database, attemptId);
  requireAttemptOwner(actor, attempt);
  requireOpen(attempt);
  if (!version.settings.camera.evidenceCaptureEnabled) {
    throw new AssessmentError(
      "EVIDENCE_NOT_ENABLED",
      "This assessment version does not have evidence capture enabled.",
      409,
    );
  }
  if (
    !EVIDENCE_CAPTURE_EVENT_TYPES.includes(values.eventType) ||
    values.sizeBytes !== bytes.byteLength ||
    bytes.byteLength > EVIDENCE_MAX_SIZE_BYTES ||
    !isJpegSignature(bytes)
  ) {
    throw new AssessmentError(
      "INVALID_INPUT",
      "The uploaded evidence file is not a valid JPEG image.",
      415,
    );
  }
  const existingEvents = await database.listEvents(attempt.id);
  const evidenceCount = existingEvents.filter(
    (item) => item.eventType === "evidence_captured",
  ).length;
  if (evidenceCount >= MAX_EVIDENCE_PER_ATTEMPT) {
    throw new AssessmentError(
      "EVIDENCE_LIMIT_REACHED",
      "This attempt has already reached its evidence capture limit.",
      409,
    );
  }
  const now = new Date();
  const id = ulid();
  const key = `assessments/evidence/${attempt.id}/${id}.jpg`;
  await storage.putPrivate({
    key,
    body: bytes,
    mimeType: values.mimeType,
    metadata: { attemptId: attempt.id, eventType: values.eventType },
  });
  const evidenceEvent: AssessmentEventRecord = {
    id,
    attemptId: attempt.id,
    eventType: "evidence_captured",
    occurredAt: now,
    metadata: {
      [EVIDENCE_TRIGGER_KEY]: values.eventType,
      [EVIDENCE_FILE_KEY]: key,
      [EVIDENCE_MIME_KEY]: values.mimeType,
      [EVIDENCE_SIZE_KEY]: values.sizeBytes,
    },
    createdAt: now,
  };
  await database.appendEvents([evidenceEvent]);
  return { id: evidenceEvent.id, eventType: values.eventType, capturedAt: now };
}

/** Resolves a signed evidence URL to its private storage key, enforcing the same tutor/staff
 * authorization {@link getAssessmentAttemptReview} uses — evidence is never actor-self-servable. */
export async function getAssessmentEvidenceForActor(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
  evidenceId: string,
): Promise<{ fileKey: string; mimeType: string }> {
  requireActor(actor);
  const { attempt } = await attemptContext(database, attemptId);
  await requireAssignedTutor(database, actor, attempt.studentProfileId);
  const events = await database.listEvents(attempt.id);
  const found = events.find(
    (item) => item.id === evidenceId && item.eventType === "evidence_captured",
  );
  const fileKey = found?.metadata?.[EVIDENCE_FILE_KEY];
  const mimeType = found?.metadata?.[EVIDENCE_MIME_KEY];
  if (typeof fileKey !== "string" || typeof mimeType !== "string") {
    throw new AssessmentError("EVIDENCE_NOT_FOUND", "Evidence photo was not found.", 404);
  }
  return { fileKey, mimeType };
}

export async function submitAssessmentAttempt(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
  input: SubmitAssessmentInput,
  notifier: AssessmentNotifier = noopNotifier,
): Promise<AssessmentAttemptRecord> {
  requireActor(actor);
  const values = submitAssessmentSchema.parse(input);
  if (!values.honorStatementAccepted) {
    throw new AssessmentError(
      "HONOR_STATEMENT_REQUIRED",
      "Accept the honor statement before submitting.",
      409,
    );
  }
  const { attempt } = await attemptContext(database, attemptId);
  requireAttemptOwner(actor, attempt);
  requireOpen(attempt);
  const now = new Date();
  const submitted: AssessmentAttemptRecord = {
    ...attempt,
    status: "submitted",
    submittedAt: now,
    honorStatementAcceptedAt: now,
    updatedAt: now,
  };
  await database.transaction(async (transaction) => {
    await transaction.saveAttempt(submitted);
    await transaction.appendEvents([
      event(attempt.id, "end", now, { submission: "student_confirmed" }),
    ]);
  });
  await notifyAssignedTutors(database, notifier, submitted);
  return submitted;
}

function countEvents(events: AssessmentEventRecord[]) {
  return events.reduce<Partial<Record<AssessmentEventType, number>>>((counts, item) => {
    counts[item.eventType] = (counts[item.eventType] ?? 0) + 1;
    return counts;
  }, {});
}

/** Pure derivation over the event log, same discipline as {@link computeSuspicionSummary} —
 * evidence is never stored separately from the `"evidence_captured"` rows that carry it. */
function extractEvidence(events: AssessmentEventRecord[]): AssessmentEvidenceRecord[] {
  return events
    .filter((item): item is AssessmentEventRecord => item.eventType === "evidence_captured")
    .map((item) => {
      const triggerType = item.metadata?.[EVIDENCE_TRIGGER_KEY];
      return {
        id: item.id,
        eventType: (typeof triggerType === "string" ? triggerType : item.eventType) as AssessmentEventType,
        capturedAt: item.occurredAt,
      };
    });
}

export async function getAssessmentAttemptReview(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
): Promise<AssessmentAttemptReview> {
  requireActor(actor);
  const { attempt, version, assessment } = await attemptContext(database, attemptId);
  await requireAssignedTutor(database, actor, attempt.studentProfileId);
  const events = await database.listEvents(attempt.id);
  return {
    assessment,
    version,
    attempt,
    answers: await database.listAnswers(attempt.id),
    events,
    eventCounts: countEvents(events),
    suspicion: computeSuspicionSummary(events),
    evidence: extractEvidence(events),
    report: await database.getDiagnosticReportForAttempt(attempt.id),
  };
}

/**
 * The tutor-facing "did this student finish, and was anything flagged" list (spec §16). Staff see
 * every attempt on the assessment; a tutor sees only attempts by their own assigned students —
 * the same scoping {@link requireAssignedTutor} applies per-attempt, applied here as a list filter.
 */
export async function listAssessmentAttemptsForActor(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  assessmentId: string,
  input: AttemptListInput,
): Promise<AssessmentAttemptListPage> {
  requireActor(actor);
  if (!isStaff(actor) && !hasRole(actor, "tutor")) {
    throw new AssessmentError("FORBIDDEN", "Only teaching staff can review attempts.", 403);
  }
  const assessment = await database.getAssessment(assessmentId);
  if (!assessment)
    throw new AssessmentError("ASSESSMENT_NOT_FOUND", "Assessment was not found.", 404);
  const values = attemptListSchema.parse(input);
  const rows = await database.listAttemptsForAssessment(assessmentId, {
    tutorUserId: isStaff(actor) ? null : actor.userId,
    cursor: values.cursor,
    limit: values.limit + 1,
  });
  const page = rows.slice(0, values.limit);
  const items = await Promise.all(
    page.map(async (row) => ({
      ...row,
      suspicion: computeSuspicionSummary(await database.listEvents(row.id)),
    })),
  );
  return { items, nextCursor: rows.length > values.limit ? (page.at(-1)?.id ?? null) : null };
}

export async function writeDiagnosticReport(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  attemptId: string,
  input: DiagnosticReportInput,
): Promise<DiagnosticReportRecord> {
  requireActor(actor);
  const values = diagnosticReportSchema.parse(input);
  const { attempt, assessment } = await attemptContext(database, attemptId);
  await requireAssignedTutor(database, actor, attempt.studentProfileId);
  if (attempt.status === "in_progress") {
    throw new AssessmentError(
      "ATTEMPT_NOT_OPEN",
      "Finish the assessment attempt before writing its report.",
      409,
    );
  }
  const existing = await database.getDiagnosticReportForAttempt(attempt.id);
  const now = new Date();
  const reportChanged =
    existing !== null &&
    (existing.summary !== values.summary ||
      existing.strengths !== values.strengths ||
      existing.gaps !== values.gaps ||
      existing.recommendedNextSteps !== values.recommendedNextSteps);
  const report: DiagnosticReportRecord = {
    id: existing?.id ?? ulid(),
    assessmentAttemptId: attempt.id,
    studentProfileId: attempt.studentProfileId,
    subjectId: assessment.subjectId,
    summary: values.summary,
    strengths: values.strengths,
    gaps: values.gaps,
    recommendedNextSteps: values.recommendedNextSteps,
    writtenByUserId: actor.userId,
    writtenAt: now,
    consultationAt: reportChanged ? null : (existing?.consultationAt ?? null),
    releasedToParentAt: reportChanged ? null : (existing?.releasedToParentAt ?? null),
    createdAt: existing?.createdAt ?? now,
  };
  await database.saveDiagnosticReport(report);
  return report;
}

async function reportForTutor(
  database: AssessmentDatabase,
  actor: AssessmentActor,
  reportId: string,
): Promise<DiagnosticReportRecord> {
  const report = await database.getDiagnosticReport(reportId);
  if (!report)
    throw new AssessmentError("REPORT_NOT_FOUND", "Diagnostic report was not found.", 404);
  await requireAssignedTutor(database, actor, report.studentProfileId);
  return report;
}

export async function recordDiagnosticConsultation(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  reportId: string,
  input: ConsultationInput,
): Promise<DiagnosticReportRecord> {
  requireActor(actor);
  const values = consultationSchema.parse(input);
  const report = await reportForTutor(database, actor, reportId);
  const consultedAt = values.consultedAt ? new Date(values.consultedAt) : new Date();
  if (consultedAt.getTime() > Date.now() + 5 * 60 * 1_000) {
    throw new AssessmentError("INVALID_INPUT", "Consultation time cannot be in the future.");
  }
  const updated = { ...report, consultationAt: consultedAt };
  await database.saveDiagnosticReport(updated);
  return updated;
}

export async function releaseDiagnosticReport(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  reportId: string,
): Promise<DiagnosticReportRecord> {
  requireActor(actor);
  const report = await reportForTutor(database, actor, reportId);
  if (!report.consultationAt) {
    throw new AssessmentError(
      "CONSULTATION_REQUIRED",
      "Record the parent consultation before releasing this report.",
      409,
    );
  }
  const released = { ...report, releasedToParentAt: report.releasedToParentAt ?? new Date() };
  await database.saveDiagnosticReport(released);
  return released;
}

export async function getDiagnosticReportForActor(
  database: AssessmentDatabase,
  actor: AssessmentActor | null | undefined,
  reportId: string,
): Promise<DiagnosticReportRecord> {
  requireActor(actor);
  const report = await database.getDiagnosticReport(reportId);
  if (!report)
    throw new AssessmentError("REPORT_NOT_FOUND", "Diagnostic report was not found.", 404);
  if (
    isStaff(actor) ||
    (hasRole(actor, "tutor") &&
      (await database.isTutorAssignedToStudent(actor.userId, report.studentProfileId)))
  ) {
    return report;
  }
  if (
    !hasRole(actor, "parent") ||
    !(await database.isParentLinkedToStudent(actor.userId, report.studentProfileId))
  ) {
    throw new AssessmentError("FORBIDDEN", "This report is not available to this account.", 403);
  }
  if (!report.releasedToParentAt) {
    throw new AssessmentError(
      "REPORT_NOT_RELEASED",
      "This report will be available after the tutor consultation.",
      409,
    );
  }
  return report;
}

export async function closeExpiredAssessmentAttempts(
  database: AssessmentDatabase,
  now = new Date(),
  limit = 250,
): Promise<number> {
  // Give a learner time to read and accept the honor statement after the answering clock stops.
  const submissionGraceMs = 15 * 60 * 1_000;
  const attempts = await database.listExpiredAttempts(
    new Date(now.getTime() - submissionGraceMs),
    Math.max(1, Math.min(limit, 1_000)),
  );
  for (const attempt of attempts) {
    await database.transaction(async (transaction) => {
      await transaction.saveAttempt({ ...attempt, status: "abandoned", updatedAt: now });
      await transaction.appendEvents([
        event(attempt.id, "end", now, { submission: "closed_after_time_elapsed" }),
      ]);
    });
  }
  return attempts.length;
}
