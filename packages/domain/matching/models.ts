export type MatchingRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface MatchingActor {
  userId: string;
  roles: readonly MatchingRole[];
}

export type AssignmentStatus = "proposed" | "active" | "ended" | "rejected";
export type AssignmentRequestStatus = "pending" | "matched" | "closed" | "cancelled";

export interface StudentRecord {
  id: string;
  preferredName: string;
}

export interface TutorRecord {
  id: string;
  userId: string;
  publicDisplayName: string;
}

export interface AssignmentRecord {
  id: string;
  tutorProfileId: string;
  studentProfileId: string;
  subjectId: string | null;
  status: AssignmentStatus;
  startAt: Date;
  endAt: Date | null;
  endedReason: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentRequestRecord {
  id: string;
  requestedByUserId: string;
  studentProfileId: string;
  subjectId: string | null;
  preferredTutorProfileId: string | null;
  status: AssignmentRequestStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchingNoteRecord {
  id: string;
  assignmentRequestId: string | null;
  tutorStudentAssignmentId: string | null;
  authorUserId: string;
  note: string;
  createdAt: Date;
}

export interface AuditValues {
  id: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  previousValue?: unknown;
  newValue?: unknown;
}

export interface NewAssignmentValues {
  id: string;
  tutorProfileId: string;
  studentProfileId: string;
  subjectId: string | null;
  startAt: Date;
  endAt: Date | null;
  createdByUserId: string;
}

export interface NewAssignmentRequestValues {
  id: string;
  requestedByUserId: string;
  studentProfileId: string;
  subjectId: string | null;
  preferredTutorProfileId: string | null;
  notes: string | null;
}

export interface MatchingDatabase {
  transaction<T>(operation: (database: MatchingDatabase) => Promise<T>): Promise<T>;
  findStudentById(studentProfileId: string): Promise<StudentRecord | null>;
  findTutorById(tutorProfileId: string): Promise<TutorRecord | null>;
  findTutorByUserId(userId: string): Promise<TutorRecord | null>;
  parentLinkedToStudent(userId: string, studentProfileId: string): Promise<boolean>;
  createAssignment(values: NewAssignmentValues): Promise<AssignmentRecord>;
  findAssignmentById(assignmentId: string): Promise<AssignmentRecord | null>;
  updateAssignment(
    assignmentId: string,
    values: Pick<AssignmentRecord, "status" | "endAt" | "endedReason">,
  ): Promise<AssignmentRecord>;
  createAssignmentRequest(values: NewAssignmentRequestValues): Promise<AssignmentRequestRecord>;
  findAssignmentRequestById(requestId: string): Promise<AssignmentRequestRecord | null>;
  updateAssignmentRequestStatus(
    requestId: string,
    status: AssignmentRequestStatus,
  ): Promise<AssignmentRequestRecord>;
  listPendingAssignmentRequests(): Promise<AssignmentRequestRecord[]>;
  createMatchingNote(values: Omit<MatchingNoteRecord, "createdAt">): Promise<MatchingNoteRecord>;
  appendAudit(values: AuditValues): Promise<void>;
}
