import { redirect } from "next/navigation";

import { isWhatsAppError } from "../../../../../packages/domain/whatsapp/errors";
import type { WhatsAppGroupMemberRecord, WhatsAppGroupRecord } from "../../../../../packages/domain/whatsapp/models";
import { authorizeWhatsAppGroupAccess } from "../../../../../packages/domain/whatsapp/services";
import { currentWhatsAppContext } from "./context";

export interface WhatsAppOverviewStudent {
  studentProfileId: string;
  displayName: string;
}

export interface WhatsAppOverviewData {
  students: WhatsAppOverviewStudent[];
}

/** Parent-only for now — staff manage a specific student's group by navigating to its URL directly. */
export async function loadWhatsAppOverview(): Promise<WhatsAppOverviewData> {
  try {
    const context = await currentWhatsAppContext();
    const parent = await context.familyDatabase.findParentProfileByUserId(context.actor.userId);
    if (!parent) return { students: [] };
    const students = await context.familyDatabase.listStudentsForParent(parent.id, null, 50);
    return {
      students: students.map((student) => ({
        studentProfileId: student.id,
        displayName: student.preferredName,
      })),
    };
  } catch (error) {
    if (isWhatsAppError(error) && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export interface WhatsAppGroupSettingsData {
  studentProfileId: string;
  studentDisplayName: string;
  group: WhatsAppGroupRecord | null;
  members: WhatsAppGroupMemberRecord[];
}

export async function loadWhatsAppGroupSettings(
  studentProfileId: string,
): Promise<WhatsAppGroupSettingsData> {
  try {
    const context = await currentWhatsAppContext();
    // Same check `updateGroupPreferences`/`syncGroupMembership` apply before writing — reads of
    // another family's group configuration are just as protected (CONVENTIONS.md: every
    // protected operation needs a server-side authorization check, not only writes).
    await authorizeWhatsAppGroupAccess(context.familyDatabase, context.actor, studentProfileId);
    const student = await context.familyDatabase.findStudentById(studentProfileId);
    if (!student) redirect("/whatsapp");
    const group = await context.database.findGroupByStudentId(studentProfileId);
    const members = group ? await context.database.listGroupMembers(group.id) : [];
    return { studentProfileId, studentDisplayName: student.preferredName, group, members };
  } catch (error) {
    if (isWhatsAppError(error) && error.code === "UNAUTHENTICATED") redirect("/login");
    if (isWhatsAppError(error) && error.code === "STUDENT_NOT_FOUND") redirect("/whatsapp");
    throw error;
  }
}
