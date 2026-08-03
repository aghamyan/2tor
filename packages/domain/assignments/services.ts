import { ulid } from "ulid";
import { AssignmentError } from "./errors";
import type {
  AssignmentActor,
  AssignmentDatabase,
  AssignmentPage,
  AssignmentQuestionRecord,
  AssignmentRecord,
  GradingRecord,
  RubricScoreRecord,
  SubmissionAnswerRecord,
  SubmissionFileRecord,
  SubmissionRecord,
  VirusScanStatus,
} from "./models";
import {
  assignmentListQuerySchema,
  createAssignmentSchema,
  createRubricSchema,
  gradeSubmissionSchema,
  setAssignmentStatusSchema,
  submissionAnswersSchema,
  type AssignmentListRawInput,
  type CreateAssignmentInput,
  type CreateRubricInput,
  type GradeSubmissionInput,
  type SetAssignmentStatusInput,
  type SubmissionAnswersInput,
} from "./schemas";
import type { SubmissionStorage } from "./storage";

const MB = 1024 * 1024;
const UPLOAD_POLICIES = {
  "image/jpeg": { limit: 15 * MB, extension: "jpg", group: "image" },
  "image/png": { limit: 15 * MB, extension: "png", group: "image" },
  "application/pdf": { limit: 25 * MB, extension: "pdf", group: "document" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    limit: 25 * MB,
    extension: "docx",
    group: "document",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    limit: 25 * MB,
    extension: "xlsx",
    group: "document",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    limit: 25 * MB,
    extension: "pptx",
    group: "document",
  },
  "audio/mpeg": { limit: 50 * MB, extension: "mp3", group: "audio" },
  "audio/wav": { limit: 50 * MB, extension: "wav", group: "audio" },
  "video/mp4": { limit: 250 * MB, extension: "mp4", group: "video" },
  "video/webm": { limit: 250 * MB, extension: "webm", group: "video" },
  "application/zip": { limit: 20 * MB, extension: "zip", group: "archive" },
} as const;
export type AllowedSubmissionMimeType = keyof typeof UPLOAD_POLICIES;

function hasRole(actor: AssignmentActor, ...roles: AssignmentActor["roles"][number][]) {
  return roles.some((role) => actor.roles.includes(role));
}
function requireActor(actor: AssignmentActor | null | undefined): asserts actor is AssignmentActor {
  if (!actor) throw new AssignmentError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}
function isStaff(actor: AssignmentActor) {
  return hasRole(actor, "administrator", "super_administrator");
}
async function requireAssignedTutor(
  database: AssignmentDatabase,
  actor: AssignmentActor,
  studentProfileId: string,
) {
  if (isStaff(actor)) return;
  if (
    !hasRole(actor, "tutor") ||
    !(await database.isTutorAssignedToStudent(actor.userId, studentProfileId))
  )
    throw new AssignmentError(
      "FORBIDDEN",
      "Only the tutor assigned to this student may access this submission.",
      403,
    );
}
/** Read-only relationship gate: staff, the owning student, a linked parent, or the assigned tutor. Parents never reach write paths (create/submit/grade) — those keep their own, narrower checks. */
async function requireViewerRelationship(
  database: AssignmentDatabase,
  actor: AssignmentActor,
  studentProfileId: string,
): Promise<void> {
  if (isStaff(actor)) return;
  if (hasRole(actor, "student") && actor.studentProfileId === studentProfileId) return;
  if (
    hasRole(actor, "parent") &&
    (await database.isParentLinkedToStudent(actor.userId, studentProfileId))
  )
    return;
  await requireAssignedTutor(database, actor, studentProfileId);
}
function requireStudentOwner(actor: AssignmentActor, studentProfileId: string) {
  if (!hasRole(actor, "student") || actor.studentProfileId !== studentProfileId)
    throw new AssignmentError("FORBIDDEN", "Only the assigned student may submit this work.", 403);
}
function policyFor(mimeType: string) {
  return UPLOAD_POLICIES[mimeType as AllowedSubmissionMimeType];
}
function starts(bytes: Uint8Array, ...prefix: number[]) {
  return bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value);
}
function zipContains(bytes: Uint8Array, entryPrefix: string) {
  return new TextDecoder("latin1").decode(bytes).includes(entryPrefix);
}

/** Validate bytes, not a browser-provided Content-Type. Zip formats are never extracted server-side. */
export function verifyUploadSignature(
  mimeType: AllowedSubmissionMimeType,
  bytes: Uint8Array,
): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return starts(bytes, 0xff, 0xd8, 0xff);
    case "image/png":
      return starts(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "application/pdf":
      return starts(bytes, 0x25, 0x50, 0x44, 0x46, 0x2d);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return (
        (starts(bytes, 0x50, 0x4b, 0x03, 0x04) || starts(bytes, 0x50, 0x4b, 0x05, 0x06)) &&
        zipContains(bytes, "word/")
      );
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return (
        (starts(bytes, 0x50, 0x4b, 0x03, 0x04) || starts(bytes, 0x50, 0x4b, 0x05, 0x06)) &&
        zipContains(bytes, "xl/")
      );
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return (
        (starts(bytes, 0x50, 0x4b, 0x03, 0x04) || starts(bytes, 0x50, 0x4b, 0x05, 0x06)) &&
        zipContains(bytes, "ppt/")
      );
    case "application/zip":
      return starts(bytes, 0x50, 0x4b, 0x03, 0x04) || starts(bytes, 0x50, 0x4b, 0x05, 0x06);
    case "audio/mpeg":
      return (
        starts(bytes, 0x49, 0x44, 0x33) ||
        (bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
      );
    case "audio/wav":
      return (
        starts(bytes, 0x52, 0x49, 0x46, 0x46) &&
        bytes.length >= 12 &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WAVE"
      );
    case "video/mp4":
      return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
    case "video/webm":
      return starts(bytes, 0x1a, 0x45, 0xdf, 0xa3);
  }
}

/** Removes JPEG APP/COM metadata while keeping encoded image data untouched. */
function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (!starts(bytes, 0xff, 0xd8)) return bytes;
  const output: number[] = [0xff, 0xd8];
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      output.push(...bytes.slice(offset));
      break;
    }
    let markerOffset = offset + 1;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset++;
    const marker = bytes[markerOffset];
    if (marker === undefined) break;
    if (marker === 0xda || marker === 0xd9) {
      output.push(...bytes.slice(offset));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      output.push(...bytes.slice(offset, markerOffset + 1));
      offset = markerOffset + 1;
      continue;
    }
    if (markerOffset + 2 >= bytes.length) return bytes;
    const size = ((bytes[markerOffset + 1] ?? 0) << 8) | (bytes[markerOffset + 2] ?? 0);
    const end = markerOffset + 1 + size;
    if (size < 2 || end > bytes.length) return bytes;
    if (!((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe))
      output.push(...bytes.slice(offset, end));
    offset = end;
  }
  return new Uint8Array(output);
}

/** PNG ancillary chunks include text and eXIf data. Dropping all of them is conservative and lossless for pixels. */
function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (!starts(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return bytes;
  const output: number[] = [...bytes.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length =
      (((bytes[offset] ?? 0) << 24) >>> 0) +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0);
    const end = offset + 12 + length;
    if (end > bytes.length) return bytes;
    const chunkType = bytes[offset + 4] ?? 0;
    const isAncillary = chunkType >= 0x61 && chunkType <= 0x7a;
    if (!isAncillary) output.push(...bytes.slice(offset, end));
    if (new TextDecoder().decode(bytes.slice(offset + 4, offset + 8)) === "IEND") break;
    offset = end;
  }
  return new Uint8Array(output);
}

export function stripImageMetadata(
  mimeType: AllowedSubmissionMimeType,
  bytes: Uint8Array,
): Uint8Array {
  return mimeType === "image/jpeg"
    ? stripJpegMetadata(bytes)
    : mimeType === "image/png"
      ? stripPngMetadata(bytes)
      : bytes;
}

export function validateSubmissionUpload(
  input: { fileName: string; mimeType: string; sizeBytes: number },
  bytes: Uint8Array,
): { mimeType: AllowedSubmissionMimeType; safeBytes: Uint8Array; extension: string } {
  const mimeType = input.mimeType as AllowedSubmissionMimeType;
  const policy = policyFor(mimeType);
  if (!policy)
    throw new AssignmentError(
      "UPLOAD_NOT_ALLOWED",
      "This file type is not allowed for assignments.",
      415,
    );
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes !== bytes.byteLength ||
    input.sizeBytes > policy.limit
  )
    throw new AssignmentError(
      "UPLOAD_TOO_LARGE",
      `This ${policy.group} exceeds its upload limit.`,
      413,
    );
  if (!verifyUploadSignature(mimeType, bytes))
    throw new AssignmentError(
      "UPLOAD_SIGNATURE_INVALID",
      "The uploaded bytes do not match the declared file type.",
      415,
    );
  return { mimeType, safeBytes: stripImageMetadata(mimeType, bytes), extension: policy.extension };
}

export async function createAssignment(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  input: CreateAssignmentInput,
): Promise<AssignmentRecord> {
  requireActor(actor);
  const values = createAssignmentSchema.parse(input);
  await requireAssignedTutor(database, actor, values.studentProfileId);
  const now = new Date();
  const assignmentId = ulid();
  const questions: AssignmentQuestionRecord[] = values.questions.map((question, orderIndex) => ({
    id: ulid(),
    assignmentId,
    orderIndex,
    ...question,
    createdAt: now,
    updatedAt: now,
  }));
  const assignment: AssignmentRecord = {
    id: assignmentId,
    createdByUserId: actor.userId,
    studentProfileId: values.studentProfileId,
    subjectId: values.subjectId,
    lessonId: values.lessonId,
    title: values.title,
    instructions: values.instructions,
    dueAt: values.dueAt ? new Date(values.dueAt) : null,
    status: values.status,
    maxScore: values.maxScore,
    questions,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveAssignment(assignment);
  return assignment;
}

export async function getAssignmentForActor(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  assignmentId: string,
): Promise<AssignmentRecord> {
  requireActor(actor);
  const assignment = await database.getAssignment(assignmentId);
  if (!assignment)
    throw new AssignmentError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
  await requireViewerRelationship(database, actor, assignment.studentProfileId);
  return assignment;
}

const ALLOWED_STATUS_TRANSITIONS: Record<AssignmentRecord["status"], AssignmentRecord["status"][]> =
  {
    draft: ["published"],
    published: ["closed"],
    closed: [],
  };

/** A draft must become `published` before a student can see or submit to it; `published` may later be `closed`. Only staff or the actively assigned tutor may transition it. */
export async function setAssignmentStatus(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  assignmentId: string,
  input: SetAssignmentStatusInput,
): Promise<AssignmentRecord> {
  requireActor(actor);
  const values = setAssignmentStatusSchema.parse(input);
  const assignment = await database.getAssignment(assignmentId);
  if (!assignment)
    throw new AssignmentError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
  await requireAssignedTutor(database, actor, assignment.studentProfileId);
  if (!ALLOWED_STATUS_TRANSITIONS[assignment.status].includes(values.status))
    throw new AssignmentError(
      "ASSIGNMENT_NOT_OPEN",
      `An assignment cannot move from "${assignment.status}" to "${values.status}".`,
      409,
    );
  const updatedAt = new Date();
  await database.updateAssignmentStatus(assignmentId, values.status, updatedAt);
  return { ...assignment, status: values.status, updatedAt };
}

export async function listAssignmentsForActor(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  input: AssignmentListRawInput = {},
): Promise<AssignmentPage> {
  requireActor(actor);
  const query = assignmentListQuerySchema.parse({
    cursor: input.cursor ?? null,
    limit: input.limit ?? 20,
    status: input.status ?? undefined,
    studentProfileId: input.studentProfileId ?? undefined,
    subjectId: input.subjectId ?? undefined,
  });

  let studentProfileIds: string[] | null = null;
  if (isStaff(actor)) {
    // No restriction — `studentProfileIds` stays `null`.
  } else if (hasRole(actor, "student")) {
    if (!actor.studentProfileId) return { items: [], nextCursor: null };
    studentProfileIds = [actor.studentProfileId];
  } else if (hasRole(actor, "parent")) {
    studentProfileIds = await database.listLinkedStudentProfileIdsForParent(actor.userId);
  } else if (hasRole(actor, "tutor")) {
    const students = await database.listActiveStudentsForTutor(actor.userId);
    studentProfileIds = students.map((student) => student.studentProfileId);
  } else {
    return { items: [], nextCursor: null };
  }

  if (query.studentProfileId) {
    if (studentProfileIds !== null && !studentProfileIds.includes(query.studentProfileId))
      return { items: [], nextCursor: null };
    studentProfileIds = [query.studentProfileId];
  }

  // An empty (not null) scope means the actor legitimately has zero related students — return
  // empty rather than querying, since an unguarded `IN ()` must never be read as "unfiltered".
  if (studentProfileIds !== null && studentProfileIds.length === 0)
    return { items: [], nextCursor: null };

  const rows = await database.listAssignments({
    studentProfileIds,
    status: query.status,
    subjectId: query.subjectId,
    cursor: query.cursor,
    limit: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function saveSubmissionAnswers(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  assignmentId: string,
  input: SubmissionAnswersInput,
): Promise<SubmissionRecord> {
  requireActor(actor);
  const values = submissionAnswersSchema.parse(input);
  const assignment = await database.getAssignment(assignmentId);
  if (!assignment)
    throw new AssignmentError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
  requireStudentOwner(actor, assignment.studentProfileId);
  if (assignment.status !== "published")
    throw new AssignmentError(
      "ASSIGNMENT_NOT_OPEN",
      "This assignment is not open for submissions.",
      409,
    );
  const validQuestions = new Map(assignment.questions.map((question) => [question.id, question]));
  for (const answer of values.answers) {
    const question = validQuestions.get(answer.questionId);
    if (!question)
      throw new AssignmentError(
        "INVALID_INPUT",
        "An answer references a question outside this assignment.",
      );
    if (
      question.type === "multiple_choice" &&
      answer.selectedOptionKey &&
      !question.options?.some((option) => option.key === answer.selectedOptionKey)
    )
      throw new AssignmentError("INVALID_INPUT", "The selected option is invalid.");
  }
  return database.transaction(async (tx) => {
    const now = new Date();
    let submission = await tx.getSubmissionForAssignmentStudent(
      assignment.id,
      assignment.studentProfileId,
    );
    if (!submission)
      submission = {
        id: ulid(),
        assignmentId: assignment.id,
        studentProfileId: assignment.studentProfileId,
        status: values.submit ? "submitted" : "in_progress",
        attemptNumber: 1,
        submittedAt: values.submit ? now : null,
        answers: [],
        createdAt: now,
        updatedAt: now,
      };
    else
      submission = {
        ...submission,
        status: values.submit
          ? "submitted"
          : submission.status === "not_started"
            ? "in_progress"
            : submission.status,
        submittedAt: values.submit ? now : submission.submittedAt,
        updatedAt: now,
      };
    const answers: SubmissionAnswerRecord[] = values.answers.map((answer) => ({
      id: ulid(),
      submissionId: submission.id,
      questionId: answer.questionId,
      answerText: answer.answerText,
      selectedOptionKey: answer.selectedOptionKey,
      pointsAwarded: null,
      createdAt: now,
      updatedAt: now,
    }));
    await tx.saveSubmission({ ...submission, answers });
    await tx.replaceSubmissionAnswers(submission.id, answers);
    return { ...submission, answers };
  });
}

/** Submission reads use the same relationship gate as grading; a tutor role by itself is insufficient. */
export async function getSubmissionForActor(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  submissionId: string,
): Promise<SubmissionRecord> {
  requireActor(actor);
  const submission = await database.getSubmission(submissionId);
  if (!submission)
    throw new AssignmentError("SUBMISSION_NOT_FOUND", "Submission was not found.", 404);
  await requireViewerRelationship(database, actor, submission.studentProfileId);
  return submission;
}

export async function uploadSubmissionFile(
  database: AssignmentDatabase,
  storage: SubmissionStorage,
  actor: AssignmentActor | null | undefined,
  submissionId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number },
  bytes: Uint8Array,
): Promise<SubmissionFileRecord> {
  requireActor(actor);
  const submission = await database.getSubmission(submissionId);
  if (!submission)
    throw new AssignmentError("SUBMISSION_NOT_FOUND", "Submission was not found.", 404);
  requireStudentOwner(actor, submission.studentProfileId);
  const assignment = await database.getAssignment(submission.assignmentId);
  if (!assignment || assignment.status !== "published")
    throw new AssignmentError(
      "ASSIGNMENT_NOT_OPEN",
      "This assignment is not open for submissions.",
      409,
    );
  const validated = validateSubmissionUpload(input, bytes);
  const file: SubmissionFileRecord = {
    id: ulid(),
    submissionId,
    fileKey: `assignments/${submission.assignmentId}/${submission.id}/${ulid()}.${validated.extension}`,
    fileName: input.fileName.trim().slice(0, 255) || "submission-file",
    mimeType: validated.mimeType,
    sizeBytes: validated.safeBytes.byteLength,
    virusScanStatus: "pending",
    uploadedAt: new Date(),
  };
  await storage.putPrivate({
    key: file.fileKey,
    body: validated.safeBytes,
    mimeType: file.mimeType,
    metadata: { submissionFileId: file.id, quarantine: "pending", originalName: file.fileName },
  });
  await database.saveSubmissionFile(file);
  return file;
}

async function fileAndSubmission(database: AssignmentDatabase, fileId: string) {
  const file = await database.getSubmissionFile(fileId);
  if (!file) throw new AssignmentError("FILE_NOT_FOUND", "Submission file was not found.", 404);
  const submission = await database.getSubmission(file.submissionId);
  if (!submission)
    throw new AssignmentError("SUBMISSION_NOT_FOUND", "Submission was not found.", 404);
  return { file, submission };
}

/** A clean status is a hard precondition. Pending, errored, and infected files are never downloadable. */
export async function getDownloadableSubmissionFile(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  fileId: string,
): Promise<SubmissionFileRecord> {
  requireActor(actor);
  const { file, submission } = await fileAndSubmission(database, fileId);
  await requireViewerRelationship(database, actor, submission.studentProfileId);
  if (file.virusScanStatus !== "clean")
    throw new AssignmentError(
      "FILE_NOT_READY",
      "This file remains quarantined until malware scanning clears it.",
      409,
    );
  return file;
}

export async function recordSubmissionFileScanResult(
  database: AssignmentDatabase,
  fileId: string,
  status: Exclude<VirusScanStatus, "pending">,
): Promise<void> {
  const file = await database.getSubmissionFile(fileId);
  if (!file) throw new AssignmentError("FILE_NOT_FOUND", "Submission file was not found.", 404);
  await database.updateSubmissionFileScanStatus(fileId, status);
}

export async function gradeSubmission(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  submissionId: string,
  input: GradeSubmissionInput,
): Promise<GradingRecord> {
  requireActor(actor);
  const values = gradeSubmissionSchema.parse(input);
  const submission = await database.getSubmission(submissionId);
  if (!submission)
    throw new AssignmentError("SUBMISSION_NOT_FOUND", "Submission was not found.", 404);
  await requireAssignedTutor(database, actor, submission.studentProfileId);
  return database.transaction(async (tx) => {
    for (const score of values.rubricScores) {
      const rubric = await tx.getRubric(score.rubricId);
      if (!rubric || rubric.scope !== "assignment")
        throw new AssignmentError("RUBRIC_NOT_FOUND", "An assignment rubric was not found.", 404);
    }
    const now = new Date();
    const grading: GradingRecord = {
      id: ulid(),
      submissionId,
      gradedByUserId: actor.userId,
      score: values.score,
      maxScore: values.maxScore,
      feedback: values.feedback,
      gradedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const rubricScores: RubricScoreRecord[] = values.rubricScores.map((score) => ({
      id: ulid(),
      submissionId,
      rubricId: score.rubricId,
      criterionKey: score.criterionKey,
      criterionLabel: score.criterionLabel,
      scoreValue: score.scoreValue,
      maxValue: score.maxValue,
      comments: score.comments,
      scoredByUserId: actor.userId,
      scoredAt: now,
      createdAt: now,
    }));
    await tx.saveGrading(grading);
    await tx.replaceRubricScores(submissionId, rubricScores);
    await tx.saveSubmission({ ...submission, status: "graded", updatedAt: now });
    return grading;
  });
}

export async function createAssignmentRubric(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
  input: CreateRubricInput,
) {
  requireActor(actor);
  if (!isStaff(actor) && !hasRole(actor, "tutor"))
    throw new AssignmentError("FORBIDDEN", "Only teaching staff can create a rubric.", 403);
  const values = createRubricSchema.parse(input);
  const now = new Date();
  const rubric = {
    id: ulid(),
    ...values,
    createdByUserId: actor.userId,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveRubric(rubric);
  return rubric;
}

/** Rubrics are reusable grading templates, not student-linked records, so any teaching-staff actor may browse the full set to attach to a grade. */
export async function listAssignmentRubrics(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
) {
  requireActor(actor);
  if (!isStaff(actor) && !hasRole(actor, "tutor"))
    throw new AssignmentError("FORBIDDEN", "Only teaching staff can view rubrics.", 403);
  return database.listAssignmentRubrics();
}

/** Active students assigned to a tutor, for the "create assignment" student picker. */
export async function listActiveStudentsForTutor(
  database: AssignmentDatabase,
  actor: AssignmentActor | null | undefined,
) {
  requireActor(actor);
  if (!hasRole(actor, "tutor"))
    throw new AssignmentError("FORBIDDEN", "Only tutors have assigned students.", 403);
  return database.listActiveStudentsForTutor(actor.userId);
}

export async function findStaleAssignmentReminders(
  database: AssignmentDatabase,
  now = new Date(),
  limit = 250,
) {
  return database.listStaleAssignmentReminders(now, Math.max(1, Math.min(limit, 1_000)));
}
