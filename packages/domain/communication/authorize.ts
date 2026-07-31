// The domain workspace does not declare @app/auth as a direct package dependency and package.json
// is outside this slice's allowed edits. This source import still uses the canonical auth engine.
import { authorize, type Action } from "../../auth/src/index";

import { CommunicationError } from "./errors";
import type {
  CommunicationActor,
  ConversationMemberRecord,
  ConversationMemberRole,
} from "./models";

export function hasUnsafeAdultChildMembership(
  members: readonly (Pick<ConversationMemberRecord, "role"> &
    Partial<Pick<ConversationMemberRecord, "leftAt">>)[],
): boolean {
  const active = members.filter((member) => member.leftAt === undefined || member.leftAt === null);
  const roles = new Set<ConversationMemberRole>(active.map((member) => member.role));
  const hasStudent = roles.has("student");
  const isExactlyOneAdultAndOneChild =
    active.length === 2 && hasStudent && active.some((member) => member.role !== "student");
  return (hasStudent && !roles.has("parent")) || isExactlyOneAdultAndOneChild;
}

/**
 * Communication's mandatory authorization adapter. It calculates the hard-prohibition flag from
 * persisted members rather than accepting a caller-provided boolean, then delegates role grants
 * to @app/auth. Malformed legacy rows are therefore unreadable as well as unwritable.
 */
export function authorizeConversationAction(
  actor: CommunicationActor,
  action: Extract<Action, "message.send" | "message.read">,
  members: readonly ConversationMemberRecord[],
): void {
  const isPrivateAdultChildChannel = hasUnsafeAdultChildMembership(members);
  if (isPrivateAdultChildChannel) {
    throw new CommunicationError(
      "PARENT_REQUIRED",
      "A child-visible conversation requires a parent plus at least one additional participant.",
      403,
    );
  }
  const activeMembers = members.filter((member) => member.leftAt === null);
  const decision = authorize(actor, action, {
    kind: "message",
    isAcademic: true,
    isMember: activeMembers.some((member) => member.userId === actor.userId),
    isPrivateAdultChildChannel,
  });
  if (!decision.allowed) {
    throw new CommunicationError("FORBIDDEN", decision.reason, 403);
  }
}

export function authorizeStaffConversationAccess(
  actor: CommunicationActor,
  members: readonly ConversationMemberRecord[],
  reasonProvided: boolean,
): void {
  if (hasUnsafeAdultChildMembership(members)) {
    throw new CommunicationError(
      "PARENT_REQUIRED",
      "A child-visible conversation requires a parent plus at least one additional participant.",
      403,
    );
  }
  const decision = authorize(actor, "message.access_as_staff", {
    kind: "message",
    isAcademic: true,
    isMember: members.some((member) => member.leftAt === null && member.userId === actor.userId),
    isPrivateAdultChildChannel: false,
    reasonProvided,
  });
  if (!decision.allowed) {
    throw new CommunicationError(
      decision.reason === "reason_required" ? "STAFF_REASON_REQUIRED" : "FORBIDDEN",
      decision.reason === "reason_required"
        ? "Staff must record an operational or safety reason before reading messages."
        : decision.reason,
      403,
    );
  }
}
