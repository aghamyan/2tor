import {
  assignmentRequests,
  auditEvents,
  matchingNotes,
  parentProfiles,
  parentStudentLinks,
  studentProfiles,
  tutorProfiles,
  tutorStudentAssignments,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, eq } from "drizzle-orm";

import { MatchingError } from "./errors";
import type {
  AssignmentRecord,
  AssignmentRequestRecord,
  MatchingDatabase,
  MatchingNoteRecord,
  NewAssignmentRequestValues,
  NewAssignmentValues,
  StudentRecord,
  TutorRecord,
} from "./models";

type Executor = Database | Transaction;

function mapStudent(row: typeof studentProfiles.$inferSelect): StudentRecord {
  return { id: row.id, preferredName: row.preferredName };
}

function mapTutor(row: typeof tutorProfiles.$inferSelect): TutorRecord {
  return { id: row.id, userId: row.userId, publicDisplayName: row.publicDisplayName };
}

function mapAssignment(row: typeof tutorStudentAssignments.$inferSelect): AssignmentRecord {
  return {
    id: row.id,
    tutorProfileId: row.tutorProfileId,
    studentProfileId: row.studentProfileId,
    subjectId: row.subjectId,
    status: row.status,
    startAt: row.startAt,
    endAt: row.endAt,
    endedReason: row.endedReason,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRequest(row: typeof assignmentRequests.$inferSelect): AssignmentRequestRecord {
  return {
    id: row.id,
    requestedByUserId: row.requestedByUserId,
    studentProfileId: row.studentProfileId,
    subjectId: row.subjectId,
    preferredTutorProfileId: row.preferredTutorProfileId,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapNote(row: typeof matchingNotes.$inferSelect): MatchingNoteRecord {
  return {
    id: row.id,
    assignmentRequestId: row.assignmentRequestId,
    tutorStudentAssignmentId: row.tutorStudentAssignmentId,
    authorUserId: row.authorUserId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): MatchingDatabase {
  return {
    async transaction<T>(operation: (database: MatchingDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async findStudentById(studentProfileId) {
      const [row] = await executor
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId))
        .limit(1);
      return row ? mapStudent(row) : null;
    },

    async findTutorById(tutorProfileId) {
      const [row] = await executor
        .select()
        .from(tutorProfiles)
        .where(eq(tutorProfiles.id, tutorProfileId))
        .limit(1);
      return row ? mapTutor(row) : null;
    },

    async findTutorByUserId(userId) {
      const [row] = await executor
        .select()
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, userId))
        .limit(1);
      return row ? mapTutor(row) : null;
    },

    async parentLinkedToStudent(userId, studentProfileId) {
      const [row] = await executor
        .select({ id: parentStudentLinks.id })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(
          and(
            eq(parentProfiles.userId, userId),
            eq(parentStudentLinks.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async createAssignment(values: NewAssignmentValues) {
      const [row] = await executor
        .insert(tutorStudentAssignments)
        .values({ ...values, status: "proposed" })
        .returning();
      if (!row) throw new Error("Assignment insert did not return a row.");
      return mapAssignment(row);
    },

    async findAssignmentById(assignmentId) {
      const [row] = await executor
        .select()
        .from(tutorStudentAssignments)
        .where(eq(tutorStudentAssignments.id, assignmentId))
        .limit(1);
      return row ? mapAssignment(row) : null;
    },

    async updateAssignment(assignmentId, values) {
      const [row] = await executor
        .update(tutorStudentAssignments)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(tutorStudentAssignments.id, assignmentId))
        .returning();
      if (!row) throw new MatchingError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
      return mapAssignment(row);
    },

    async createAssignmentRequest(values: NewAssignmentRequestValues) {
      const [row] = await executor
        .insert(assignmentRequests)
        .values({ ...values, status: "pending" })
        .returning();
      if (!row) throw new Error("Assignment request insert did not return a row.");
      return mapRequest(row);
    },

    async findAssignmentRequestById(requestId) {
      const [row] = await executor
        .select()
        .from(assignmentRequests)
        .where(eq(assignmentRequests.id, requestId))
        .limit(1);
      return row ? mapRequest(row) : null;
    },

    async updateAssignmentRequestStatus(requestId, status) {
      const [row] = await executor
        .update(assignmentRequests)
        .set({ status, updatedAt: new Date() })
        .where(eq(assignmentRequests.id, requestId))
        .returning();
      if (!row)
        throw new MatchingError("REQUEST_NOT_FOUND", "Matching request was not found.", 404);
      return mapRequest(row);
    },

    async listPendingAssignmentRequests() {
      const rows = await executor
        .select()
        .from(assignmentRequests)
        .where(eq(assignmentRequests.status, "pending"))
        .orderBy(asc(assignmentRequests.createdAt));
      return rows.map(mapRequest);
    },

    async createMatchingNote(values) {
      const [row] = await executor.insert(matchingNotes).values(values).returning();
      if (!row) throw new Error("Matching note insert did not return a row.");
      return mapNote(row);
    },

    async appendAudit(values) {
      await executor.insert(auditEvents).values(values);
    },
  };
}

export function createDrizzleMatchingDatabase(database: Database): MatchingDatabase {
  return repository(database, database, false);
}
