import {
  auditEvents,
  parentProfiles,
  parentStudentLinks,
  roles,
  studentInterests,
  studentPreferences,
  studentProfiles,
  userRoles,
  users,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, eq, gt } from "drizzle-orm";
import { ulid } from "ulid";

import { FamilyError } from "./errors";
import type {
  AuditValues,
  FamilyDatabase,
  NewParentStudentLinkValues,
  NewStudentProfileValues,
  ParentProfileRecord,
  ParentStudentLinkRecord,
  StudentAccountValues,
  StudentFamilySummary,
  StudentProfileRecord,
  StudentProfileValues,
} from "./models";

type Executor = Database | Transaction;

function mapParent(row: typeof parentProfiles.$inferSelect): ParentProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    phone: row.phone,
    contentLanguagePreference: row.contentLanguagePreference,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapStudent(
  row: typeof studentProfiles.$inferSelect,
  account: Pick<typeof users.$inferSelect, "username" | "primaryTimezone" | "locale">,
): StudentProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    username: account.username ?? "",
    preferredName: row.preferredName,
    gradeLevel: row.gradeLevel,
    isAdultLearner: row.isAdultLearner,
    usState: row.usState,
    dobYearMonth: row.dobYearMonth,
    ageBand: row.ageBand,
    status: row.status,
    primaryTimezone: account.primaryTimezone,
    locale: account.locale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLink(row: typeof parentStudentLinks.$inferSelect): ParentStudentLinkRecord {
  return {
    id: row.id,
    parentProfileId: row.parentProfileId,
    studentProfileId: row.studentProfileId,
    relationship: row.relationship,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): FamilyDatabase {
  return {
    async transaction<T>(operation: (database: FamilyDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async findParentProfileByUserId(userId) {
      const [row] = await executor
        .select()
        .from(parentProfiles)
        .where(eq(parentProfiles.userId, userId))
        .limit(1);
      return row ? mapParent(row) : null;
    },

    async findParentProfileById(parentProfileId) {
      const [row] = await executor
        .select()
        .from(parentProfiles)
        .where(eq(parentProfiles.id, parentProfileId))
        .limit(1);
      return row ? mapParent(row) : null;
    },

    async createParentProfile(id, userId, values) {
      const [row] = await executor
        .insert(parentProfiles)
        .values({ id, userId, ...values })
        .returning();
      if (!row) throw new Error("Parent profile insert did not return a row.");
      return mapParent(row);
    },

    async updateParentProfile(parentProfileId, values) {
      const [row] = await executor
        .update(parentProfiles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(parentProfiles.id, parentProfileId))
        .returning();
      if (!row) throw new FamilyError("PARENT_NOT_FOUND", "Parent was not found.", 404);
      return mapParent(row);
    },

    async findStudentById(studentProfileId) {
      const [row] = await executor
        .select({ profile: studentProfiles, account: users })
        .from(studentProfiles)
        .innerJoin(users, eq(users.id, studentProfiles.userId))
        .where(eq(studentProfiles.id, studentProfileId))
        .limit(1);
      return row ? mapStudent(row.profile, row.account) : null;
    },

    async findStudentByUsername(username) {
      const [row] = await executor
        .select({ profile: studentProfiles, account: users })
        .from(studentProfiles)
        .innerJoin(users, eq(users.id, studentProfiles.userId))
        .where(eq(users.username, username))
        .limit(1);
      return row ? mapStudent(row.profile, row.account) : null;
    },

    async createStudentAccount(values: StudentAccountValues) {
      const [studentRole] = await executor
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.key, "student"))
        .limit(1);
      if (!studentRole) {
        throw new FamilyError("STUDENT_ROLE_MISSING", "The student role is not configured.", 500);
      }
      await executor.insert(users).values({
        id: values.id,
        username: values.username,
        primaryTimezone: values.primaryTimezone,
        locale: values.locale,
        status: "pending",
      });
      await executor.insert(userRoles).values({
        id: ulid(),
        userId: values.id,
        roleId: studentRole.id,
      });
    },

    async createStudentProfile(values: NewStudentProfileValues) {
      const [row] = await executor.insert(studentProfiles).values(values).returning();
      if (!row) throw new Error("Student profile insert did not return a row.");
      const [account] = await executor
        .select({
          username: users.username,
          primaryTimezone: users.primaryTimezone,
          locale: users.locale,
        })
        .from(users)
        .where(eq(users.id, values.userId))
        .limit(1);
      if (!account) throw new Error("Student account was not found after insert.");
      return mapStudent(row, account);
    },

    async updateStudentProfile(studentProfileId, values: StudentProfileValues) {
      const [row] = await executor
        .update(studentProfiles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(studentProfiles.id, studentProfileId))
        .returning();
      if (!row) throw new FamilyError("STUDENT_NOT_FOUND", "Student was not found.", 404);
      const [account] = await executor
        .select({
          username: users.username,
          primaryTimezone: users.primaryTimezone,
          locale: users.locale,
        })
        .from(users)
        .where(eq(users.id, row.userId))
        .limit(1);
      if (!account) throw new Error("Student account was not found.");
      return mapStudent(row, account);
    },

    async findLink(parentProfileId, studentProfileId) {
      const [row] = await executor
        .select()
        .from(parentStudentLinks)
        .where(
          and(
            eq(parentStudentLinks.parentProfileId, parentProfileId),
            eq(parentStudentLinks.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return row ? mapLink(row) : null;
    },

    async listLinksForStudent(studentProfileId) {
      const rows = await executor
        .select()
        .from(parentStudentLinks)
        .where(eq(parentStudentLinks.studentProfileId, studentProfileId))
        .orderBy(asc(parentStudentLinks.id));
      return rows.map(mapLink);
    },

    async createLink(values: NewParentStudentLinkValues) {
      const [row] = await executor.insert(parentStudentLinks).values(values).returning();
      if (!row) throw new Error("Family link insert did not return a row.");
      return mapLink(row);
    },

    async deleteLink(linkId) {
      await executor.delete(parentStudentLinks).where(eq(parentStudentLinks.id, linkId));
    },

    async listInterests(studentProfileId) {
      const rows = await executor
        .select({ interest: studentInterests.interest })
        .from(studentInterests)
        .where(eq(studentInterests.studentProfileId, studentProfileId))
        .orderBy(asc(studentInterests.interest));
      return rows.map((row) => row.interest);
    },

    async replaceInterests(studentProfileId, interests) {
      await executor
        .delete(studentInterests)
        .where(eq(studentInterests.studentProfileId, studentProfileId));
      if (interests.length > 0) {
        await executor.insert(studentInterests).values(
          interests.map((interest) => ({
            id: ulid(),
            studentProfileId,
            interest,
          })),
        );
      }
    },

    async getPreferences(studentProfileId) {
      const [row] = await executor
        .select()
        .from(studentPreferences)
        .where(eq(studentPreferences.studentProfileId, studentProfileId))
        .limit(1);
      if (!row) return null;
      return {
        studentProfileId: row.studentProfileId,
        preferredLessonStyle: row.preferredLessonStyle,
        availabilityNotes: row.availabilityNotes,
        notes: row.notes,
        updatedAt: row.updatedAt,
      };
    },

    async savePreferences(studentProfileId, values) {
      const [row] = await executor
        .insert(studentPreferences)
        .values({ id: ulid(), studentProfileId, ...values })
        .onConflictDoUpdate({
          target: studentPreferences.studentProfileId,
          set: { ...values, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error("Student preferences upsert did not return a row.");
      return {
        studentProfileId: row.studentProfileId,
        preferredLessonStyle: row.preferredLessonStyle,
        availabilityNotes: row.availabilityNotes,
        notes: row.notes,
        updatedAt: row.updatedAt,
      };
    },

    async listStudentsForParent(parentProfileId, cursor, limit) {
      const where = cursor
        ? and(
            eq(parentStudentLinks.parentProfileId, parentProfileId),
            gt(studentProfiles.id, cursor),
          )
        : eq(parentStudentLinks.parentProfileId, parentProfileId);
      const rows = await executor
        .select({
          id: studentProfiles.id,
          parentProfileId: parentStudentLinks.parentProfileId,
          preferredName: studentProfiles.preferredName,
          username: users.username,
          gradeLevel: studentProfiles.gradeLevel,
          ageBand: studentProfiles.ageBand,
          dobYearMonth: studentProfiles.dobYearMonth,
          status: studentProfiles.status,
          relationship: parentStudentLinks.relationship,
          isPrimary: parentStudentLinks.isPrimary,
        })
        .from(parentStudentLinks)
        .innerJoin(studentProfiles, eq(studentProfiles.id, parentStudentLinks.studentProfileId))
        .innerJoin(users, eq(users.id, studentProfiles.userId))
        .where(where)
        .orderBy(asc(studentProfiles.id))
        .limit(limit);
      return rows.map((row): StudentFamilySummary => ({
        ...row,
        username: row.username ?? "",
      }));
    },

    async getStudentForParent(parentProfileId, studentProfileId) {
      const [row] = await executor
        .select({
          id: studentProfiles.id,
          parentProfileId: parentStudentLinks.parentProfileId,
          preferredName: studentProfiles.preferredName,
          username: users.username,
          gradeLevel: studentProfiles.gradeLevel,
          ageBand: studentProfiles.ageBand,
          dobYearMonth: studentProfiles.dobYearMonth,
          status: studentProfiles.status,
          relationship: parentStudentLinks.relationship,
          isPrimary: parentStudentLinks.isPrimary,
        })
        .from(parentStudentLinks)
        .innerJoin(studentProfiles, eq(studentProfiles.id, parentStudentLinks.studentProfileId))
        .innerJoin(users, eq(users.id, studentProfiles.userId))
        .where(
          and(
            eq(parentStudentLinks.parentProfileId, parentProfileId),
            eq(studentProfiles.id, studentProfileId),
          ),
        )
        .limit(1);
      return row ? { ...row, username: row.username ?? "" } : null;
    },

    async appendAudit(values: AuditValues) {
      await executor.insert(auditEvents).values(values);
    },
  };
}

export function createDrizzleFamilyDatabase(database: Database): FamilyDatabase {
  return repository(database, database, false);
}
