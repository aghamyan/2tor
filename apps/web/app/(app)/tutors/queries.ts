import { currentAcademicContext } from "../academics/context";
import { currentFamilyContext } from "../families/context";
import { currentSchedulingContext } from "../scheduling/context";
import { loadRecentLessons, loadSchedulableOptions, loadUpcomingLessons } from "../scheduling/queries";

export interface TutorStudentSummary {
  assignmentId: string;
  studentProfileId: string;
  studentName: string;
  gradeLevel: string | null;
  subjectName: string | null;
  endedAt: Date | null;
  nextLessonAt: Date | null;
  publishedFeedbackCount: number;
}

export interface TutorStudentsSummary {
  active: TutorStudentSummary[];
  past: TutorStudentSummary[];
}

/**
 * "My students" has no dedicated read query anywhere in the domain layer (matching only exposes
 * per-record `findAssignmentById` plus an admin queue; scheduling's `listSchedulableAssignments`
 * is the closest thing to a roster, and only covers currently-active assignments). Active students
 * come straight from that list. Past (ended) students are recovered the same way
 * `_lib/summaries.ts` already builds the tutor dashboard's feedback queue: walk recent lesson
 * history for assignment ids not already in the active set, and resolve each one individually.
 * `AssignmentStatus` is `proposed | active | ended | rejected` — there is no "trial" tier to sort
 * into, so this only ever produces Active and Past groups.
 */
async function publishedFeedbackCount(
  academicContext: Awaited<ReturnType<typeof currentAcademicContext>>,
  studentProfileId: string,
): Promise<number> {
  const feedback = await academicContext.database.listFeedbackForStudent(studentProfileId);
  return feedback.filter((record) => record.status === "published" || record.status === "revised")
    .length;
}

export async function loadTutorStudents(): Promise<TutorStudentsSummary> {
  const [options, recentLessons, upcomingLessons, schedulingContext, familyContext, academicContext] =
    await Promise.all([
      loadSchedulableOptions(),
      loadRecentLessons(365),
      loadUpcomingLessons(),
      currentSchedulingContext(),
      currentFamilyContext(),
      currentAcademicContext(),
    ]);

  const subjectNameById = new Map(options.subjects.map((subject) => [subject.id, subject.name]));
  const now = new Date();
  const nextLessonByAssignment = new Map<string, Date>();
  for (const lesson of upcomingLessons) {
    if (lesson.scheduledStartAt < now || lesson.status === "canceled" || lesson.status === "rescheduled")
      continue;
    const existing = nextLessonByAssignment.get(lesson.tutorStudentAssignmentId);
    if (!existing || lesson.scheduledStartAt < existing)
      nextLessonByAssignment.set(lesson.tutorStudentAssignmentId, lesson.scheduledStartAt);
  }

  const active = (
    await Promise.all(
      options.assignments.map(async (assignment): Promise<TutorStudentSummary | null> => {
        const record = await schedulingContext.database.findAssignmentById(assignment.id);
        if (!record) return null;
        const [student, feedbackCount] = await Promise.all([
          familyContext.database.findStudentById(assignment.studentProfileId),
          publishedFeedbackCount(academicContext, assignment.studentProfileId),
        ]);
        return {
          assignmentId: assignment.id,
          studentProfileId: assignment.studentProfileId,
          studentName: assignment.studentName,
          gradeLevel: student?.gradeLevel ?? null,
          subjectName: assignment.subjectName,
          endedAt: null,
          nextLessonAt: nextLessonByAssignment.get(assignment.id) ?? null,
          publishedFeedbackCount: feedbackCount,
        };
      }),
    )
  ).filter((entry): entry is TutorStudentSummary => entry !== null);

  const activeAssignmentIds = new Set(active.map((entry) => entry.assignmentId));
  const pastAssignmentIds = [
    ...new Set(
      recentLessons
        .map((lesson) => lesson.tutorStudentAssignmentId)
        .filter((assignmentId) => !activeAssignmentIds.has(assignmentId)),
    ),
  ];

  const past = (
    await Promise.all(
      pastAssignmentIds.map(async (assignmentId): Promise<TutorStudentSummary | null> => {
        const record = await schedulingContext.database.findAssignmentById(assignmentId);
        if (!record || record.status !== "ended") return null;
        const [student, feedbackCount] = await Promise.all([
          familyContext.database.findStudentById(record.studentProfileId),
          publishedFeedbackCount(academicContext, record.studentProfileId),
        ]);
        return {
          assignmentId,
          studentProfileId: record.studentProfileId,
          studentName: student?.preferredName ?? "Student",
          gradeLevel: student?.gradeLevel ?? null,
          subjectName: record.subjectId ? (subjectNameById.get(record.subjectId) ?? null) : null,
          endedAt: record.endAt,
          nextLessonAt: null,
          publishedFeedbackCount: feedbackCount,
        };
      }),
    )
  )
    .filter((entry): entry is TutorStudentSummary => entry !== null)
    .sort((left, right) => (right.endedAt?.getTime() ?? 0) - (left.endedAt?.getTime() ?? 0));

  return { active, past };
}
