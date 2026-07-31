import { authorize, type Actor } from "@app/auth";

import { ConsentError } from "../../../../../packages/domain/consent/errors";
import type { FamilyDatabase } from "../../../../../packages/domain/families/models";
import { parentLinkedToStudent } from "../../../../../packages/domain/families/services";

function requireAllowed(result: ReturnType<typeof authorize>): void {
  if (!result.allowed) {
    throw new ConsentError("FORBIDDEN", result.reason, 403);
  }
}

/**
 * Same improvised workspace gate as `apps/web/app/(app)/families/authorization.ts`'s
 * `authorizeParentWorkspace`, for the same reason documented there: the current `@app/auth`
 * catalog has no parent-profile resource, so `account.create(student)` stands in as the general
 * "this actor has parent capability" check. Staff also satisfy it, covering staff reviewing a
 * family's consent status.
 */
export function authorizeConsentWorkspace(actor: Actor): void {
  requireAllowed(
    authorize(actor, "account.create", { kind: "user_account", targetRole: "student" }),
  );
}

/** Per-student gate for recording consent or activating — mirrors families' `student.manage_profile` reuse. */
export async function authorizeConsentAction(
  familyDatabase: FamilyDatabase,
  actor: Actor,
  studentProfileId: string,
): Promise<void> {
  const parentLinked = await parentLinkedToStudent(familyDatabase, actor.userId, studentProfileId);
  requireAllowed(
    authorize(actor, "student.manage_profile", {
      kind: "student",
      studentProfileId,
      parentLinked,
    }),
  );
}
