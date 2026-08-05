import { ulid } from "ulid";

import type { ConsentDatabase } from "../consent/models";
import { hasValidConsent } from "../consent/services";
import type { FamilyDatabase } from "../families/models";
import { parentLinkedToStudent } from "../families/services";
import { WhatsAppError } from "./errors";
import type {
  WhatsAppActor,
  WhatsAppDatabase,
  WhatsAppGroupRecord,
  WhatsAppSender,
} from "./models";
import { updateGroupPreferencesInputSchema, type UpdateGroupPreferencesInput } from "./schemas";

function isStaff(actor: WhatsAppActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

/**
 * Defense in depth, same rationale as `packages/domain/consent/services.ts`'s
 * `requireLinkedStudent`: the web layer authorizes first, but this must not be the only gate.
 * Staff bypass the link check; everyone else must be the student's linked parent. Exported so
 * `apps/web/app/(app)/whatsapp/queries.ts` can apply the identical check to read paths, rather
 * than re-implementing it against `parentLinkedToStudent` a second time.
 */
export async function authorizeWhatsAppGroupAccess(
  familyDatabase: FamilyDatabase,
  actor: WhatsAppActor | null | undefined,
  studentProfileId: string,
): Promise<WhatsAppActor> {
  if (!actor) throw new WhatsAppError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
  if (isStaff(actor)) return actor;
  if (!actor.roles.includes("parent")) {
    throw new WhatsAppError("FORBIDDEN", "Only a parent or staff can manage WhatsApp settings.", 403);
  }
  const linked = await parentLinkedToStudent(familyDatabase, actor.userId, studentProfileId);
  if (!linked) throw new WhatsAppError("STUDENT_NOT_FOUND", "Student was not found.", 404);
  return actor;
}

/**
 * Updates a student's WhatsApp group preferences (opt-in, reminder lead time, whether the
 * child's own number is included). This never talks to `@app/whatsapp` or creates/syncs the
 * group itself — that's `syncGroupMembership` below, called separately by the UI action.
 *
 * `includeChild` is gated on `hasValidConsent` (imported read-only from `packages/domain/consent`,
 * never reimplemented here) — a child's phone number is never added to a third-party platform
 * without a verified parental consent record on file. An audit event is appended the moment
 * `includeChild` transitions from off to on, since that's the point a minor's contact
 * information is being exposed to WhatsApp.
 */
export async function updateGroupPreferences(
  whatsappDatabase: WhatsAppDatabase,
  familyDatabase: FamilyDatabase,
  consentDatabase: ConsentDatabase,
  actor: WhatsAppActor | null | undefined,
  input: UpdateGroupPreferencesInput,
): Promise<WhatsAppGroupRecord> {
  const values = updateGroupPreferencesInputSchema.parse(input);
  const resolvedActor = await authorizeWhatsAppGroupAccess(familyDatabase, actor, values.studentProfileId);

  if (values.includeChild) {
    const consented = await hasValidConsent(consentDatabase, values.studentProfileId);
    if (!consented) {
      throw new WhatsAppError(
        "CONSENT_REQUIRED",
        "A valid parental consent record is required before including a child's number.",
        409,
      );
    }
  }

  const existing = await whatsappDatabase.findGroupByStudentId(values.studentProfileId);
  const includingChildForFirstTime = values.includeChild && !(existing?.includeChild ?? false);

  return whatsappDatabase.transaction(async (transaction) => {
    const record = await transaction.upsertGroupPreferences(values.studentProfileId, {
      isEnabled: values.isEnabled,
      reminderLeadMinutes: values.reminderLeadMinutes,
      includeChild: values.includeChild,
      updatedByUserId: resolvedActor.userId,
    });
    if (includingChildForFirstTime) {
      await transaction.appendAudit({
        id: ulid(),
        actorUserId: resolvedActor.userId,
        action: "whatsapp.include_child_enabled",
        resourceType: "whatsapp_groups",
        resourceId: record.id,
        reason: "Parent opted the child's own number into the WhatsApp group.",
        newValue: { studentProfileId: values.studentProfileId },
      });
    }
    return record;
  });
}

/**
 * Idempotent membership sync — NOT one-shot provisioning. Safe (and expected) to call repeatedly:
 * the first call (group `status: "not_provisioned"`) creates the group via `sender`; every call
 * after that reconciles current tutor assignments + linked parents (+ the student, if opted in
 * and consented) against `whatsapp_group_members`, inviting anyone missing. A student is never
 * added unless the resolved parent list is non-empty — mirroring
 * `packages/domain/communication/authorize.ts`'s `hasUnsafeAdultChildMembership` invariant (no
 * private adult-only channel with a minor), even though that function lives in a different module
 * and isn't imported here.
 *
 * No removal path in this phase: a tutor whose assignment later ends stays a group member until
 * phase 2 wires `removeParticipant` to an unassignment event (see README, "Known gaps").
 */
export async function syncGroupMembership(
  whatsappDatabase: WhatsAppDatabase,
  familyDatabase: FamilyDatabase,
  consentDatabase: ConsentDatabase,
  sender: WhatsAppSender,
  actor: WhatsAppActor | null | undefined,
  studentProfileId: string,
): Promise<WhatsAppGroupRecord> {
  const resolvedActor = await authorizeWhatsAppGroupAccess(familyDatabase, actor, studentProfileId);

  let group = await whatsappDatabase.findGroupByStudentId(studentProfileId);
  if (!group || !group.isEnabled) {
    throw new WhatsAppError(
      "GROUP_NOT_ENABLED",
      "Enable WhatsApp notifications before setting up the group.",
      409,
    );
  }

  const candidates = await whatsappDatabase.resolveGroupCandidates(studentProfileId);
  if (candidates.parents.length === 0) {
    throw new WhatsAppError(
      "NO_PARENT_LINKED",
      "At least one linked parent with a phone number is required before the group can be set up.",
      409,
    );
  }
  if (group.status === "not_provisioned" && candidates.tutors.length === 0) {
    throw new WhatsAppError(
      "NO_TUTOR_ASSIGNED",
      "An active tutor assignment is required before the group can be set up.",
      409,
    );
  }

  if (group.status === "not_provisioned") {
    const subject = candidates.student ? `2tor — ${candidates.student.displayName}` : "2tor";
    const created = await sender.createGroup(subject, "2tor lesson reminders and updates.");
    group = await whatsappDatabase.markGroupActive(studentProfileId, created);
  }

  const existingMembers = await whatsappDatabase.listGroupMembers(group.id);
  const existingUserIds = new Set(existingMembers.map((member) => member.userId));

  const desired: Array<{ userId: string; phone: string; locale: "en" | "hy"; role: "tutor" | "parent" | "student" }> = [
    ...candidates.tutors.map((tutor) => ({ ...tutor, role: "tutor" as const })),
    ...candidates.parents.map((parent) => ({ ...parent, role: "parent" as const })),
  ];
  if (group.includeChild && candidates.student) {
    const consented = await hasValidConsent(consentDatabase, studentProfileId);
    if (consented) desired.push({ ...candidates.student, role: "student" as const });
  }

  const studentDisplayName = candidates.student?.displayName ?? "your student";
  for (const member of desired) {
    if (existingUserIds.has(member.userId)) continue;
    const inserted = await whatsappDatabase.insertGroupMember({
      id: ulid(),
      whatsappGroupId: group.id,
      userId: member.userId,
      role: member.role,
      phoneNumber: member.phone,
    });
    await sender.sendInviteLink({
      phone: member.phone,
      locale: member.locale,
      inviteLink: group.inviteLink ?? "",
      studentDisplayName,
    });
    if (member.role === "student") {
      await whatsappDatabase.appendAudit({
        id: ulid(),
        actorUserId: resolvedActor.userId,
        action: "whatsapp.student_added_to_group",
        resourceType: "whatsapp_group_members",
        resourceId: inserted.id,
        reason: "Student's own number was added to the WhatsApp group after parent opt-in and consent verification.",
        newValue: { studentProfileId },
      });
    }
  }

  return group;
}
