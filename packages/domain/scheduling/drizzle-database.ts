import {
  attendance,
  auditEvents,
  cancellations,
  lessonParticipants,
  lessons,
  lessonSeries,
  parentProfiles,
  parentStudentLinks,
  studentProfiles,
  subjects,
  tutorProfiles,
  tutorStudentAssignments,
  tutorSubjects,
  zoomMeetings,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, desc, eq, gt, gte, isNull, lte, or } from "drizzle-orm";

import type {
  AssignmentFact,
  AttendanceRecord,
  AuditValues,
  CancellationRecord,
  LessonListRange,
  LessonListScope,
  LessonParticipantRecord,
  LessonRecord,
  LessonSeriesRecord,
  NewAttendanceValues,
  NewCancellationValues,
  NewLessonParticipantValues,
  NewLessonSeriesValues,
  NewLessonValues,
  NewZoomMeetingValues,
  SchedulableAssignmentOption,
  SchedulingDatabase,
  SubjectOption,
  ZoomMeetingRecord,
} from "./models";

type Executor = Database | Transaction;

const lessonColumns = {
  id: lessons.id,
  lessonSeriesId: lessons.lessonSeriesId,
  tutorStudentAssignmentId: lessons.tutorStudentAssignmentId,
  subjectId: lessons.subjectId,
  scheduledStartAt: lessons.scheduledStartAt,
  scheduledEndAt: lessons.scheduledEndAt,
  status: lessons.status,
  timezoneAtBooking: lessons.timezoneAtBooking,
  isTrial: lessons.isTrial,
  createdAt: lessons.createdAt,
  updatedAt: lessons.updatedAt,
} as const;

function mapLesson(row: typeof lessons.$inferSelect): LessonRecord {
  return {
    id: row.id,
    lessonSeriesId: row.lessonSeriesId,
    tutorStudentAssignmentId: row.tutorStudentAssignmentId,
    subjectId: row.subjectId,
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: row.scheduledEndAt,
    status: row.status,
    timezoneAtBooking: row.timezoneAtBooking,
    isTrial: row.isTrial,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSeries(row: typeof lessonSeries.$inferSelect): LessonSeriesRecord {
  return {
    id: row.id,
    tutorStudentAssignmentId: row.tutorStudentAssignmentId,
    subjectId: row.subjectId,
    recurrenceRule: row.recurrenceRule ?? "",
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapParticipant(row: typeof lessonParticipants.$inferSelect): LessonParticipantRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    userId: row.userId,
    role: row.role,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
  };
}

function mapZoom(row: typeof zoomMeetings.$inferSelect): ZoomMeetingRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    zoomMeetingId: row.zoomMeetingId,
    joinUrl: row.joinUrl,
    startUrl: row.startUrl,
    passcode: row.passcode,
  };
}

function mapCancellation(row: typeof cancellations.$inferSelect): CancellationRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    canceledByUserId: row.canceledByUserId,
    reason: row.reason,
    category: row.category,
    canceledAt: row.canceledAt,
    chargeApplied: row.chargeApplied,
  };
}

function mapAttendance(row: typeof attendance.$inferSelect): AttendanceRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    studentProfileId: row.studentProfileId,
    status: row.status,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
    recordedByUserId: row.recordedByUserId,
    notes: row.notes,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): SchedulingDatabase {
  return {
    async transaction<T>(operation: (database: SchedulingDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async findAssignmentById(assignmentId): Promise<AssignmentFact | null> {
      const [row] = await executor
        .select({
          id: tutorStudentAssignments.id,
          tutorProfileId: tutorStudentAssignments.tutorProfileId,
          tutorUserId: tutorProfiles.userId,
          studentProfileId: tutorStudentAssignments.studentProfileId,
          studentUserId: studentProfiles.userId,
          subjectId: tutorStudentAssignments.subjectId,
          status: tutorStudentAssignments.status,
          endAt: tutorStudentAssignments.endAt,
        })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .innerJoin(
          studentProfiles,
          eq(studentProfiles.id, tutorStudentAssignments.studentProfileId),
        )
        .where(eq(tutorStudentAssignments.id, assignmentId))
        .limit(1);
      return row ?? null;
    },

    async resolveTutorProfileIdForUser(userId) {
      const [row] = await executor
        .select({ id: tutorProfiles.id })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },

    async resolveStudentProfileIdForUser(userId) {
      const [row] = await executor
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },

    async resolveParentProfileIdForUser(userId) {
      const [row] = await executor
        .select({ id: parentProfiles.id })
        .from(parentProfiles)
        .where(eq(parentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },

    async isParentLinkedToStudent(parentUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: parentStudentLinks.id })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(
          and(
            eq(parentProfiles.userId, parentUserId),
            eq(parentStudentLinks.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return row !== undefined;
    },

    async listSchedulableAssignments(tutorProfileId): Promise<SchedulableAssignmentOption[]> {
      const conditions = [
        eq(tutorStudentAssignments.status, "active"),
        or(isNull(tutorStudentAssignments.endAt), gt(tutorStudentAssignments.endAt, new Date())),
      ];
      if (tutorProfileId) conditions.push(eq(tutorStudentAssignments.tutorProfileId, tutorProfileId));

      const rows = await executor
        .select({
          id: tutorStudentAssignments.id,
          studentProfileId: tutorStudentAssignments.studentProfileId,
          studentName: studentProfiles.preferredName,
          subjectId: subjects.id,
          subjectName: subjects.name,
        })
        .from(tutorStudentAssignments)
        .innerJoin(
          studentProfiles,
          eq(studentProfiles.id, tutorStudentAssignments.studentProfileId),
        )
        .leftJoin(subjects, eq(subjects.id, tutorStudentAssignments.subjectId))
        .where(and(...conditions))
        .orderBy(asc(studentProfiles.preferredName));

      return rows.map((row) => ({
        id: row.id,
        studentProfileId: row.studentProfileId,
        studentName: row.studentName,
        subjectId: row.subjectId ?? null,
        subjectName: row.subjectName ?? null,
      }));
    },

    async listSchedulableSubjects(tutorProfileId): Promise<SubjectOption[]> {
      if (tutorProfileId) {
        return executor
          .select({ id: subjects.id, name: subjects.name })
          .from(tutorSubjects)
          .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
          .where(
            and(eq(tutorSubjects.tutorProfileId, tutorProfileId), eq(subjects.isActive, true)),
          )
          .orderBy(asc(subjects.name));
      }
      return executor
        .select({ id: subjects.id, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.isActive, true))
        .orderBy(asc(subjects.name));
    },

    async createLessonSeries(values: NewLessonSeriesValues) {
      const [row] = await executor.insert(lessonSeries).values(values).returning();
      if (!row) throw new Error("Lesson series insert did not return a row.");
      return mapSeries(row);
    },

    async findLessonSeriesById(id) {
      const [row] = await executor
        .select()
        .from(lessonSeries)
        .where(eq(lessonSeries.id, id))
        .limit(1);
      return row ? mapSeries(row) : null;
    },

    async updateLessonSeriesStatus(id, status) {
      await executor
        .update(lessonSeries)
        .set({ status, updatedAt: new Date() })
        .where(eq(lessonSeries.id, id));
    },

    async listLessonStartTimesForSeries(seriesId) {
      const rows = await executor
        .select({ scheduledStartAt: lessons.scheduledStartAt })
        .from(lessons)
        .where(eq(lessons.lessonSeriesId, seriesId));
      return rows.map((row) => row.scheduledStartAt);
    },

    async findMostRecentLessonForSeries(seriesId) {
      const [row] = await executor
        .select(lessonColumns)
        .from(lessons)
        .where(eq(lessons.lessonSeriesId, seriesId))
        .orderBy(desc(lessons.scheduledStartAt))
        .limit(1);
      return row ? mapLesson(row as typeof lessons.$inferSelect) : null;
    },

    async createLesson(values: NewLessonValues) {
      const [row] = await executor.insert(lessons).values(values).returning();
      if (!row) throw new Error("Lesson insert did not return a row.");
      return mapLesson(row);
    },

    async findLessonById(id) {
      const [row] = await executor.select().from(lessons).where(eq(lessons.id, id)).limit(1);
      return row ? mapLesson(row) : null;
    },

    async updateLessonStatus(id, status) {
      const [row] = await executor
        .update(lessons)
        .set({ status, updatedAt: new Date() })
        .where(eq(lessons.id, id))
        .returning();
      if (!row) throw new Error("Lesson status update did not return a row.");
      return mapLesson(row);
    },

    async listLessonsForScope(scope: LessonListScope, range: LessonListRange) {
      const dateWhere = and(
        gte(lessons.scheduledStartAt, range.from),
        lte(lessons.scheduledStartAt, range.to),
      );

      if (scope.kind === "staff") {
        const rows = await executor
          .select(lessonColumns)
          .from(lessons)
          .where(dateWhere)
          .orderBy(asc(lessons.scheduledStartAt))
          .limit(range.limit);
        return rows.map(mapLesson);
      }

      if (scope.kind === "tutor") {
        const rows = await executor
          .select(lessonColumns)
          .from(lessons)
          .innerJoin(
            tutorStudentAssignments,
            eq(tutorStudentAssignments.id, lessons.tutorStudentAssignmentId),
          )
          .where(and(eq(tutorStudentAssignments.tutorProfileId, scope.tutorProfileId), dateWhere))
          .orderBy(asc(lessons.scheduledStartAt))
          .limit(range.limit);
        return rows.map(mapLesson);
      }

      if (scope.kind === "student") {
        const rows = await executor
          .select(lessonColumns)
          .from(lessons)
          .innerJoin(
            tutorStudentAssignments,
            eq(tutorStudentAssignments.id, lessons.tutorStudentAssignmentId),
          )
          .where(
            and(eq(tutorStudentAssignments.studentProfileId, scope.studentProfileId), dateWhere),
          )
          .orderBy(asc(lessons.scheduledStartAt))
          .limit(range.limit);
        return rows.map(mapLesson);
      }

      // scope.kind === "parent"
      const rows = await executor
        .select(lessonColumns)
        .from(lessons)
        .innerJoin(
          tutorStudentAssignments,
          eq(tutorStudentAssignments.id, lessons.tutorStudentAssignmentId),
        )
        .innerJoin(
          parentStudentLinks,
          eq(parentStudentLinks.studentProfileId, tutorStudentAssignments.studentProfileId),
        )
        .where(and(eq(parentStudentLinks.parentProfileId, scope.parentProfileId), dateWhere))
        .orderBy(asc(lessons.scheduledStartAt))
        .limit(range.limit);
      return rows.map(mapLesson);
    },

    async addParticipant(values: NewLessonParticipantValues) {
      const [row] = await executor.insert(lessonParticipants).values(values).returning();
      if (!row) throw new Error("Lesson participant insert did not return a row.");
      return mapParticipant(row);
    },

    async listParticipants(lessonId) {
      const rows = await executor
        .select()
        .from(lessonParticipants)
        .where(eq(lessonParticipants.lessonId, lessonId))
        .orderBy(asc(lessonParticipants.id));
      return rows.map(mapParticipant);
    },

    async upsertZoomMeeting(values: NewZoomMeetingValues) {
      const [row] = await executor
        .insert(zoomMeetings)
        .values(values)
        .onConflictDoUpdate({
          target: zoomMeetings.lessonId,
          set: { ...values, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error("Zoom meeting upsert did not return a row.");
      return mapZoom(row);
    },

    async findZoomMeetingByLessonId(lessonId) {
      const [row] = await executor
        .select()
        .from(zoomMeetings)
        .where(eq(zoomMeetings.lessonId, lessonId))
        .limit(1);
      return row ? mapZoom(row) : null;
    },

    async createCancellation(values: NewCancellationValues) {
      const [row] = await executor.insert(cancellations).values(values).returning();
      if (!row) throw new Error("Cancellation insert did not return a row.");
      return mapCancellation(row);
    },

    async findCancellationByLessonId(lessonId) {
      const [row] = await executor
        .select()
        .from(cancellations)
        .where(eq(cancellations.lessonId, lessonId))
        .limit(1);
      return row ? mapCancellation(row) : null;
    },

    async upsertAttendance(values: NewAttendanceValues) {
      const [row] = await executor
        .insert(attendance)
        .values(values)
        .onConflictDoUpdate({
          target: [attendance.lessonId, attendance.studentProfileId],
          set: { ...values, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error("Attendance upsert did not return a row.");
      return mapAttendance(row);
    },

    async listAttendanceForLesson(lessonId) {
      const rows = await executor
        .select()
        .from(attendance)
        .where(eq(attendance.lessonId, lessonId))
        .orderBy(asc(attendance.id));
      return rows.map(mapAttendance);
    },

    async appendAudit(values: AuditValues) {
      await executor.insert(auditEvents).values(values);
    },
  };
}

export function createDrizzleSchedulingDatabase(database: Database): SchedulingDatabase {
  return repository(database, database, false);
}
