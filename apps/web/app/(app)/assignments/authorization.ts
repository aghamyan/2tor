import { authorize, type Action, type Actor } from "@app/auth";

import { AssignmentError } from "../../../../../packages/domain/assignments/errors";
import type { AssignmentDatabase } from "../../../../../packages/domain/assignments/models";

function requireAllowed(result: ReturnType<typeof authorize>): void {
  if (!result.allowed) throw new AssignmentError("FORBIDDEN", result.reason, 403);
}

/**
 * The `@app/auth` action catalog has no assignment-specific entries, and `packages/auth` is
 * out of this module's file scope. Viewing an assignment, its submission, or its files maps onto
 * `academic.view_record`; a tutor creating an assignment or grading a submission maps onto
 * `academic.edit_learning_plan` — both take the same tutor/parent/student relationship shape this
 * module's own domain services already enforce (see `services.ts`'s `requireViewerRelationship`
 * and `requireAssignedTutor`). This is a defense-in-depth web-boundary gate satisfying the
 * "authorize() on every operation" rule, not a replacement for the domain-layer checks.
 */
export async function authorizeAssignmentAccess(
  database: AssignmentDatabase,
  actor: Actor,
  studentProfileId: string,
  action: Extract<Action, "academic.view_record" | "academic.edit_learning_plan">,
): Promise<void> {
  const [tutorAssignment, parentLinked] = await Promise.all([
    database.getTutorAssignmentFact(actor.userId, studentProfileId),
    database.isParentLinkedToStudent(actor.userId, studentProfileId),
  ]);
  requireAllowed(
    authorize(actor, action, { kind: "student", studentProfileId, tutorAssignment, parentLinked }),
  );
}
