import {
  auditEvents,
  consentRecords,
  parentProfiles,
  parentStudentLinks,
  studentProfiles,
  users,
  type Database,
  type Transaction,
} from "@app/db";
import { and, desc, eq, isNull } from "drizzle-orm";

import { ConsentError } from "./errors";
import type {
  AuditValues,
  ConsentDatabase,
  ConsentRecord,
  NewConsentRecordValues,
  StudentConsentProfile,
} from "./models";

type Executor = Database | Transaction;

function mapStudent(row: typeof studentProfiles.$inferSelect): StudentConsentProfile {
  return {
    id: row.id,
    userId: row.userId,
    preferredName: row.preferredName,
    isAdultLearner: row.isAdultLearner,
    status: row.status,
  };
}

function mapConsentRecord(row: typeof consentRecords.$inferSelect): ConsentRecord {
  return {
    id: row.id,
    parentProfileId: row.parentProfileId,
    studentProfileId: row.studentProfileId,
    consentVersion: row.consentVersion,
    method: row.method,
    dataCategories: row.dataCategories,
    identityEvidenceRef: row.identityEvidenceRef,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): ConsentDatabase {
  return {
    async transaction<T>(operation: (database: ConsentDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async findParentVerificationStatus(userId) {
      const [row] = await executor
        .select({
          parentProfileId: parentProfiles.id,
          userId: parentProfiles.userId,
          emailVerifiedAt: users.emailVerifiedAt,
          phoneVerifiedAt: users.phoneVerifiedAt,
        })
        .from(parentProfiles)
        .innerJoin(users, eq(users.id, parentProfiles.userId))
        .where(eq(parentProfiles.userId, userId))
        .limit(1);
      return row ?? null;
    },

    async findStudentConsentProfile(studentProfileId) {
      const [row] = await executor
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId))
        .limit(1);
      return row ? mapStudent(row) : null;
    },

    async activateStudentStatus(studentProfileId) {
      const [row] = await executor
        .update(studentProfiles)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(studentProfiles.id, studentProfileId))
        .returning();
      if (!row) throw new ConsentError("STUDENT_NOT_FOUND", "Student was not found.", 404);
      return mapStudent(row);
    },

    async hasNonRevokedConsentRecord(studentProfileId) {
      const [row] = await executor
        .select({ id: consentRecords.id })
        .from(consentRecords)
        .where(
          and(
            eq(consentRecords.studentProfileId, studentProfileId),
            isNull(consentRecords.revokedAt),
          ),
        )
        .limit(1);
      return row !== undefined;
    },

    async listConsentRecords(studentProfileId) {
      const rows = await executor
        .select()
        .from(consentRecords)
        .where(eq(consentRecords.studentProfileId, studentProfileId))
        .orderBy(desc(consentRecords.grantedAt));
      return rows.map(mapConsentRecord);
    },

    async insertConsentRecord(values: NewConsentRecordValues) {
      const [row] = await executor
        .insert(consentRecords)
        .values({ ...values, dataCategories: [...values.dataCategories] })
        .returning();
      if (!row) throw new Error("Consent record insert did not return a row.");
      return mapConsentRecord(row);
    },

    async findPrimaryParentUserId(studentProfileId) {
      const rows = await executor
        .select({ userId: users.id, isPrimary: parentStudentLinks.isPrimary })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .innerJoin(users, eq(users.id, parentProfiles.userId))
        .where(eq(parentStudentLinks.studentProfileId, studentProfileId));
      if (rows.length === 0) return null;
      return (rows.find((row) => row.isPrimary) ?? rows[0])?.userId ?? null;
    },

    async appendAudit(values: AuditValues) {
      await executor.insert(auditEvents).values(values);
    },
  };
}

export function createDrizzleConsentDatabase(database: Database): ConsentDatabase {
  return repository(database, database, false);
}
