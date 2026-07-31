import { authorize, type Action, type Actor } from "@app/auth";

import { FamilyError } from "../../../../../packages/domain/families/errors";
import type { FamilyDatabase } from "../../../../../packages/domain/families/models";
import { parentLinkedToStudent } from "../../../../../packages/domain/families/services";

function requireAllowed(result: ReturnType<typeof authorize>): void {
  if (!result.allowed) {
    throw new FamilyError("FORBIDDEN", result.reason, 403);
  }
}

/**
 * The current auth catalog has no parent-profile resource. `account.create(student)` is its
 * explicit parent capability and is used as the workspace gate until that catalog is expanded.
 * Domain services still require the actor's parent role and own parent profile.
 */
export function authorizeParentWorkspace(actor: Actor): void {
  requireAllowed(
    authorize(actor, "account.create", { kind: "user_account", targetRole: "student" }),
  );
}

export async function authorizeStudentRelationship(
  database: FamilyDatabase,
  actor: Actor,
  studentProfileId: string,
  action: Extract<Action, "student.view_profile" | "student.manage_profile">,
): Promise<void> {
  const parentLinked = await parentLinkedToStudent(database, actor.userId, studentProfileId);
  requireAllowed(
    authorize(actor, action, {
      kind: "student",
      studentProfileId,
      parentLinked,
    }),
  );
}
