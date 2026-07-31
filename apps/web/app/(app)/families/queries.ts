import { redirect } from "next/navigation";

import { FamilyError } from "../../../../../packages/domain/families/errors";
import type {
  ParentProfileRecord,
  StudentFamilyDetail,
  StudentFamilySummary,
} from "../../../../../packages/domain/families/models";
import {
  getFamilyStudent,
  listFamilyStudents,
} from "../../../../../packages/domain/families/services";
import { authorizeParentWorkspace, authorizeStudentRelationship } from "./authorization";
import { currentFamilyContext } from "./context";

export interface FamilyOverviewData {
  parent: ParentProfileRecord | null;
  students: StudentFamilySummary[];
}

function redirectIfUnauthenticated(error: unknown): never {
  if (error instanceof FamilyError && error.code === "UNAUTHENTICATED") redirect("/login");
  throw error;
}

export async function loadFamilyOverview(): Promise<FamilyOverviewData> {
  try {
    const context = await currentFamilyContext();
    authorizeParentWorkspace(context.actor);
    const parent = await context.database.findParentProfileByUserId(context.actor.userId);
    if (!parent) return { parent: null, students: [] };
    const students = await listFamilyStudents(context.database, context.actor, { limit: 50 });
    return { parent, students: students.items };
  } catch (error: unknown) {
    return redirectIfUnauthenticated(error);
  }
}

export async function loadFamilyStudent(studentProfileId: string): Promise<StudentFamilyDetail> {
  try {
    const context = await currentFamilyContext();
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      studentProfileId,
      "student.view_profile",
    );
    return getFamilyStudent(context.database, context.actor, studentProfileId);
  } catch (error: unknown) {
    return redirectIfUnauthenticated(error);
  }
}
