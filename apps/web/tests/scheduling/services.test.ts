import { describe, expect, it } from "vitest";

import { SchedulingError } from "../../../../packages/domain/scheduling/errors";
import type { AssignmentFact } from "../../../../packages/domain/scheduling/models";
import {
  cancelLesson,
  completeLesson,
  createLessonSeries,
  listLessonsForActor,
  recordAttendance,
  recordNoShow,
  rescheduleLesson,
  scheduleOneTimeLesson,
  setLessonZoomMeeting,
} from "../../../../packages/domain/scheduling/services";
import { InMemorySchedulingDatabase } from "./support/in-memory-scheduling-database";

const assignment: AssignmentFact = {
  id: "assignment-1",
  tutorProfileId: "tutor-profile-1",
  tutorUserId: "tutor-user-1",
  studentProfileId: "student-profile-1",
  studentUserId: "student-user-1",
  subjectId: "subject-math",
  status: "active",
  endAt: null,
};

const tutorActor = { userId: "tutor-user-1", roles: ["tutor"] as const };
const studentActor = { userId: "student-user-1", roles: ["student"] as const };
const parentActor = { userId: "parent-user-1", roles: ["parent"] as const };
const unrelatedParentActor = { userId: "parent-user-2", roles: ["parent"] as const };
const adminActor = { userId: "admin-user-1", roles: ["administrator"] as const };

function database(): InMemorySchedulingDatabase {
  const db = new InMemorySchedulingDatabase();
  db.seedAssignment(assignment);
  db.seedParentLink("parent-user-1", "parent-profile-1", "student-profile-1");
  return db;
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function scheduleLesson(
  db: InMemorySchedulingDatabase,
  hoursAhead: number,
  overrides: { isTrial?: boolean } = {},
) {
  return scheduleOneTimeLesson(db, tutorActor, {
    tutorStudentAssignmentId: assignment.id,
    subjectId: assignment.subjectId ?? "subject-math",
    scheduledStartAt: hoursFromNow(hoursAhead),
    durationMinutes: 60,
    timezoneAtBooking: "America/Los_Angeles",
    isTrial: overrides.isTrial ?? false,
    additionalParticipantUserIds: [],
  });
}

describe("scheduleOneTimeLesson", () => {
  it("lets the assigned tutor schedule a lesson and seeds tutor+student participants", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 48);
    expect(lesson.status).toBe("scheduled");
    const participants = await db.listParticipants(lesson.id);
    expect(participants.map((p) => [p.userId, p.role]).sort()).toEqual(
      [
        ["tutor-user-1", "tutor"],
        ["student-user-1", "student"],
      ].sort(),
    );
    expect(db.audits.some((a) => a.action === "scheduling.lesson.scheduled")).toBe(true);
  });

  it("denies scheduling by a parent or an unrelated tutor", async () => {
    const db = database();
    await expect(
      scheduleOneTimeLesson(db, parentActor, {
        tutorStudentAssignmentId: assignment.id,
        subjectId: "subject-math",
        scheduledStartAt: hoursFromNow(48),
        durationMinutes: 60,
        timezoneAtBooking: "America/Los_Angeles",
        isTrial: false,
        additionalParticipantUserIds: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    await expect(
      scheduleOneTimeLesson(
        db,
        { userId: "other-tutor", roles: ["tutor"] as const },
        {
          tutorStudentAssignmentId: assignment.id,
          subjectId: "subject-math",
          scheduledStartAt: hoursFromNow(48),
          durationMinutes: 60,
          timezoneAtBooking: "America/Los_Angeles",
          isTrial: false,
          additionalParticipantUserIds: [],
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects scheduling against an inactive assignment", async () => {
    const db = new InMemorySchedulingDatabase();
    db.seedAssignment({ ...assignment, status: "ended", endAt: new Date("2020-01-01T00:00:00Z") });
    await expect(scheduleLesson(db, 48)).rejects.toMatchObject({
      code: "ASSIGNMENT_INACTIVE",
      status: 409,
    });
  });
});

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("createLessonSeries — DST-safe materialization end to end", () => {
  it("materializes weekly occurrences that stay at 14:00 local time regardless of DST, over a window guaranteed to cross a transition", async () => {
    const db = database();
    const today = new Date();
    // 180 days (the max horizon) always spans at least one US DST transition (they're ~182 days
    // apart), so this doesn't depend on the current date — unlike hardcoding a specific year.
    const endDate = formatDateOnly(new Date(today.getTime() + 179 * 24 * 60 * 60 * 1000));

    const { series, lessons } = await createLessonSeries(db, tutorActor, {
      tutorStudentAssignmentId: assignment.id,
      subjectId: "subject-math",
      startDate: formatDateOnly(today),
      endDate,
      durationMinutes: 45,
      recurrence: {
        interval: 1,
        byDay: ["SU"],
        hour: 14,
        minute: 0,
        timezone: "America/Los_Angeles",
      },
      additionalParticipantUserIds: [],
      materializeHorizonDays: 180,
    });

    expect(series.status).toBe("active");
    expect(lessons.length).toBeGreaterThan(10); // ~25 Sundays in a 180-day window
    expect(lessons.every((lesson) => lesson.lessonSeriesId === series.id)).toBe(true);
    expect(lessons.every((lesson) => lesson.timezoneAtBooking === "America/Los_Angeles")).toBe(
      true,
    );

    // The wall-clock-invariance check: every occurrence reads as Sunday 14:00 in Los Angeles,
    // regardless of which UTC offset was in effect that week. This is the same assertion style as
    // recurrence.test.ts, now exercised through the full createLessonSeries service, not just the
    // pure recurrence engine. The deterministic proof that the UTC *offset* actually shifts across
    // a DST boundary (167h/169h gaps, not a constant 168h) lives in recurrence.test.ts against
    // pinned dates — a "does this 180-day window happen to cross a boundary" assertion here would
    // be flaky (the PDT stretch alone runs ~238 days, so a window starting in spring can land
    // entirely inside it).
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    for (const lesson of lessons) {
      const parts = Object.fromEntries(
        formatter.formatToParts(lesson.scheduledStartAt).map((part) => [part.type, part.value]),
      );
      expect(parts.hour).toBe("14");
      expect(parts.minute).toBe("00");
      expect(parts.weekday).toBe("Sun");
    }
  });
});

describe("cancelLesson — spec §5.4 chargeable outcomes", () => {
  it("produces a 50% chargeable outcome for an individual lesson cancelled under 8 hours' notice", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 3);
    const result = await cancelLesson(db, parentActor, lesson.id, {
      category: "parent_request",
      reason: "Family emergency came up.",
    });
    expect(result.lesson.status).toBe("canceled");
    expect(result.cancellation.chargeApplied).toBe(true);
  });

  it("produces no charge for a tutor-initiated cancellation", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 3);
    const result = await cancelLesson(db, tutorActor, lesson.id, {
      category: "tutor_request",
      reason: "Tutor has a scheduling conflict.",
    });
    expect(result.lesson.status).toBe("canceled");
    expect(result.cancellation.chargeApplied).toBe(false);
  });

  it("produces no charge for a cancellation with at least 8 hours' notice", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 48);
    const result = await cancelLesson(db, parentActor, lesson.id, {
      category: "parent_request",
      reason: "Rescheduling around a school event.",
    });
    expect(result.cancellation.chargeApplied).toBe(false);
  });

  it("denies a cross-family parent access to the lesson entirely", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 3);
    await expect(
      cancelLesson(db, unrelatedParentActor, lesson.id, {
        category: "parent_request",
        reason: "Not my family's lesson.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects a parent attributing the cancellation to a category reserved for tutors", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 3);
    await expect(
      cancelLesson(db, parentActor, lesson.id, {
        category: "tutor_request",
        reason: "Trying to dodge the charge.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("never charges a trial lesson even when cancelled late", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 1, { isTrial: true });
    const result = await cancelLesson(db, parentActor, lesson.id, {
      category: "parent_request",
      reason: "Can't make the trial after all.",
    });
    expect(result.cancellation.chargeApplied).toBe(false);
  });

  it("staff can cancel using an admin_action category and cannot double-resolve a lesson", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 3);
    await cancelLesson(db, adminActor, lesson.id, {
      category: "admin_action",
      reason: "Support goodwill case.",
    });
    await expect(
      cancelLesson(db, adminActor, lesson.id, { category: "admin_action", reason: "Again." }),
    ).rejects.toMatchObject({ code: "LESSON_ALREADY_RESOLVED", status: 409 });
  });
});

describe("recordNoShow", () => {
  it("charges a student no-show like a late cancellation and sets the no_show_student status", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, -0.25); // lesson already started
    const result = await recordNoShow(db, tutorActor, lesson.id, {
      party: "student",
      reason: "Student never joined the call.",
    });
    expect(result.lesson.status).toBe("no_show_student");
    expect(result.cancellation.chargeApplied).toBe(true);
  });

  it("never charges a tutor no-show", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, -0.25);
    const result = await recordNoShow(db, tutorActor, lesson.id, {
      party: "tutor",
      reason: "Tutor missed the lesson.",
    });
    expect(result.lesson.status).toBe("no_show_tutor");
    expect(result.cancellation.chargeApplied).toBe(false);
  });

  it("denies a parent recording a no-show", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, -0.25);
    await expect(
      recordNoShow(db, parentActor, lesson.id, {
        party: "student",
        reason: "Trying to self-report.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("rescheduleLesson", () => {
  it("lets the tutor reschedule at any time, carrying the roster and Zoom details forward", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 1); // inside the free window
    await setLessonZoomMeeting(db, tutorActor, lesson.id, {
      joinUrl: "https://zoom.example/j/123",
      passcode: "abc123",
    });

    const { previous, next } = await rescheduleLesson(db, tutorActor, lesson.id, {
      newScheduledStartAt: hoursFromNow(96),
      durationMinutes: 60,
      reason: "Tutor availability changed.",
    });
    expect(previous.status).toBe("rescheduled");
    expect(next.status).toBe("scheduled");

    const newParticipants = await db.listParticipants(next.id);
    expect(newParticipants).toHaveLength(2);
    const newZoom = await db.findZoomMeetingByLessonId(next.id);
    expect(newZoom?.joinUrl).toBe("https://zoom.example/j/123");
  });

  it("denies a parent rescheduling inside the free-notice window, but allows it outside", async () => {
    const db = database();
    const soonLesson = await scheduleLesson(db, 3);
    await expect(
      rescheduleLesson(db, parentActor, soonLesson.id, {
        newScheduledStartAt: hoursFromNow(96),
        durationMinutes: 60,
        reason: "Conflict came up.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    const laterLesson = await scheduleLesson(db, 48);
    const { next } = await rescheduleLesson(db, parentActor, laterLesson.id, {
      newScheduledStartAt: hoursFromNow(96),
      durationMinutes: 60,
      reason: "Family trip planned.",
    });
    expect(next.status).toBe("scheduled");
  });
});

describe("attendance, completion, and Zoom", () => {
  it("lets the tutor record attendance and mark the lesson complete; a student cannot", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 2);
    await recordAttendance(db, tutorActor, lesson.id, {
      studentProfileId: assignment.studentProfileId,
      status: "present",
      notes: null,
    });
    const attendance = await db.listAttendanceForLesson(lesson.id);
    expect(attendance).toHaveLength(1);
    expect(attendance[0]?.status).toBe("present");

    const completed = await completeLesson(db, tutorActor, lesson.id);
    expect(completed.status).toBe("completed");

    await expect(
      recordAttendance(db, studentActor, lesson.id, {
        studentProfileId: assignment.studentProfileId,
        status: "present",
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("stores manually entered Zoom join details for a lesson", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 5);
    const zoom = await setLessonZoomMeeting(db, tutorActor, lesson.id, {
      joinUrl: "https://zoom.example/j/999",
      passcode: "9090",
    });
    expect(zoom.joinUrl).toBe("https://zoom.example/j/999");
    expect(zoom.passcode).toBe("9090");
    expect((await db.findZoomMeetingByLessonId(lesson.id))?.zoomMeetingId).toBe(zoom.zoomMeetingId);
  });
});

describe("listLessonsForActor", () => {
  it("scopes a parent's listing to their linked child's lessons only", async () => {
    const db = database();
    const lesson = await scheduleLesson(db, 10);
    const range = { from: hoursFromNow(-1), to: hoursFromNow(200) };

    const parentView = await listLessonsForActor(db, parentActor, range);
    expect(parentView.map((l) => l.id)).toEqual([lesson.id]);

    // A second parent with their own profile but no linked students (e.g. no children added
    // yet) sees an empty schedule, not an error.
    db.parentProfileIdByUserId.set(unrelatedParentActor.userId, "parent-profile-2");
    const unrelatedView = await listLessonsForActor(db, unrelatedParentActor, range);
    expect(unrelatedView).toEqual([]);

    const tutorView = await listLessonsForActor(db, tutorActor, range);
    expect(tutorView.map((l) => l.id)).toEqual([lesson.id]);
  });
});

describe("SchedulingError", () => {
  it("carries a typed code and HTTP-ish status", () => {
    const error = new SchedulingError("FORBIDDEN", "denied", 403);
    expect(error).toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
