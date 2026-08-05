import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AssessmentError } from "../../../../../packages/domain/assessments/errors";
import type {
  AssessmentRecord,
  AssessmentStudentOption,
  AssessmentSubjectOption,
} from "../../../../../packages/domain/assessments/models";
import { assessmentRequestContext } from "../../../../../packages/domain/assessments/runtime";
import {
  listAssessableStudents,
  listAssessableSubjects,
  listAssessmentsForActor,
} from "../../../../../packages/domain/assessments/services";

function redirectIfUnauthenticated(error: unknown): never {
  if (error instanceof AssessmentError && error.code === "UNAUTHENTICATED") redirect("/login");
  throw error;
}

async function currentAssessmentContext() {
  const cookieStore = await cookies();
  return assessmentRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export interface AssessmentsPageData {
  assessments: AssessmentRecord[];
  isStudent: boolean;
  /** Tutors and staff can author assessments; everyone else only ever browses published ones. */
  canCreate: boolean;
}

/** A brand-new student with no published assessments yet sees an empty list, not an error. */
export async function loadAssessmentsPageData(): Promise<AssessmentsPageData> {
  try {
    const context = await currentAssessmentContext();
    const isStudent = context.actor.roles.includes("student");
    const isStaff =
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    const canCreate = isStaff || context.actor.roles.includes("tutor");
    const assessments = isStudent
      ? await listAssessmentsForActor(context.database, context.actor)
      : [];
    return { assessments, isStudent, canCreate };
  } catch (error) {
    return redirectIfUnauthenticated(error);
  }
}

export interface AssessmentDetailPageData {
  /** Tutors/staff land on the attempts list; everyone else gets the student take-flow. */
  isReviewer: boolean;
}

export async function loadAssessmentDetailPageData(): Promise<AssessmentDetailPageData> {
  try {
    const context = await currentAssessmentContext();
    const isReviewer =
      context.actor.roles.includes("tutor") ||
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    return { isReviewer };
  } catch (error) {
    return redirectIfUnauthenticated(error);
  }
}

export interface NewAssessmentFormData {
  subjects: AssessmentSubjectOption[];
  students: AssessmentStudentOption[];
}

export async function loadNewAssessmentFormData(): Promise<NewAssessmentFormData> {
  try {
    const context = await currentAssessmentContext();
    const isAuthor =
      context.actor.roles.includes("tutor") ||
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    if (!isAuthor) redirect("/assessments");
    const [subjects, students] = await Promise.all([
      listAssessableSubjects(context.database, context.actor),
      listAssessableStudents(context.database, context.actor),
    ]);
    return { subjects, students };
  } catch (error) {
    return redirectIfUnauthenticated(error);
  }
}
