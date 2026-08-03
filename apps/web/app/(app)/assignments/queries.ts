import { redirect } from "next/navigation";

import { AssignmentError } from "../../../../../packages/domain/assignments/errors";
import type {
  AssignmentPage,
  AssignmentRecord,
  GradingRecord,
  RubricRecord,
  RubricScoreRecord,
  SubmissionFileRecord,
  SubmissionRecord,
} from "../../../../../packages/domain/assignments/models";
import type { AssignmentListRawInput } from "../../../../../packages/domain/assignments/schemas";
import {
  getAssignmentForActor,
  listActiveStudentsForTutor,
  listAssignmentRubrics,
  listAssignmentsForActor,
} from "../../../../../packages/domain/assignments/services";
import { authorizeAssignmentAccess } from "./authorization";
import { currentAssignmentContext } from "./context";

function redirectIfUnauthenticated(error: unknown): never {
  if (error instanceof AssignmentError && error.code === "UNAUTHENTICATED") redirect("/login");
  throw error;
}

export interface AssignmentListData {
  page: AssignmentPage;
  isTutor: boolean;
  isStudentSelf: boolean;
}

/** A brand-new tutor/parent/student with no related assignments yet sees an empty list, not an error. */
export async function loadAssignmentList(
  searchParams: AssignmentListRawInput,
): Promise<AssignmentListData> {
  try {
    const context = await currentAssignmentContext();
    const page = await listAssignmentsForActor(context.database, context.actor, searchParams);
    return {
      page,
      isTutor: context.actor.roles.includes("tutor"),
      isStudentSelf: context.actor.roles.includes("student"),
    };
  } catch (error) {
    return redirectIfUnauthenticated(error);
  }
}

export interface AssignmentDetailViewer {
  userId: string;
  isStaff: boolean;
  isTutor: boolean;
  isStudentOwner: boolean;
  isParent: boolean;
  /** Staff or the actively assigned tutor — the only viewers who may create/grade. */
  canManage: boolean;
}

export interface AssignmentDetailData {
  assignment: AssignmentRecord;
  studentName: string | null;
  submission: SubmissionRecord | null;
  files: SubmissionFileRecord[];
  grading: GradingRecord | null;
  rubricScores: RubricScoreRecord[];
  rubrics: RubricRecord[];
  viewer: AssignmentDetailViewer;
}

export async function loadAssignmentDetail(assignmentId: string): Promise<AssignmentDetailData> {
  try {
    const context = await currentAssignmentContext();
    const assignment = await getAssignmentForActor(context.database, context.actor, assignmentId);
    await authorizeAssignmentAccess(
      context.database,
      context.actor,
      assignment.studentProfileId,
      "academic.view_record",
    );

    const submission = await context.database.getSubmissionForAssignmentStudent(
      assignment.id,
      assignment.studentProfileId,
    );
    const [grading, rubricScores, files] = submission
      ? await Promise.all([
          context.database.getGradingForSubmission(submission.id),
          context.database.listRubricScoresForSubmission(submission.id),
          context.database.listSubmissionFiles(submission.id),
        ])
      : [null, [], []];

    const isStaff =
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    const isTutor = context.actor.roles.includes("tutor");
    const isStudentOwner =
      context.actor.roles.includes("student") &&
      context.actor.studentProfileId === assignment.studentProfileId;
    const isParent =
      context.actor.roles.includes("parent") && !isStaff && !isTutor && !isStudentOwner;
    const canManage = isStaff || isTutor;
    const [rubrics, studentName] = await Promise.all([
      canManage ? listAssignmentRubrics(context.database, context.actor) : Promise.resolve([]),
      isStudentOwner
        ? Promise.resolve(null)
        : context.database.getStudentDisplayName(assignment.studentProfileId),
    ]);

    return {
      assignment,
      studentName,
      submission,
      files,
      grading,
      rubricScores,
      rubrics,
      viewer: {
        userId: context.actor.userId,
        isStaff,
        isTutor,
        isStudentOwner,
        isParent,
        canManage,
      },
    };
  } catch (error) {
    return redirectIfUnauthenticated(error);
  }
}

export interface NewAssignmentFormData {
  students: { studentProfileId: string; studentName: string }[];
}

export async function loadNewAssignmentFormData(): Promise<NewAssignmentFormData> {
  try {
    const context = await currentAssignmentContext();
    if (!context.actor.roles.includes("tutor")) redirect("/assignments");
    const students = await listActiveStudentsForTutor(context.database, context.actor);
    return { students };
  } catch (error) {
    return redirectIfUnauthenticated(error);
  }
}
