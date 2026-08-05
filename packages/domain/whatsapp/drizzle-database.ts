import {
  auditEvents,
  parentProfiles,
  parentStudentLinks,
  studentProfiles,
  tutorProfiles,
  tutorStudentAssignments,
  users,
  whatsappGroupMembers,
  whatsappGroups,
  type Database,
  type Transaction,
} from "@app/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { ulid } from "ulid";

import { WhatsAppError } from "./errors";
import type {
  AuditValues,
  GroupCandidates,
  GroupPreferenceValues,
  NewGroupMemberValues,
  WhatsAppDatabase,
  WhatsAppGroupMemberRecord,
  WhatsAppGroupRecord,
} from "./models";

type Executor = Database | Transaction;

function mapGroup(row: typeof whatsappGroups.$inferSelect): WhatsAppGroupRecord {
  return {
    id: row.id,
    studentProfileId: row.studentProfileId,
    status: row.status,
    providerGroupId: row.providerGroupId,
    inviteLink: row.inviteLink,
    reminderLeadMinutes: row.reminderLeadMinutes,
    isEnabled: row.isEnabled,
    includeChild: row.includeChild,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMember(row: typeof whatsappGroupMembers.$inferSelect): WhatsAppGroupMemberRecord {
  return {
    id: row.id,
    whatsappGroupId: row.whatsappGroupId,
    userId: row.userId,
    role: row.role,
    phoneNumber: row.phoneNumber,
    status: row.status,
    invitedAt: row.invitedAt,
    joinedAt: row.joinedAt,
    createdAt: row.createdAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): WhatsAppDatabase {
  return {
    async transaction<T>(operation: (database: WhatsAppDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async findGroupByStudentId(studentProfileId) {
      const [row] = await executor
        .select()
        .from(whatsappGroups)
        .where(eq(whatsappGroups.studentProfileId, studentProfileId))
        .limit(1);
      return row ? mapGroup(row) : null;
    },

    async upsertGroupPreferences(studentProfileId, values: GroupPreferenceValues) {
      const [row] = await executor
        .insert(whatsappGroups)
        .values({
          id: ulid(),
          studentProfileId,
          isEnabled: values.isEnabled,
          reminderLeadMinutes: values.reminderLeadMinutes,
          includeChild: values.includeChild,
          updatedByUserId: values.updatedByUserId,
        })
        .onConflictDoUpdate({
          target: whatsappGroups.studentProfileId,
          set: {
            isEnabled: values.isEnabled,
            reminderLeadMinutes: values.reminderLeadMinutes,
            includeChild: values.includeChild,
            updatedByUserId: values.updatedByUserId,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) throw new Error("WhatsApp group preference upsert did not return a row.");
      return mapGroup(row);
    },

    async markGroupActive(studentProfileId, values) {
      const [row] = await executor
        .update(whatsappGroups)
        .set({
          status: "active",
          providerGroupId: values.providerGroupId,
          inviteLink: values.inviteLink,
          updatedAt: new Date(),
        })
        .where(eq(whatsappGroups.studentProfileId, studentProfileId))
        .returning();
      if (!row) throw new WhatsAppError("STUDENT_NOT_FOUND", "WhatsApp group was not found.", 404);
      return mapGroup(row);
    },

    async resolveGroupCandidates(studentProfileId): Promise<GroupCandidates> {
      const now = new Date();

      const [studentRow] = await executor
        .select({
          userId: studentProfiles.userId,
          displayName: studentProfiles.preferredName,
          phone: studentProfiles.phone,
          locale: users.locale,
        })
        .from(studentProfiles)
        .innerJoin(users, eq(users.id, studentProfiles.userId))
        .where(eq(studentProfiles.id, studentProfileId))
        .limit(1);

      const parentRows = await executor
        .select({
          userId: parentProfiles.userId,
          phone: parentProfiles.phone,
          locale: users.locale,
        })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .innerJoin(users, eq(users.id, parentProfiles.userId))
        .where(eq(parentStudentLinks.studentProfileId, studentProfileId));

      const tutorRows = await executor
        .select({
          userId: tutorProfiles.userId,
          phone: tutorProfiles.phone,
          locale: users.locale,
        })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .innerJoin(users, eq(users.id, tutorProfiles.userId))
        .where(
          and(
            eq(tutorStudentAssignments.studentProfileId, studentProfileId),
            eq(tutorStudentAssignments.status, "active"),
            or(isNull(tutorStudentAssignments.endAt), gt(tutorStudentAssignments.endAt, now)),
          ),
        );

      const dedupeByUserId = <T extends { userId: string; phone: string | null }>(rows: T[]): T[] => {
        const seen = new Map<string, T>();
        for (const row of rows) {
          if (!row.phone) continue;
          if (!seen.has(row.userId)) seen.set(row.userId, row);
        }
        return [...seen.values()];
      };

      return {
        student:
          studentRow?.phone
            ? {
                userId: studentRow.userId,
                phone: studentRow.phone,
                locale: studentRow.locale,
                displayName: studentRow.displayName,
              }
            : null,
        parents: dedupeByUserId(parentRows).map((row) => ({
          userId: row.userId,
          phone: row.phone as string,
          locale: row.locale,
        })),
        tutors: dedupeByUserId(tutorRows).map((row) => ({
          userId: row.userId,
          phone: row.phone as string,
          locale: row.locale,
        })),
      };
    },

    async listGroupMembers(whatsappGroupId) {
      const rows = await executor
        .select()
        .from(whatsappGroupMembers)
        .where(eq(whatsappGroupMembers.whatsappGroupId, whatsappGroupId));
      return rows.map(mapMember);
    },

    async insertGroupMember(values: NewGroupMemberValues) {
      const [row] = await executor.insert(whatsappGroupMembers).values(values).returning();
      if (!row) throw new Error("WhatsApp group member insert did not return a row.");
      return mapMember(row);
    },

    async appendAudit(values: AuditValues) {
      await executor.insert(auditEvents).values(values);
    },
  };
}

export function createDrizzleWhatsAppDatabase(database: Database): WhatsAppDatabase {
  return repository(database, database, false);
}
