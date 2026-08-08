import {
  subjects,
  tutorAvailability,
  tutorDocuments,
  tutorEvaluations,
  tutorGradeRanges,
  tutorLanguages,
  tutorProfiles,
  tutorSubjects,
  tutorSuspensions,
  tutorTrainingRecords,
  tutorVerifications,
  users,
  type Database,
  type Transaction,
} from "@app/db";
import { asc, eq } from "drizzle-orm";

import { TutorError } from "./errors";
import type {
  TutorAvailabilityRule,
  TutorDatabase,
  TutorDocumentRecord,
  TutorEvaluationRecord,
  TutorProfileRecord,
  TutorVerificationRecord,
} from "./models";

type Executor = Database | Transaction;

function mapProfile(row: typeof tutorProfiles.$inferSelect, timeZone: string): TutorProfileRecord {
  return { ...row, timeZone };
}
function mapDocument(row: typeof tutorDocuments.$inferSelect): TutorDocumentRecord {
  return row;
}
function mapVerification(row: typeof tutorVerifications.$inferSelect): TutorVerificationRecord {
  return row;
}

function repository(executor: Executor, root: Database, insideTransaction: boolean): TutorDatabase {
  return {
    transaction<T>(operation: (database: TutorDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },
    async findTutorProfileByUserId(userId) {
      const [row] = await executor
        .select({ profile: tutorProfiles, timeZone: users.primaryTimezone })
        .from(tutorProfiles)
        .innerJoin(users, eq(users.id, tutorProfiles.userId))
        .where(eq(tutorProfiles.userId, userId))
        .limit(1);
      return row ? mapProfile(row.profile, row.timeZone) : null;
    },
    async findTutorProfileById(profileId) {
      const [row] = await executor
        .select({ profile: tutorProfiles, timeZone: users.primaryTimezone })
        .from(tutorProfiles)
        .innerJoin(users, eq(users.id, tutorProfiles.userId))
        .where(eq(tutorProfiles.id, profileId))
        .limit(1);
      return row ? mapProfile(row.profile, row.timeZone) : null;
    },
    async createTutorProfile(id, userId, values) {
      const [row] = await executor
        .insert(tutorProfiles)
        .values({ id, userId, ...values })
        .returning();
      if (!row) throw new Error("Tutor profile insert did not return a row.");
      const [account] = await executor
        .select({ timeZone: users.primaryTimezone })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!account) throw new TutorError("TUTOR_NOT_FOUND", "Tutor account was not found.", 404);
      return mapProfile(row, account.timeZone);
    },
    async updateTutorProfile(profileId, values) {
      const [row] = await executor
        .update(tutorProfiles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(tutorProfiles.id, profileId))
        .returning();
      if (!row) throw new TutorError("TUTOR_NOT_FOUND", "Tutor profile was not found.", 404);
      const [account] = await executor
        .select({ timeZone: users.primaryTimezone })
        .from(users)
        .where(eq(users.id, row.userId))
        .limit(1);
      if (!account) throw new TutorError("TUTOR_NOT_FOUND", "Tutor account was not found.", 404);
      return mapProfile(row, account.timeZone);
    },
    async updateZoomDefaults(profileId, values) {
      const [row] = await executor
        .update(tutorProfiles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(tutorProfiles.id, profileId))
        .returning();
      if (!row) throw new TutorError("TUTOR_NOT_FOUND", "Tutor profile was not found.", 404);
      const [account] = await executor
        .select({ timeZone: users.primaryTimezone })
        .from(users)
        .where(eq(users.id, row.userId))
        .limit(1);
      if (!account) throw new TutorError("TUTOR_NOT_FOUND", "Tutor account was not found.", 404);
      return mapProfile(row, account.timeZone);
    },
    async listSubjects(profileId) {
      const rows = await executor
        .select({
          subjectId: tutorSubjects.subjectId,
          key: subjects.key,
          name: subjects.name,
          isPrimary: tutorSubjects.isPrimary,
        })
        .from(tutorSubjects)
        .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
        .where(eq(tutorSubjects.tutorProfileId, profileId))
        .orderBy(asc(subjects.name));
      return rows;
    },
    async replaceSubjects(profileId, values) {
      await executor.delete(tutorSubjects).where(eq(tutorSubjects.tutorProfileId, profileId));
      if (values.length)
        await executor
          .insert(tutorSubjects)
          .values(values.map((value) => ({ tutorProfileId: profileId, ...value })));
    },
    async listGradeRanges(profileId) {
      return executor
        .select({
          minGrade: tutorGradeRanges.minGrade,
          maxGrade: tutorGradeRanges.maxGrade,
          includesAdult: tutorGradeRanges.includesAdult,
        })
        .from(tutorGradeRanges)
        .where(eq(tutorGradeRanges.tutorProfileId, profileId))
        .orderBy(asc(tutorGradeRanges.id));
    },
    async replaceGradeRanges(profileId, values) {
      await executor.delete(tutorGradeRanges).where(eq(tutorGradeRanges.tutorProfileId, profileId));
      if (values.length)
        await executor
          .insert(tutorGradeRanges)
          .values(values.map((value) => ({ tutorProfileId: profileId, ...value })));
    },
    async listLanguages(profileId) {
      return executor
        .select({
          languageCode: tutorLanguages.languageCode,
          proficiency: tutorLanguages.proficiency,
        })
        .from(tutorLanguages)
        .where(eq(tutorLanguages.tutorProfileId, profileId))
        .orderBy(asc(tutorLanguages.languageCode));
    },
    async replaceLanguages(profileId, values) {
      await executor.delete(tutorLanguages).where(eq(tutorLanguages.tutorProfileId, profileId));
      if (values.length)
        await executor
          .insert(tutorLanguages)
          .values(values.map((value) => ({ tutorProfileId: profileId, ...value })));
    },
    async listAvailability(profileId, timeZone) {
      const rows = await executor
        .select()
        .from(tutorAvailability)
        .where(eq(tutorAvailability.tutorProfileId, profileId))
        .orderBy(asc(tutorAvailability.dayOfWeek), asc(tutorAvailability.startMinute));
      return rows.map((row): TutorAvailabilityRule => ({
        id: row.id,
        dayOfWeek: row.dayOfWeek,
        startMinute: row.startMinute,
        endMinute: row.endMinute,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        timeZone,
      }));
    },
    async replaceAvailability(profileId, values) {
      await executor
        .delete(tutorAvailability)
        .where(eq(tutorAvailability.tutorProfileId, profileId));
      if (values.length)
        await executor
          .insert(tutorAvailability)
          .values(values.map((value) => ({ tutorProfileId: profileId, ...value })));
    },
    async createDocument(values) {
      const [row] = await executor.insert(tutorDocuments).values(values).returning();
      if (!row) throw new Error("Tutor document insert did not return a row.");
      return mapDocument(row);
    },
    async findDocument(documentId) {
      const [row] = await executor
        .select()
        .from(tutorDocuments)
        .where(eq(tutorDocuments.id, documentId))
        .limit(1);
      return row ? mapDocument(row) : null;
    },
    async listDocuments(profileId) {
      const rows = await executor
        .select()
        .from(tutorDocuments)
        .where(eq(tutorDocuments.tutorProfileId, profileId))
        .orderBy(asc(tutorDocuments.uploadedAt));
      return rows.map(mapDocument);
    },
    async listVerifications(profileId) {
      const rows = await executor
        .select()
        .from(tutorVerifications)
        .where(eq(tutorVerifications.tutorProfileId, profileId))
        .orderBy(asc(tutorVerifications.createdAt));
      return rows.map(mapVerification);
    },
    async findVerification(verificationId) {
      const [row] = await executor
        .select()
        .from(tutorVerifications)
        .where(eq(tutorVerifications.id, verificationId))
        .limit(1);
      return row ? mapVerification(row) : null;
    },
    async createVerification(values) {
      const [row] = await executor.insert(tutorVerifications).values(values).returning();
      if (!row) throw new Error("Tutor verification insert did not return a row.");
      return mapVerification(row);
    },
    async reviewVerification(verificationId, values) {
      const [row] = await executor
        .update(tutorVerifications)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(tutorVerifications.id, verificationId))
        .returning();
      if (!row) throw new TutorError("TUTOR_NOT_FOUND", "Verification record was not found.", 404);
      return mapVerification(row);
    },
    async listEvaluations(profileId) {
      const rows = await executor
        .select()
        .from(tutorEvaluations)
        .where(eq(tutorEvaluations.tutorProfileId, profileId))
        .orderBy(asc(tutorEvaluations.evaluationDate));
      return rows.map((row): TutorEvaluationRecord => ({
        ...row,
        score: row.score === null ? null : String(row.score),
      }));
    },
    async listTraining(profileId) {
      const rows = await executor
        .select()
        .from(tutorTrainingRecords)
        .where(eq(tutorTrainingRecords.tutorProfileId, profileId))
        .orderBy(asc(tutorTrainingRecords.createdAt));
      return rows;
    },
    async listSuspensions(profileId) {
      const rows = await executor
        .select()
        .from(tutorSuspensions)
        .where(eq(tutorSuspensions.tutorProfileId, profileId))
        .orderBy(asc(tutorSuspensions.startAt));
      return rows;
    },
  };
}

export function createDrizzleTutorDatabase(database: Database): TutorDatabase {
  return repository(database, database, false);
}
