import { ulid } from "ulid";

import { MatchingError } from "./errors";
import type {
  AssignmentRecord,
  AssignmentRequestRecord,
  MatchingActor,
  MatchingDatabase,
  MatchingNoteRecord,
} from "./models";
import {
  endAssignmentInputSchema,
  matchingNoteInputSchema,
  proposeAssignmentInputSchema,
  tutorChangeRequestInputSchema,
  tutorDecisionInputSchema,
  type EndAssignmentInput,
  type MatchingNoteInput,
  type ProposeAssignmentInput,
  type TutorChangeRequestInput,
  type TutorDecisionInput,
} from "./schemas";

function requireActor(actor: MatchingActor | null | undefined): asserts actor is MatchingActor {
  if (!actor) throw new MatchingError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}

function isStaff(actor: MatchingActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

function requireStaff(actor: MatchingActor | null | undefined): asserts actor is MatchingActor {
  requireActor(actor);
  if (!isStaff(actor)) throw new MatchingError("FORBIDDEN", "Only staff can manage matching.", 403);
}

function assignmentSnapshot(assignment: AssignmentRecord) {
  return {
    status: assignment.status,
    startAt: assignment.startAt,
    endAt: assignment.endAt,
    endedReason: assignment.endedReason,
  };
}

/** Staff creates a proposal. It grants no tutor access until the tutor accepts it. */
export async function proposeAssignment(
  database: MatchingDatabase,
  actor: MatchingActor | null | undefined,
  input: ProposeAssignmentInput,
): Promise<AssignmentRecord> {
  requireStaff(actor);
  const values = proposeAssignmentInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const [student, tutor] = await Promise.all([
      transaction.findStudentById(values.studentProfileId),
      transaction.findTutorById(values.tutorProfileId),
    ]);
    if (!student) throw new MatchingError("STUDENT_NOT_FOUND", "Student was not found.", 404);
    if (!tutor) throw new MatchingError("TUTOR_NOT_FOUND", "Tutor was not found.", 404);
    const assignment = await transaction.createAssignment({
      id: ulid(),
      tutorProfileId: values.tutorProfileId,
      studentProfileId: values.studentProfileId,
      subjectId: values.subjectId,
      startAt: values.startAt,
      endAt: values.endAt,
      createdByUserId: actor.userId,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "matching.assignment.proposed",
      resourceType: "tutor_student_assignments",
      resourceId: assignment.id,
      reason: values.reason,
      newValue: assignmentSnapshot(assignment),
    });
    return assignment;
  });
}

/** Tutor decision is bound to their own tutor profile; a proposal is the only state that can be decided. */
export async function decideAssignment(
  database: MatchingDatabase,
  actor: MatchingActor | null | undefined,
  assignmentId: string,
  input: TutorDecisionInput,
): Promise<AssignmentRecord> {
  requireActor(actor);
  if (!actor.roles.includes("tutor"))
    throw new MatchingError("FORBIDDEN", "Only the proposed tutor can decide.", 403);
  const values = tutorDecisionInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const [assignment, tutor] = await Promise.all([
      transaction.findAssignmentById(assignmentId),
      transaction.findTutorByUserId(actor.userId),
    ]);
    if (!assignment)
      throw new MatchingError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
    if (!tutor || tutor.id !== assignment.tutorProfileId) {
      throw new MatchingError("FORBIDDEN", "This assignment was not proposed to you.", 403);
    }
    if (assignment.status !== "proposed") {
      throw new MatchingError(
        "INVALID_TRANSITION",
        "Only proposed assignments can be accepted or rejected.",
        409,
      );
    }
    const next = await transaction.updateAssignment(assignment.id, {
      status: values.decision === "accept" ? "active" : "rejected",
      endAt: assignment.endAt,
      endedReason: values.decision === "reject" ? values.reason : null,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action:
        values.decision === "accept"
          ? "matching.assignment.accepted"
          : "matching.assignment.rejected",
      resourceType: "tutor_student_assignments",
      resourceId: assignment.id,
      reason: values.reason,
      previousValue: assignmentSnapshot(assignment),
      newValue: assignmentSnapshot(next),
    });
    return next;
  });
}

/** Ends access immediately by setting both the terminal status and authorization's `endAt` field. */
export async function endAssignment(
  database: MatchingDatabase,
  actor: MatchingActor | null | undefined,
  assignmentId: string,
  input: EndAssignmentInput,
  now = new Date(),
): Promise<AssignmentRecord> {
  requireStaff(actor);
  const values = endAssignmentInputSchema.parse(input);
  return database.transaction(async (transaction) => {
    const assignment = await transaction.findAssignmentById(assignmentId);
    if (!assignment)
      throw new MatchingError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
    if (assignment.status !== "active") {
      throw new MatchingError("INVALID_TRANSITION", "Only active assignments can be ended.", 409);
    }
    const ended = await transaction.updateAssignment(assignment.id, {
      status: "ended",
      endAt: now,
      endedReason: values.reason,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "matching.assignment.ended",
      resourceType: "tutor_student_assignments",
      resourceId: assignment.id,
      reason: values.reason,
      previousValue: assignmentSnapshot(assignment),
      newValue: assignmentSnapshot(ended),
    });
    return ended;
  });
}

/** Parent-originated tutor changes are queue records; parents cannot assign tutors directly. */
export async function requestTutorChange(
  database: MatchingDatabase,
  actor: MatchingActor | null | undefined,
  input: TutorChangeRequestInput,
): Promise<AssignmentRequestRecord> {
  requireActor(actor);
  if (!actor.roles.includes("parent"))
    throw new MatchingError("FORBIDDEN", "Only a linked parent can request a tutor change.", 403);
  const values = tutorChangeRequestInputSchema.parse(input);
  if (!(await database.parentLinkedToStudent(actor.userId, values.studentProfileId))) {
    throw new MatchingError("FORBIDDEN", "You are not linked to this student.", 403);
  }
  return database.transaction(async (transaction) => {
    const request = await transaction.createAssignmentRequest({
      id: ulid(),
      requestedByUserId: actor.userId,
      studentProfileId: values.studentProfileId,
      subjectId: values.subjectId,
      preferredTutorProfileId: values.preferredTutorProfileId,
      notes: values.notes,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "matching.tutor_change.requested",
      resourceType: "assignment_requests",
      resourceId: request.id,
      reason: "Parent requested a tutor change.",
      newValue: { studentProfileId: request.studentProfileId, notes: request.notes },
    });
    return request;
  });
}

export async function listAdminMatchingQueue(
  database: MatchingDatabase,
  actor: MatchingActor | null | undefined,
): Promise<AssignmentRequestRecord[]> {
  requireStaff(actor);
  return database.listPendingAssignmentRequests();
}

export async function addMatchingNote(
  database: MatchingDatabase,
  actor: MatchingActor | null | undefined,
  input: MatchingNoteInput,
): Promise<MatchingNoteRecord> {
  requireStaff(actor);
  const values = matchingNoteInputSchema.parse(input);
  return database.transaction(async (transaction) => {
    if (
      values.assignmentRequestId &&
      !(await transaction.findAssignmentRequestById(values.assignmentRequestId))
    ) {
      throw new MatchingError("REQUEST_NOT_FOUND", "Matching request was not found.", 404);
    }
    if (
      values.tutorStudentAssignmentId &&
      !(await transaction.findAssignmentById(values.tutorStudentAssignmentId))
    ) {
      throw new MatchingError("ASSIGNMENT_NOT_FOUND", "Assignment was not found.", 404);
    }
    const note = await transaction.createMatchingNote({
      id: ulid(),
      authorUserId: actor.userId,
      ...values,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "matching.note.added",
      resourceType: "matching_notes",
      resourceId: note.id,
      reason: "Staff matching note added.",
      newValue: {
        assignmentRequestId: note.assignmentRequestId,
        tutorStudentAssignmentId: note.tutorStudentAssignmentId,
      },
    });
    return note;
  });
}
