import { authorize, type Actor } from "@app/auth";
import { AcademicError } from "../../../../../packages/domain/academics/errors";
import type { AcademicDatabase } from "../../../../../packages/domain/academics/models";

export async function authorizeAcademicRecord(
  database: AcademicDatabase,
  actor: Actor,
  studentProfileId: string,
  action: "academic.view_record" | "academic.edit_learning_plan",
) {
  const parentLinked = await database.isParentLinkedToStudent(actor.userId, studentProfileId);
  const tutorAssigned = await database.isTutorAssignedToStudent(actor.userId, studentProfileId);
  const result = authorize(actor, action, {
    kind: "student",
    studentProfileId,
    parentLinked,
    tutorAssignment: tutorAssigned ? { status: "active", endAt: null } : null,
  });
  if (!result.allowed) throw new AcademicError("FORBIDDEN", result.reason, 403);
}
