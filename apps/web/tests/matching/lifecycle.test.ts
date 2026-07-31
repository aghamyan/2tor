import { authorize } from "@app/auth";
import { describe, expect, it } from "vitest";

import {
  decideAssignment,
  endAssignment,
  listAdminMatchingQueue,
  proposeAssignment,
  requestTutorChange,
} from "../../../../packages/domain/matching/services";
import type {
  AssignmentRecord,
  AssignmentRequestRecord,
  MatchingDatabase,
  MatchingNoteRecord,
  NewAssignmentRequestValues,
  NewAssignmentValues,
} from "../../../../packages/domain/matching/models";

function memoryDatabase(): MatchingDatabase & {
  assignment: AssignmentRecord | null;
  requests: AssignmentRequestRecord[];
  audits: Array<{ actorUserId: string; reason: string; action: string }>;
} {
  const state: {
    assignment: AssignmentRecord | null;
    requests: AssignmentRequestRecord[];
    audits: Array<{ actorUserId: string; reason: string; action: string }>;
  } = { assignment: null, requests: [], audits: [] };
  const database: MatchingDatabase = {
    transaction: async (operation) => operation(database),
    findStudentById: async (id) => (id === "student_1" ? { id, preferredName: "Areg" } : null),
    findTutorById: async (id) =>
      id === "tutor_1" ? { id, userId: "tutor_user", publicDisplayName: "Davit" } : null,
    findTutorByUserId: async (id) =>
      id === "tutor_user" ? { id: "tutor_1", userId: id, publicDisplayName: "Davit" } : null,
    parentLinkedToStudent: async (userId, studentId) =>
      userId === "parent_user" && studentId === "student_1",
    createAssignment: async (values: NewAssignmentValues) => {
      const now = new Date("2026-06-01T00:00:00Z");
      state.assignment = {
        ...values,
        status: "proposed",
        endedReason: null,
        createdAt: now,
        updatedAt: now,
      };
      return state.assignment;
    },
    findAssignmentById: async (id) => (state.assignment?.id === id ? state.assignment : null),
    updateAssignment: async (id, values) => {
      if (!state.assignment || state.assignment.id !== id) throw new Error("not found");
      state.assignment = {
        ...state.assignment,
        ...values,
        updatedAt: new Date("2026-06-01T00:00:00Z"),
      };
      return state.assignment;
    },
    createAssignmentRequest: async (values: NewAssignmentRequestValues) => {
      const now = new Date("2026-06-01T00:00:00Z");
      const request: AssignmentRequestRecord = {
        ...values,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      state.requests.push(request);
      return request;
    },
    findAssignmentRequestById: async (id) =>
      state.requests.find((request) => request.id === id) ?? null,
    updateAssignmentRequestStatus: async (id, status) => {
      const request = state.requests.find((item) => item.id === id);
      if (!request) throw new Error("not found");
      request.status = status;
      return request;
    },
    listPendingAssignmentRequests: async () =>
      state.requests.filter((request) => request.status === "pending"),
    createMatchingNote: async (values) =>
      ({ ...values, createdAt: new Date() }) as MatchingNoteRecord,
    appendAudit: async (values) => {
      state.audits.push(values);
    },
  };
  return Object.assign(database, state, {
    get assignment() {
      return state.assignment;
    },
    get requests() {
      return state.requests;
    },
    get audits() {
      return state.audits;
    },
  });
}

describe("matching assignment lifecycle", () => {
  it("revokes tutor authorization when an active assignment is ended", async () => {
    const database = memoryDatabase();
    const admin = { userId: "admin_user", roles: ["administrator"] as const };
    const tutor = { userId: "tutor_user", roles: ["tutor"] as const };
    const proposed = await proposeAssignment(database, admin, {
      tutorProfileId: "tutor_1",
      studentProfileId: "student_1",
      subjectId: null,
      startAt: new Date("2026-06-01T00:00:00Z"),
      endAt: null,
      reason: "Initial placement.",
    });
    const active = await decideAssignment(database, tutor, proposed.id, {
      decision: "accept",
      reason: "I can take this learner.",
    });
    expect(
      authorize(
        tutor,
        "student.view_profile",
        {
          kind: "student",
          studentProfileId: active.studentProfileId,
          tutorAssignment: { status: active.status, endAt: active.endAt },
        },
        new Date("2026-06-02T00:00:00Z"),
      ),
    ).toEqual({ allowed: true });

    const endedAt = new Date("2026-06-02T12:00:00Z");
    const ended = await endAssignment(
      database,
      admin,
      active.id,
      { reason: "Parent requested a different tutor." },
      endedAt,
    );
    expect(ended).toMatchObject({
      status: "ended",
      endAt: endedAt,
      endedReason: "Parent requested a different tutor.",
    });
    expect(
      authorize(
        tutor,
        "student.view_profile",
        {
          kind: "student",
          studentProfileId: ended.studentProfileId,
          tutorAssignment: { status: ended.status, endAt: ended.endAt },
        },
        endedAt,
      ),
    ).toEqual({ allowed: false, reason: "no_relationship" });
    expect(database.audits.at(-1)).toMatchObject({
      actorUserId: "admin_user",
      action: "matching.assignment.ended",
      reason: "Parent requested a different tutor.",
    });
  });

  it("places a linked parent's tutor-change request in the staff queue", async () => {
    const database = memoryDatabase();
    const request = await requestTutorChange(
      database,
      { userId: "parent_user", roles: ["parent"] },
      {
        studentProfileId: "student_1",
        subjectId: null,
        preferredTutorProfileId: null,
        notes: "We would like a different teaching style.",
      },
    );
    const queue = await listAdminMatchingQueue(database, {
      userId: "admin_user",
      roles: ["administrator"],
    });
    expect(queue).toEqual([expect.objectContaining({ id: request.id, status: "pending" })]);
  });
});
