import { expect, expectJson, test } from "./fixtures/actors";

interface Envelope<T> {
  data: T;
  requestId: string;
}

test.describe.serial("scheduling boundaries", () => {
  test("weekly wall-clock time remains stable across the DST transition", async ({ actors }) => {
    const response = await actors.tutor.post("/api/scheduling/series", {
      data: {
        tutorStudentAssignmentId: "tsa_demo_1",
        subjectId: "subj_math",
        startDate: "2026-10-25",
        endDate: "2026-11-15",
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
      },
    });
    const body = await expectJson<
      Envelope<{
        series: { recurrenceRule: string };
        lessons: Array<{ scheduledStartAt: string; timezoneAtBooking: string }>;
      }>
    >(response, 201);

    expect(body.data.series.recurrenceRule).toContain("TZID=America/Los_Angeles");
    const starts = body.data.lessons.map((lesson) => lesson.scheduledStartAt);
    expect(starts).toContain("2026-10-25T21:00:00.000Z");
    expect(starts).toContain("2026-11-01T22:00:00.000Z");
    expect(
      body.data.lessons.every((lesson) => lesson.timezoneAtBooking === "America/Los_Angeles"),
    ).toBe(true);

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(
      body.data.lessons.map((lesson) => formatter.format(new Date(lesson.scheduledStartAt))),
    ).toEqual(["14:00", "14:00", "14:00", "14:00"]);
  });

  test("late parent cancellation is charged once and cannot be replayed", async ({ actors }) => {
    const scheduleResponse = await actors.tutor.post("/api/scheduling/lessons", {
      data: {
        tutorStudentAssignmentId: "tsa_demo_1",
        subjectId: "subj_math",
        scheduledStartAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        durationMinutes: 45,
        timezoneAtBooking: "Asia/Yerevan",
        isTrial: false,
        additionalParticipantUserIds: [],
      },
    });
    const scheduled = await expectJson<
      Envelope<{ id: string; status: string; timezoneAtBooking: string }>
    >(scheduleResponse, 201);
    expect(scheduled.data.timezoneAtBooking).toBe("Asia/Yerevan");

    const cancelResponse = await actors.parent.post(
      `/api/scheduling/lessons/${scheduled.data.id}/cancel`,
      {
        data: {
          category: "parent_request",
          reason: "Family emergency inside the cancellation window.",
        },
      },
    );
    const canceled = await expectJson<
      Envelope<{
        lesson: { status: string };
        cancellation: { chargeApplied: boolean; category: string };
      }>
    >(cancelResponse, 200);
    expect(canceled.data.lesson.status).toBe("canceled");
    expect(canceled.data.cancellation).toMatchObject({
      category: "parent_request",
      chargeApplied: true,
    });

    const replayResponse = await actors.parent.post(
      `/api/scheduling/lessons/${scheduled.data.id}/cancel`,
      {
        data: {
          category: "parent_request",
          reason: "Accidental duplicate cancellation submission.",
        },
      },
    );
    const replay = await expectJson<{ error: { code: string } }>(replayResponse, 409);
    expect(replay.error.code).toBe("LESSON_ALREADY_RESOLVED");
  });
});
