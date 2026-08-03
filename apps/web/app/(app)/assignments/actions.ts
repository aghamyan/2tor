"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AssignmentError } from "../../../../../packages/domain/assignments/errors";
import {
  createAssignmentSchema,
  createRubricSchema,
  gradeSubmissionSchema,
} from "../../../../../packages/domain/assignments/schemas";
import {
  createAssignment,
  createAssignmentRubric,
  getDownloadableSubmissionFile,
  gradeSubmission,
  saveSubmissionAnswers,
  setAssignmentStatus,
} from "../../../../../packages/domain/assignments/services";
import { createSubmissionFileSignedUrl } from "../../../../../packages/domain/assignments/storage";
import type { AssignmentActionState } from "./action-state";
import { authorizeAssignmentAccess } from "./authorization";
import { currentAssignmentContext } from "./context";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

function nullableNumber(formData: FormData, key: string): number | null {
  const value = str(formData, key);
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

/** Hidden `<input type="hidden">` JSON payloads for the dynamic question/rubric-criterion rows a plain form can't otherwise submit as structured data. Malformed JSON is a user-facing validation error, not a server fault. */
function parseJsonField(formData: FormData, key: string): unknown {
  const raw = str(formData, key);
  if (raw === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    throw new z.ZodError([
      { code: "custom", path: [key], message: "The submitted data was malformed." },
    ]);
  }
}

function errorState(error: unknown): AssignmentActionState {
  if (error instanceof z.ZodError) {
    return { status: "error", message: "errors.invalid", fieldErrors: error.flatten().fieldErrors };
  }
  if (error instanceof AssignmentError) {
    const message: AssignmentActionState["message"] =
      error.code === "UNAUTHENTICATED"
        ? "errors.unauthenticated"
        : error.code === "FORBIDDEN"
          ? "errors.forbidden"
          : error.code === "ASSIGNMENT_NOT_FOUND" ||
              error.code === "SUBMISSION_NOT_FOUND" ||
              error.code === "FILE_NOT_FOUND" ||
              error.code === "RUBRIC_NOT_FOUND"
            ? "errors.notFound"
            : error.code === "ASSIGNMENT_NOT_OPEN" || error.code === "FILE_NOT_READY"
              ? "errors.conflict"
              : error.status < 500
                ? "errors.invalid"
                : "errors.generic";
    return { status: "error", message, fieldErrors: {} };
  }
  // Anything else — including Next.js's internal `redirect()`/`notFound()` control-flow errors —
  // must propagate rather than be swallowed into a generic failure state.
  throw error;
}

export async function createAssignmentAction(
  _previous: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  try {
    const context = await currentAssignmentContext();
    const studentProfileId = str(formData, "studentProfileId");
    await authorizeAssignmentAccess(
      context.database,
      context.actor,
      studentProfileId,
      "academic.edit_learning_plan",
    );
    const dueAtDate = nullableStr(formData, "dueAt");
    const input = createAssignmentSchema.parse({
      studentProfileId,
      subjectId: nullableStr(formData, "subjectId"),
      lessonId: null,
      title: str(formData, "title"),
      instructions: nullableStr(formData, "instructions"),
      dueAt: dueAtDate ? new Date(dueAtDate).toISOString() : null,
      status: checked(formData, "publish") ? "published" : "draft",
      maxScore: nullableNumber(formData, "maxScore"),
      questions: parseJsonField(formData, "questionsJson"),
    });
    const assignment = await createAssignment(context.database, context.actor, input);
    revalidatePath("/assignments");
    redirect(`/assignments/${assignment.id}`);
  } catch (error) {
    return errorState(error);
  }
}

export async function setAssignmentStatusAction(
  _previous: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  try {
    const context = await currentAssignmentContext();
    const assignmentId = str(formData, "assignmentId");
    const status = str(formData, "status");
    const assignment = await context.database.getAssignment(assignmentId);
    if (!assignment)
      throw new AssignmentError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
    await authorizeAssignmentAccess(
      context.database,
      context.actor,
      assignment.studentProfileId,
      "academic.edit_learning_plan",
    );
    await setAssignmentStatus(context.database, context.actor, assignmentId, {
      status: status as "published" | "closed",
    });
    revalidatePath(`/assignments/${assignmentId}`);
    revalidatePath("/assignments");
    return {
      status: "success",
      message: status === "published" ? "assignmentPublished" : "assignmentClosed",
      fieldErrors: {},
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function saveSubmissionAnswersAction(
  _previous: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  try {
    const context = await currentAssignmentContext();
    const assignmentId = str(formData, "assignmentId");
    const questionIds = formData
      .getAll("questionId")
      .filter((v): v is string => typeof v === "string");
    const submit = checked(formData, "submit");
    const answers = questionIds.map((questionId) => ({
      questionId,
      answerText: nullableStr(formData, `answer-${questionId}`),
      selectedOptionKey: nullableStr(formData, `option-${questionId}`),
    }));
    await saveSubmissionAnswers(context.database, context.actor, assignmentId, { answers, submit });
    revalidatePath(`/assignments/${assignmentId}`);
    return { status: "success", message: submit ? "submitted" : "saved", fieldErrors: {} };
  } catch (error) {
    return errorState(error);
  }
}

export async function gradeSubmissionAction(
  _previous: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  try {
    const context = await currentAssignmentContext();
    const submissionId = str(formData, "submissionId");
    const assignmentId = str(formData, "assignmentId");
    const submission = await context.database.getSubmission(submissionId);
    if (!submission)
      throw new AssignmentError("SUBMISSION_NOT_FOUND", "Submission was not found.", 404);
    await authorizeAssignmentAccess(
      context.database,
      context.actor,
      submission.studentProfileId,
      "academic.edit_learning_plan",
    );
    const input = gradeSubmissionSchema.parse({
      score: nullableNumber(formData, "score"),
      maxScore: nullableNumber(formData, "maxScore"),
      feedback: nullableStr(formData, "feedback"),
      rubricScores: parseJsonField(formData, "rubricScoresJson"),
    });
    await gradeSubmission(context.database, context.actor, submissionId, input);
    revalidatePath(`/assignments/${assignmentId}`);
    return { status: "success", message: "graded", fieldErrors: {} };
  } catch (error) {
    return errorState(error);
  }
}

/**
 * Mints a fresh, short-lived signed download URL on demand — called right before navigation
 * rather than baked into a server-rendered page, since {@link createSubmissionFileSignedUrl}'s
 * default 60s TTL would otherwise expire while the detail page just sits open in a tab.
 */
export async function requestSubmissionFileDownloadUrlAction(
  fileId: string,
): Promise<{ url: string } | { error: true }> {
  try {
    const context = await currentAssignmentContext();
    const file = await getDownloadableSubmissionFile(context.database, context.actor, fileId);
    return { url: createSubmissionFileSignedUrl(file.id, context.actor.userId) };
  } catch {
    return { error: true };
  }
}

export async function createRubricAction(
  _previous: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  try {
    const context = await currentAssignmentContext();
    const assignmentId = str(formData, "assignmentId");
    const input = createRubricSchema.parse({
      title: str(formData, "title"),
      description: nullableStr(formData, "description"),
      subjectId: nullableStr(formData, "subjectId"),
      scope: "assignment",
    });
    await createAssignmentRubric(context.database, context.actor, input);
    if (assignmentId) revalidatePath(`/assignments/${assignmentId}`);
    return { status: "success", message: "rubricCreated", fieldErrors: {} };
  } catch (error) {
    return errorState(error);
  }
}
