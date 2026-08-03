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
} from "../../../../../packages/domain/scheduling/models";

function now(): Date {
  return new Date("2026-07-29T12:00:00.000Z");
}

let fakeIdCounter = 0;
function fakeId(): string {
  fakeIdCounter += 1;
  return `fake-id-${fakeIdCounter}`;
}

export class InMemorySchedulingDatabase implements SchedulingDatabase {
  readonly audits: AuditValues[] = [];
  readonly assignments = new Map<string, AssignmentFact>();
  readonly series = new Map<string, LessonSeriesRecord>();
  readonly lessons = new Map<string, LessonRecord>();
  readonly participants = new Map<string, LessonParticipantRecord[]>();
  readonly zoomMeetings = new Map<string, ZoomMeetingRecord>();
  readonly cancellations = new Map<string, CancellationRecord>();
  readonly attendance = new Map<string, AttendanceRecord[]>();

  readonly tutorProfileIdByUserId = new Map<string, string>();
  readonly studentProfileIdByUserId = new Map<string, string>();
  readonly parentProfileIdByUserId = new Map<string, string>();
  readonly parentLinks = new Map<string, Set<string>>();

  readonly schedulableAssignmentsByTutor = new Map<string, SchedulableAssignmentOption[]>();
  readonly schedulableSubjectsByTutor = new Map<string, SubjectOption[]>();

  async transaction<T>(operation: (database: SchedulingDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  seedAssignment(assignment: AssignmentFact): void {
    this.assignments.set(assignment.id, assignment);
    this.tutorProfileIdByUserId.set(assignment.tutorUserId, assignment.tutorProfileId);
    this.studentProfileIdByUserId.set(assignment.studentUserId, assignment.studentProfileId);
  }

  seedParentLink(parentUserId: string, parentProfileId: string, studentProfileId: string): void {
    this.parentProfileIdByUserId.set(parentUserId, parentProfileId);
    const set = this.parentLinks.get(parentProfileId) ?? new Set<string>();
    set.add(studentProfileId);
    this.parentLinks.set(parentProfileId, set);
  }

  async findAssignmentById(assignmentId: string) {
    return this.assignments.get(assignmentId) ?? null;
  }

  async resolveTutorProfileIdForUser(userId: string) {
    return this.tutorProfileIdByUserId.get(userId) ?? null;
  }

  async resolveStudentProfileIdForUser(userId: string) {
    return this.studentProfileIdByUserId.get(userId) ?? null;
  }

  async resolveParentProfileIdForUser(userId: string) {
    return this.parentProfileIdByUserId.get(userId) ?? null;
  }

  async isParentLinkedToStudent(parentUserId: string, studentProfileId: string) {
    const parentProfileId = this.parentProfileIdByUserId.get(parentUserId);
    if (!parentProfileId) return false;
    return this.parentLinks.get(parentProfileId)?.has(studentProfileId) ?? false;
  }

  seedSchedulableAssignment(tutorProfileId: string, option: SchedulableAssignmentOption): void {
    const list = this.schedulableAssignmentsByTutor.get(tutorProfileId) ?? [];
    list.push(option);
    this.schedulableAssignmentsByTutor.set(tutorProfileId, list);
  }

  seedSchedulableSubject(tutorProfileId: string, option: SubjectOption): void {
    const list = this.schedulableSubjectsByTutor.get(tutorProfileId) ?? [];
    list.push(option);
    this.schedulableSubjectsByTutor.set(tutorProfileId, list);
  }

  async listSchedulableAssignments(tutorProfileId: string | null) {
    if (tutorProfileId) return [...(this.schedulableAssignmentsByTutor.get(tutorProfileId) ?? [])];
    return [...this.schedulableAssignmentsByTutor.values()].flat();
  }

  async listSchedulableSubjects(tutorProfileId: string | null) {
    if (tutorProfileId) return [...(this.schedulableSubjectsByTutor.get(tutorProfileId) ?? [])];
    return [...this.schedulableSubjectsByTutor.values()].flat();
  }

  async createLessonSeries(values: NewLessonSeriesValues) {
    const record: LessonSeriesRecord = { ...values, createdAt: now(), updatedAt: now() };
    this.series.set(values.id, record);
    return record;
  }

  async findLessonSeriesById(id: string) {
    return this.series.get(id) ?? null;
  }

  async updateLessonSeriesStatus(id: string, status: LessonSeriesRecord["status"]) {
    const existing = this.series.get(id);
    if (existing) this.series.set(id, { ...existing, status, updatedAt: now() });
  }

  async listLessonStartTimesForSeries(seriesId: string) {
    return [...this.lessons.values()]
      .filter((lesson) => lesson.lessonSeriesId === seriesId)
      .map((lesson) => lesson.scheduledStartAt);
  }

  async findMostRecentLessonForSeries(seriesId: string) {
    const candidates = [...this.lessons.values()]
      .filter((lesson) => lesson.lessonSeriesId === seriesId)
      .sort((a, b) => b.scheduledStartAt.getTime() - a.scheduledStartAt.getTime());
    return candidates[0] ?? null;
  }

  async createLesson(values: NewLessonValues) {
    const record: LessonRecord = { ...values, createdAt: now(), updatedAt: now() };
    this.lessons.set(values.id, record);
    return record;
  }

  async findLessonById(id: string) {
    return this.lessons.get(id) ?? null;
  }

  async updateLessonStatus(id: string, status: LessonRecord["status"]) {
    const existing = this.lessons.get(id);
    if (!existing) throw new Error("lesson missing");
    const updated: LessonRecord = { ...existing, status, updatedAt: now() };
    this.lessons.set(id, updated);
    return updated;
  }

  async listLessonsForScope(scope: LessonListScope, range: LessonListRange) {
    let matches = [...this.lessons.values()];
    if (scope.kind === "tutor") {
      matches = matches.filter(
        (lesson) =>
          this.assignments.get(lesson.tutorStudentAssignmentId)?.tutorProfileId ===
          scope.tutorProfileId,
      );
    } else if (scope.kind === "student") {
      matches = matches.filter(
        (lesson) =>
          this.assignments.get(lesson.tutorStudentAssignmentId)?.studentProfileId ===
          scope.studentProfileId,
      );
    } else if (scope.kind === "parent") {
      const studentIds = this.parentLinks.get(scope.parentProfileId) ?? new Set<string>();
      matches = matches.filter((lesson) => {
        const assignment = this.assignments.get(lesson.tutorStudentAssignmentId);
        return assignment ? studentIds.has(assignment.studentProfileId) : false;
      });
    }
    matches = matches.filter(
      (lesson) => lesson.scheduledStartAt >= range.from && lesson.scheduledStartAt <= range.to,
    );
    matches.sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime());
    return matches.slice(0, range.limit);
  }

  async addParticipant(values: NewLessonParticipantValues) {
    const record: LessonParticipantRecord = { ...values, joinedAt: null, leftAt: null };
    const list = this.participants.get(values.lessonId) ?? [];
    list.push(record);
    this.participants.set(values.lessonId, list);
    return record;
  }

  async listParticipants(lessonId: string) {
    return [...(this.participants.get(lessonId) ?? [])];
  }

  async upsertZoomMeeting(values: NewZoomMeetingValues) {
    const existing = this.zoomMeetings.get(values.lessonId);
    const record: ZoomMeetingRecord = { id: existing?.id ?? fakeId(), ...values };
    this.zoomMeetings.set(values.lessonId, record);
    return record;
  }

  async findZoomMeetingByLessonId(lessonId: string) {
    return this.zoomMeetings.get(lessonId) ?? null;
  }

  async createCancellation(values: NewCancellationValues) {
    const record: CancellationRecord = { ...values, canceledAt: now() };
    this.cancellations.set(values.lessonId, record);
    return record;
  }

  async findCancellationByLessonId(lessonId: string) {
    return this.cancellations.get(lessonId) ?? null;
  }

  async upsertAttendance(values: NewAttendanceValues) {
    const list = this.attendance.get(values.lessonId) ?? [];
    const index = list.findIndex((entry) => entry.studentProfileId === values.studentProfileId);
    const record: AttendanceRecord = { ...values, joinedAt: null, leftAt: null };
    if (index >= 0) list[index] = record;
    else list.push(record);
    this.attendance.set(values.lessonId, list);
    return record;
  }

  async listAttendanceForLesson(lessonId: string) {
    return [...(this.attendance.get(lessonId) ?? [])];
  }

  async appendAudit(values: AuditValues) {
    this.audits.push(values);
  }
}
