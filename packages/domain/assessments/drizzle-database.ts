import {
  assessmentAnswers,
  assessmentAttempts,
  assessmentEvents,
  assessmentQuestions,
  assessments,
  assessmentVersions,
  consentRecords,
  diagnosticReports,
  parentProfiles,
  parentStudentLinks,
  studentProfiles,
  subjects,
  tutorProfiles,
  tutorStudentAssignments,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import type {
  AssessmentAnswerRecord,
  AssessmentAttemptListItem,
  AssessmentAttemptRecord,
  AssessmentAudience,
  AssessmentDatabase,
  AssessmentEventRecord,
  AssessmentEventType,
  AssessmentIntegrityPolicy,
  AssessmentQuestionRecord,
  AssessmentRecord,
  AssessmentStudentOption,
  AssessmentSubjectOption,
  AssessmentVersionRecord,
  AssessmentVersionSettings,
  DiagnosticReportRecord,
} from "./models";

type Executor = Database | Transaction;

const VERSION_ENVELOPE_PREFIX = "2TOR_ASSESSMENT_VERSION_V1:";
const REPORT_ENVELOPE_PREFIX = "2TOR_DIAGNOSTIC_REPORT_V1:";
const EVENT_TYPE_KEY = "__assessmentEventType";

const defaultAudience: AssessmentAudience = { mode: "everyone" };
const defaultIntegrityPolicy: AssessmentIntegrityPolicy = { violationLimit: null, action: "log_only" };

const defaultSettings: AssessmentVersionSettings = {
  durationSeconds: null,
  fullscreenRequired: false,
  randomizeQuestionOrder: true,
  poolSelections: {},
  camera: { required: false, policyVersion: null, headTrackingEnabled: false },
  audience: defaultAudience,
  maxAttempts: null,
  integrityPolicy: defaultIntegrityPolicy,
};

function decodeAudience(value: unknown): AssessmentAudience {
  if (
    typeof value === "object" &&
    value !== null &&
    (value as { mode?: unknown }).mode === "selected" &&
    Array.isArray((value as { studentProfileIds?: unknown }).studentProfileIds)
  ) {
    const studentProfileIds = (value as { studentProfileIds: unknown[] }).studentProfileIds.filter(
      (id): id is string => typeof id === "string",
    );
    if (studentProfileIds.length > 0) return { mode: "selected", studentProfileIds };
  }
  return defaultAudience;
}

function decodeIntegrityPolicy(value: unknown): AssessmentIntegrityPolicy {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const violationLimit = typeof record.violationLimit === "number" ? record.violationLimit : null;
  const action = record.action === "warn" || record.action === "auto_submit" ? record.action : "log_only";
  return violationLimit === null ? { violationLimit: null, action: "log_only" } : { violationLimit, action };
}

function numeric(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function encodeVersion(version: AssessmentVersionRecord): string {
  return `${VERSION_ENVELOPE_PREFIX}${JSON.stringify({
    changeSummary: version.changeSummary,
    settings: version.settings,
  })}`;
}

function decodeVersion(value: string | null): {
  changeSummary: string | null;
  settings: AssessmentVersionSettings;
} {
  if (!value?.startsWith(VERSION_ENVELOPE_PREFIX)) {
    return { changeSummary: value, settings: defaultSettings };
  }
  try {
    const parsed = JSON.parse(value.slice(VERSION_ENVELOPE_PREFIX.length)) as {
      changeSummary?: unknown;
      settings?: Partial<AssessmentVersionSettings>;
    };
    const settings = parsed.settings ?? {};
    return {
      changeSummary: typeof parsed.changeSummary === "string" ? parsed.changeSummary : null,
      settings: {
        durationSeconds:
          typeof settings.durationSeconds === "number" ? settings.durationSeconds : null,
        fullscreenRequired: settings.fullscreenRequired === true,
        randomizeQuestionOrder: settings.randomizeQuestionOrder !== false,
        poolSelections:
          typeof settings.poolSelections === "object" && settings.poolSelections !== null
            ? settings.poolSelections
            : {},
        camera: {
          required: settings.camera?.required === true,
          policyVersion:
            typeof settings.camera?.policyVersion === "string"
              ? settings.camera.policyVersion
              : null,
          headTrackingEnabled: settings.camera?.headTrackingEnabled === true,
        },
        audience: decodeAudience(settings.audience),
        maxAttempts: typeof settings.maxAttempts === "number" ? settings.maxAttempts : null,
        integrityPolicy: decodeIntegrityPolicy(settings.integrityPolicy),
      },
    };
  } catch {
    return { changeSummary: null, settings: defaultSettings };
  }
}

function mapAssessment(row: typeof assessments.$inferSelect): AssessmentRecord {
  return {
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    description: row.description,
    type: row.type,
    createdByUserId: row.createdByUserId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapQuestion(row: typeof assessmentQuestions.$inferSelect): AssessmentQuestionRecord {
  const options =
    typeof row.options === "object" && row.options !== null && !Array.isArray(row.options)
      ? (row.options as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    assessmentVersionId: row.assessmentVersionId,
    orderIndex: row.orderIndex,
    type: row.type,
    prompt: row.prompt,
    choices: Array.isArray(options.choices)
      ? (options.choices as AssessmentQuestionRecord["choices"])
      : Array.isArray(row.options)
        ? (row.options as AssessmentQuestionRecord["choices"])
        : null,
    correctAnswer: row.correctAnswer,
    points: Number(row.points),
    poolId: typeof options.poolId === "string" ? options.poolId : null,
    randomizeOptions:
      typeof options.randomizeOptions === "boolean" ? options.randomizeOptions : row.randomizeOrder,
    randomValues: Array.isArray(options.randomValues)
      ? (options.randomValues as AssessmentQuestionRecord["randomValues"])
      : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The Postgres enum predates this proctoring extension (spec §2-16) and only the assessments
 * module owns its schema file — see README "Existing-schema compatibility". Rather than a
 * migration, every canonical type below rides in an existing bucket and the true type travels in
 * `metadata[EVENT_TYPE_KEY]`; `mapEvent` always reconstructs the canonical value for callers.
 */
function rawEventType(
  eventType: AssessmentEventType,
): typeof assessmentEvents.$inferInsert.eventType {
  switch (eventType) {
    case "start":
    case "end":
      return "submitted";
    case "answer_timestamp":
      return "answer_change";
    case "connectivity_interruption":
    case "camera_ready":
    case "camera_disconnected":
    case "face_missing":
    case "face_returned":
    case "multiple_faces":
    case "gaze_away":
    case "external_device_suspected":
      return "tab_switch";
    case "browser_minimized":
    case "warning_shown":
      return "focus_loss";
    case "cut_attempt":
    case "select_all_attempt":
    case "print_attempt":
    case "save_attempt":
    case "view_source_attempt":
    case "devtools_shortcut":
      return "copy_attempt";
    case "context_menu_attempt":
    case "drag_attempt":
      return "paste_attempt";
    default:
      return eventType;
  }
}

const CANONICAL_EVENT_TYPES: readonly AssessmentEventType[] = [
  "start",
  "end",
  "answer_timestamp",
  "focus_loss",
  "fullscreen_exit",
  "tab_switch",
  "connectivity_interruption",
  "copy_attempt",
  "paste_attempt",
  "answer_change",
  "browser_minimized",
  "cut_attempt",
  "select_all_attempt",
  "print_attempt",
  "save_attempt",
  "view_source_attempt",
  "context_menu_attempt",
  "drag_attempt",
  "devtools_shortcut",
  "camera_ready",
  "camera_disconnected",
  "face_missing",
  "face_returned",
  "multiple_faces",
  "gaze_away",
  "external_device_suspected",
  "warning_shown",
];

function isEventType(value: unknown): value is AssessmentEventType {
  return CANONICAL_EVENT_TYPES.includes(value as AssessmentEventType);
}

function mapEvent(row: typeof assessmentEvents.$inferSelect): AssessmentEventRecord {
  const metadata =
    typeof row.metadata === "object" && row.metadata !== null && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  const canonical = isEventType(metadata[EVENT_TYPE_KEY])
    ? metadata[EVENT_TYPE_KEY]
    : row.eventType === "submitted"
      ? "end"
      : row.eventType;
  delete metadata[EVENT_TYPE_KEY];
  return {
    id: row.id,
    attemptId: row.attemptId,
    eventType: canonical,
    occurredAt: row.occurredAt,
    metadata: Object.keys(metadata).length ? metadata : null,
    createdAt: row.createdAt,
  };
}

function mapAnswer(row: typeof assessmentAnswers.$inferSelect): AssessmentAnswerRecord {
  return {
    id: row.id,
    attemptId: row.attemptId,
    questionId: row.questionId,
    answerText: row.answerText,
    timeSpentSeconds: row.timeSpentSeconds,
    answerChangeCount: row.answerChangeCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function encodeReport(report: DiagnosticReportRecord): string {
  return `${REPORT_ENVELOPE_PREFIX}${JSON.stringify({
    summary: report.summary,
    consultationAt: report.consultationAt?.toISOString() ?? null,
    releasedToParentAt: report.releasedToParentAt?.toISOString() ?? null,
  })}`;
}

function decodeReportSummary(value: string) {
  if (!value.startsWith(REPORT_ENVELOPE_PREFIX)) {
    return { summary: value, consultationAt: null, releasedToParentAt: null };
  }
  try {
    const parsed = JSON.parse(value.slice(REPORT_ENVELOPE_PREFIX.length)) as {
      summary?: unknown;
      consultationAt?: unknown;
      releasedToParentAt?: unknown;
    };
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      consultationAt:
        typeof parsed.consultationAt === "string" ? new Date(parsed.consultationAt) : null,
      releasedToParentAt:
        typeof parsed.releasedToParentAt === "string" ? new Date(parsed.releasedToParentAt) : null,
    };
  } catch {
    return { summary: value, consultationAt: null, releasedToParentAt: null };
  }
}

function mapReport(row: typeof diagnosticReports.$inferSelect): DiagnosticReportRecord {
  const lifecycle = decodeReportSummary(row.summary);
  return {
    id: row.id,
    assessmentAttemptId: row.assessmentAttemptId,
    studentProfileId: row.studentProfileId,
    subjectId: row.subjectId,
    summary: lifecycle.summary,
    strengths: row.strengths,
    gaps: row.gaps,
    recommendedNextSteps: row.recommendedNextSteps,
    writtenByUserId: row.generatedByUserId ?? "",
    writtenAt: row.generatedAt,
    consultationAt: lifecycle.consultationAt,
    releasedToParentAt: lifecycle.releasedToParentAt,
    createdAt: row.createdAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): AssessmentDatabase {
  async function loadVersion(
    row: typeof assessmentVersions.$inferSelect,
  ): Promise<AssessmentVersionRecord> {
    const configuration = decodeVersion(row.changeSummary);
    const questionRows = await executor
      .select()
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.assessmentVersionId, row.id))
      .orderBy(asc(assessmentQuestions.orderIndex));
    return {
      id: row.id,
      assessmentId: row.assessmentId,
      versionNumber: row.versionNumber,
      changeSummary: configuration.changeSummary,
      settings: configuration.settings,
      publishedAt: row.publishedAt,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      questions: questionRows.map(mapQuestion),
    };
  }

  return {
    async transaction<T>(operation: (database: AssessmentDatabase) => Promise<T>) {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async saveAssessment(assessment) {
      const [existing] = await executor
        .select({ id: assessments.id })
        .from(assessments)
        .where(eq(assessments.id, assessment.id))
        .limit(1);
      if (existing) {
        await executor
          .update(assessments)
          .set({
            title: assessment.title,
            description: assessment.description,
            status: assessment.status,
            updatedAt: assessment.updatedAt,
          })
          .where(eq(assessments.id, assessment.id));
      } else {
        await executor.insert(assessments).values(assessment);
      }
    },

    async getAssessment(assessmentId) {
      const [row] = await executor
        .select()
        .from(assessments)
        .where(eq(assessments.id, assessmentId))
        .limit(1);
      return row ? mapAssessment(row) : null;
    },

    async listAssessments() {
      const rows = await executor.select().from(assessments).orderBy(desc(assessments.updatedAt));
      return rows.map(mapAssessment);
    },

    async saveVersion(version) {
      await executor.insert(assessmentVersions).values({
        id: version.id,
        assessmentId: version.assessmentId,
        versionNumber: version.versionNumber,
        changeSummary: encodeVersion(version),
        publishedAt: version.publishedAt,
        createdByUserId: version.createdByUserId,
        createdAt: version.createdAt,
      });
      await executor.insert(assessmentQuestions).values(
        version.questions.map((question) => ({
          id: question.id,
          assessmentVersionId: version.id,
          orderIndex: question.orderIndex,
          type: question.type,
          prompt: question.prompt,
          options: {
            choices: question.choices,
            poolId: question.poolId,
            randomizeOptions: question.randomizeOptions,
            randomValues: question.randomValues,
          },
          correctAnswer: question.correctAnswer,
          points: String(question.points),
          randomizeOrder: question.randomizeOptions,
          createdAt: question.createdAt,
          updatedAt: question.updatedAt,
        })),
      );
    },

    async getVersion(versionId) {
      const [row] = await executor
        .select()
        .from(assessmentVersions)
        .where(eq(assessmentVersions.id, versionId))
        .limit(1);
      return row ? loadVersion(row) : null;
    },

    async getLatestVersion(assessmentId) {
      const [row] = await executor
        .select()
        .from(assessmentVersions)
        .where(eq(assessmentVersions.assessmentId, assessmentId))
        .orderBy(desc(assessmentVersions.versionNumber))
        .limit(1);
      return row ? loadVersion(row) : null;
    },

    async getLatestPublishedVersion(assessmentId) {
      const [row] = await executor
        .select()
        .from(assessmentVersions)
        .where(
          and(
            eq(assessmentVersions.assessmentId, assessmentId),
            isNotNull(assessmentVersions.publishedAt),
          ),
        )
        .orderBy(desc(assessmentVersions.versionNumber))
        .limit(1);
      return row ? loadVersion(row) : null;
    },

    async saveAttempt(attempt) {
      const [existing] = await executor
        .select({ id: assessmentAttempts.id })
        .from(assessmentAttempts)
        .where(eq(assessmentAttempts.id, attempt.id))
        .limit(1);
      const mutable = {
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        score: attempt.score === null ? null : String(attempt.score),
        maxScore: attempt.maxScore === null ? null : String(attempt.maxScore),
        proctorMode: attempt.proctorMode,
        honorStatementAcceptedAt: attempt.honorStatementAcceptedAt,
        updatedAt: attempt.updatedAt,
      };
      if (existing) {
        await executor
          .update(assessmentAttempts)
          .set(mutable)
          .where(eq(assessmentAttempts.id, attempt.id));
      } else {
        await executor.insert(assessmentAttempts).values({
          id: attempt.id,
          assessmentVersionId: attempt.assessmentVersionId,
          studentProfileId: attempt.studentProfileId,
          startedAt: attempt.startedAt,
          createdAt: attempt.createdAt,
          ...mutable,
        });
      }
    },

    async getAttempt(attemptId) {
      const [row] = await executor
        .select()
        .from(assessmentAttempts)
        .where(eq(assessmentAttempts.id, attemptId))
        .limit(1);
      if (!row) return null;
      const answerRows = await executor
        .select()
        .from(assessmentAnswers)
        .where(eq(assessmentAnswers.attemptId, row.id))
        .orderBy(asc(assessmentAnswers.createdAt));
      const eventRows = await executor
        .select()
        .from(assessmentEvents)
        .where(eq(assessmentEvents.attemptId, row.id))
        .orderBy(asc(assessmentEvents.occurredAt));
      const startEvent = eventRows.map(mapEvent).find((item) => item.eventType === "start");
      const selectedQuestionIds = Array.isArray(startEvent?.metadata?.selectedQuestionIds)
        ? startEvent.metadata.selectedQuestionIds.filter(
            (value): value is string => typeof value === "string",
          )
        : answerRows.map((answer) => answer.questionId);
      const cameraConsent =
        typeof startEvent?.metadata?.cameraConsentAt === "string"
          ? new Date(startEvent.metadata.cameraConsentAt)
          : null;
      return {
        id: row.id,
        assessmentVersionId: row.assessmentVersionId,
        studentProfileId: row.studentProfileId,
        status: row.status,
        startedAt: row.startedAt,
        submittedAt: row.submittedAt,
        score: numeric(row.score),
        maxScore: numeric(row.maxScore),
        proctorMode: row.proctorMode,
        cameraConsentAt: cameraConsent,
        honorStatementAcceptedAt: row.honorStatementAcceptedAt,
        randomizationSeed:
          typeof startEvent?.metadata?.randomizationSeed === "string"
            ? startEvent.metadata.randomizationSeed
            : row.id,
        selectedQuestionIds,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies AssessmentAttemptRecord;
    },

    async listExpiredAttempts(now, limit) {
      const rows = await executor
        .select()
        .from(assessmentAttempts)
        .where(eq(assessmentAttempts.status, "in_progress"))
        .orderBy(asc(assessmentAttempts.startedAt))
        .limit(limit * 4);
      const expired: AssessmentAttemptRecord[] = [];
      for (const row of rows) {
        const attempt = await this.getAttempt(row.id);
        if (!attempt) continue;
        const version = await this.getVersion(attempt.assessmentVersionId);
        if (
          version &&
          version.settings.durationSeconds !== null &&
          attempt.startedAt.getTime() + version.settings.durationSeconds * 1_000 < now.getTime()
        ) {
          expired.push(attempt);
          if (expired.length >= limit) break;
        }
      }
      return expired;
    },

    async listAttemptsForAssessment(assessmentId, options) {
      const versionRows = await executor
        .select({ id: assessmentVersions.id })
        .from(assessmentVersions)
        .where(eq(assessmentVersions.assessmentId, assessmentId));
      const versionIds = versionRows.map((row) => row.id);
      if (versionIds.length === 0) return [];

      const conditions = [inArray(assessmentAttempts.assessmentVersionId, versionIds)];
      if (options.cursor) conditions.push(lt(assessmentAttempts.id, options.cursor));

      if (options.tutorUserId) {
        const assignmentRows = await executor
          .select({ studentProfileId: tutorStudentAssignments.studentProfileId })
          .from(tutorStudentAssignments)
          .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
          .where(
            and(
              eq(tutorProfiles.userId, options.tutorUserId),
              eq(tutorStudentAssignments.status, "active"),
            ),
          );
        const tutorStudentIds = assignmentRows.map((row) => row.studentProfileId);
        if (tutorStudentIds.length === 0) return [];
        conditions.push(inArray(assessmentAttempts.studentProfileId, tutorStudentIds));
      }

      const rows = await executor
        .select({
          id: assessmentAttempts.id,
          studentProfileId: assessmentAttempts.studentProfileId,
          studentName: studentProfiles.preferredName,
          status: assessmentAttempts.status,
          startedAt: assessmentAttempts.startedAt,
          submittedAt: assessmentAttempts.submittedAt,
          score: assessmentAttempts.score,
          maxScore: assessmentAttempts.maxScore,
          proctorMode: assessmentAttempts.proctorMode,
        })
        .from(assessmentAttempts)
        .innerJoin(studentProfiles, eq(studentProfiles.id, assessmentAttempts.studentProfileId))
        .where(and(...conditions))
        .orderBy(desc(assessmentAttempts.id))
        .limit(options.limit);

      return rows.map(
        (row): AssessmentAttemptListItem => ({
          ...row,
          score: numeric(row.score),
          maxScore: numeric(row.maxScore),
        }),
      );
    },

    async saveAnswer(answer) {
      const [existing] = await executor
        .select({ id: assessmentAnswers.id })
        .from(assessmentAnswers)
        .where(
          and(
            eq(assessmentAnswers.attemptId, answer.attemptId),
            eq(assessmentAnswers.questionId, answer.questionId),
          ),
        )
        .limit(1);
      const mutable = {
        answerText: answer.answerText,
        timeSpentSeconds: answer.timeSpentSeconds,
        answerChangeCount: answer.answerChangeCount,
        updatedAt: answer.updatedAt,
      };
      if (existing) {
        await executor
          .update(assessmentAnswers)
          .set(mutable)
          .where(eq(assessmentAnswers.id, existing.id));
      } else {
        await executor.insert(assessmentAnswers).values({
          id: answer.id,
          attemptId: answer.attemptId,
          questionId: answer.questionId,
          createdAt: answer.createdAt,
          ...mutable,
        });
      }
    },

    async getAnswer(attemptId, questionId) {
      const [row] = await executor
        .select()
        .from(assessmentAnswers)
        .where(
          and(
            eq(assessmentAnswers.attemptId, attemptId),
            eq(assessmentAnswers.questionId, questionId),
          ),
        )
        .limit(1);
      return row ? mapAnswer(row) : null;
    },

    async listAnswers(attemptId) {
      const rows = await executor
        .select()
        .from(assessmentAnswers)
        .where(eq(assessmentAnswers.attemptId, attemptId))
        .orderBy(asc(assessmentAnswers.createdAt));
      return rows.map(mapAnswer);
    },

    async appendEvents(events) {
      if (!events.length) return;
      await executor.insert(assessmentEvents).values(
        events.map((item) => ({
          id: item.id,
          attemptId: item.attemptId,
          eventType: rawEventType(item.eventType),
          occurredAt: item.occurredAt,
          metadata: { ...item.metadata, [EVENT_TYPE_KEY]: item.eventType },
          createdAt: item.createdAt,
        })),
      );
    },

    async listEvents(attemptId) {
      const rows = await executor
        .select()
        .from(assessmentEvents)
        .where(eq(assessmentEvents.attemptId, attemptId))
        .orderBy(asc(assessmentEvents.occurredAt));
      return rows.map(mapEvent);
    },

    async hasActiveCameraConsent(studentProfileId, policyVersion) {
      const rows = await executor
        .select({ dataCategories: consentRecords.dataCategories })
        .from(consentRecords)
        .where(
          and(
            eq(consentRecords.studentProfileId, studentProfileId),
            isNull(consentRecords.revokedAt),
          ),
        );
      return rows.some((row) => row.dataCategories.includes(`assessment_camera:${policyVersion}`));
    },

    async isTutorAssignedToStudent(tutorUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: tutorStudentAssignments.id })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .where(
          and(
            eq(tutorProfiles.userId, tutorUserId),
            eq(tutorStudentAssignments.studentProfileId, studentProfileId),
            eq(tutorStudentAssignments.status, "active"),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async isParentLinkedToStudent(parentUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: parentStudentLinks.id })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(
          and(
            eq(parentProfiles.userId, parentUserId),
            eq(parentStudentLinks.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async findStudentProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },

    async saveDiagnosticReport(report) {
      const [existing] = await executor
        .select({ id: diagnosticReports.id })
        .from(diagnosticReports)
        .where(eq(diagnosticReports.assessmentAttemptId, report.assessmentAttemptId))
        .limit(1);
      const values = {
        studentProfileId: report.studentProfileId,
        subjectId: report.subjectId,
        summary: encodeReport(report),
        strengths: report.strengths,
        gaps: report.gaps,
        recommendedNextSteps: report.recommendedNextSteps,
        generatedByUserId: report.writtenByUserId,
        generatedAt: report.writtenAt,
      };
      if (existing) {
        await executor
          .update(diagnosticReports)
          .set(values)
          .where(eq(diagnosticReports.id, existing.id));
      } else {
        await executor.insert(diagnosticReports).values({
          id: report.id,
          assessmentAttemptId: report.assessmentAttemptId,
          createdAt: report.createdAt,
          ...values,
        });
      }
    },

    async getDiagnosticReport(reportId) {
      const [row] = await executor
        .select()
        .from(diagnosticReports)
        .where(eq(diagnosticReports.id, reportId))
        .limit(1);
      return row ? mapReport(row) : null;
    },

    async getDiagnosticReportForAttempt(attemptId) {
      const [row] = await executor
        .select()
        .from(diagnosticReports)
        .where(eq(diagnosticReports.assessmentAttemptId, attemptId))
        .limit(1);
      return row ? mapReport(row) : null;
    },

    async listActiveSubjects(): Promise<AssessmentSubjectOption[]> {
      const rows = await executor
        .select({ id: subjects.id, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.isActive, true))
        .orderBy(asc(subjects.name));
      return rows;
    },

    async listActiveStudentsForTutor(tutorUserId): Promise<AssessmentStudentOption[]> {
      const rows = await executor
        .select({
          studentProfileId: tutorStudentAssignments.studentProfileId,
          studentName: studentProfiles.preferredName,
        })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .innerJoin(
          studentProfiles,
          eq(studentProfiles.id, tutorStudentAssignments.studentProfileId),
        )
        .where(
          and(eq(tutorProfiles.userId, tutorUserId), eq(tutorStudentAssignments.status, "active")),
        )
        .orderBy(asc(studentProfiles.preferredName));
      const byStudentId = new Map(rows.map((row) => [row.studentProfileId, row.studentName]));
      return [...byStudentId.entries()].map(([studentProfileId, studentName]) => ({
        studentProfileId,
        studentName,
      }));
    },

    async listAllActiveStudents(): Promise<AssessmentStudentOption[]> {
      const rows = await executor
        .select({ studentProfileId: studentProfiles.id, studentName: studentProfiles.preferredName })
        .from(studentProfiles)
        .where(eq(studentProfiles.status, "active"))
        .orderBy(asc(studentProfiles.preferredName));
      return rows;
    },

    async countCompletedAttemptsForStudent(assessmentId, studentProfileId) {
      const versionRows = await executor
        .select({ id: assessmentVersions.id })
        .from(assessmentVersions)
        .where(eq(assessmentVersions.assessmentId, assessmentId));
      const versionIds = versionRows.map((row) => row.id);
      if (versionIds.length === 0) return 0;
      const rows = await executor
        .select({ id: assessmentAttempts.id })
        .from(assessmentAttempts)
        .where(
          and(
            inArray(assessmentAttempts.assessmentVersionId, versionIds),
            eq(assessmentAttempts.studentProfileId, studentProfileId),
            inArray(assessmentAttempts.status, ["submitted", "graded"]),
          ),
        );
      return rows.length;
    },
  };
}

export function createDrizzleAssessmentDatabase(database: Database): AssessmentDatabase {
  return repository(database, database, false);
}
