import { describe, expect, it } from "vitest";
import { AssessmentError } from "../../../../packages/domain/assessments/errors";
import type { AssessmentNotifier } from "../../../../packages/domain/assessments/models";
import {
  createAssessment,
  deleteAssessment,
  getAssessmentAttemptReview,
  getAssessmentEvidenceForActor,
  getAssessmentForActor,
  getDiagnosticReportForActor,
  listAssessmentAttemptsForActor,
  listAssessableStudents,
  listAssessmentsForActor,
  recordAssessmentEvidence,
  recordAssessmentSignal,
  recordAssessmentSignals,
  recordDiagnosticConsultation,
  releaseDiagnosticReport,
  startAssessmentAttempt,
  submitAssessmentAttempt,
  writeDiagnosticReport,
} from "../../../../packages/domain/assessments/services";
import type { AssessmentEvidenceStorage } from "../../../../packages/domain/assessments/storage";
import { InMemoryAssessmentDatabase } from "./support/in-memory-assessment-database";

function fakeJpegBytes(size = 16): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes;
}

function fakeEvidenceStorage(): AssessmentEvidenceStorage {
  const objects = new Map<string, Uint8Array>();
  return {
    async putPrivate({ key, body }) {
      objects.set(key, body);
    },
    async getPrivate(key) {
      if (!objects.has(key)) throw new Error(`No object stored for key "${key}".`);
      return { body: new ReadableStream(), contentType: "image/jpeg" };
    },
  };
}

function fakeNotifier(): AssessmentNotifier & { calls: Parameters<AssessmentNotifier["notify"]>[0][] } {
  const calls: Parameters<AssessmentNotifier["notify"]>[0][] = [];
  return {
    calls,
    async notify(notification) {
      calls.push(notification);
    },
  };
}

const tutor = { userId: "tutor-1", roles: ["tutor"] as const };
const student = {
  userId: "student-user",
  studentProfileId: "student-1",
  roles: ["student"] as const,
};
const parent = { userId: "parent-1", roles: ["parent"] as const };

async function setup(
  options: {
    cameraRequired?: boolean;
    evidenceCaptureEnabled?: boolean;
    audience?: { mode: "everyone" } | { mode: "selected"; studentProfileIds: string[] };
    maxAttempts?: number | null;
    integrityPolicy?: { violationLimit: number | null; action: "log_only" | "warn" | "auto_submit" };
  } = {},
) {
  const database = new InMemoryAssessmentDatabase();
  database.tutorAssignments.add("tutor-1:student-1");
  database.parentLinks.add("parent-1:student-1");
  const created = await createAssessment(database, tutor, {
    subjectId: "mathematics",
    title: "Algebra diagnostic",
    description: "A short diagnostic for linear equations.",
    type: "diagnostic",
    status: "published",
    version: {
      changeSummary: "Initial paper",
      durationSeconds: 1_800,
      fullscreenRequired: true,
      randomizeQuestionOrder: true,
      poolSelections: { linear: 1 },
      camera: {
        required: options.cameraRequired ?? false,
        policyVersion: options.cameraRequired ? "camera-v2" : null,
        headTrackingEnabled: options.evidenceCaptureEnabled ?? false,
        evidenceCaptureEnabled: options.evidenceCaptureEnabled ?? false,
      },
      audience: options.audience,
      maxAttempts: options.maxAttempts,
      integrityPolicy: options.integrityPolicy,
      questions: [
        {
          type: "numeric",
          prompt: "Solve {{coefficient}}x = 12.",
          choices: null,
          correctAnswer: null,
          points: 5,
          poolId: null,
          randomizeOptions: false,
          randomValues: [{ name: "coefficient", min: 2, max: 4, step: 1 }],
        },
        {
          type: "multiple_choice",
          prompt: "Which expression is linear?",
          choices: [
            { key: "a", label: "2x + 3" },
            { key: "b", label: "x²" },
          ],
          correctAnswer: "a",
          points: 5,
          poolId: "linear",
          randomizeOptions: true,
          randomValues: [],
        },
        {
          type: "multiple_choice",
          prompt: "Which graph has constant slope?",
          choices: [
            { key: "a", label: "A line" },
            { key: "b", label: "A circle" },
          ],
          correctAnswer: "a",
          points: 5,
          poolId: "linear",
          randomizeOptions: true,
          randomValues: [],
        },
      ],
    },
  });
  return { database, ...created };
}

describe("assessment integrity contract", () => {
  it("records a tab switch as a review signal without setting a verdict flag", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    await recordAssessmentSignal(database, student, session.attempt.id, {
      eventType: "tab_switch",
      clientOccurredAt: new Date().toISOString(),
      metadata: { visibilityState: "hidden" },
    });

    const review = await getAssessmentAttemptReview(database, tutor, session.attempt.id);
    expect(review.eventCounts.tab_switch).toBe(1);
    expect(review.events).toContainEqual(expect.objectContaining({ eventType: "tab_switch" }));
    expect(review.attempt).not.toHaveProperty("cheated");
    expect(review).not.toHaveProperty("verdict");
    expect(review.suspicion.score).toBeGreaterThan(0);
    expect(review.suspicion).not.toHaveProperty("verdict");
  });

  it("records a batch of proctoring signals in one call", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });

    const recorded = await recordAssessmentSignals(database, student, session.attempt.id, {
      signals: [
        { eventType: "face_missing", clientOccurredAt: null, metadata: null },
        { eventType: "face_returned", clientOccurredAt: null, metadata: null },
        { eventType: "devtools_shortcut", clientOccurredAt: null, metadata: { combo: "F12" } },
      ],
    });

    expect(recorded.events).toHaveLength(3);
    expect(recorded.attemptStatus).toBe("in_progress");
    const review = await getAssessmentAttemptReview(database, tutor, session.attempt.id);
    expect(review.eventCounts.face_missing).toBe(1);
    expect(review.eventCounts.devtools_shortcut).toBe(1);
  });

  it("silently drops signals that arrive after the attempt is no longer open, instead of erroring", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    await submitAssessmentAttempt(database, student, session.attempt.id, {
      honorStatementAccepted: true,
    });

    await expect(
      recordAssessmentSignal(database, student, session.attempt.id, {
        eventType: "fullscreen_exit",
        clientOccurredAt: null,
        metadata: null,
      }),
    ).resolves.toBeNull();

    const review = await getAssessmentAttemptReview(database, tutor, session.attempt.id);
    expect(review.eventCounts.fullscreen_exit ?? 0).toBe(0);
  });

  it("still rejects a signal from a student who does not own the attempt", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    const otherStudent = {
      userId: "other-student-user",
      studentProfileId: "student-2",
      roles: ["student"] as const,
    };

    await expect(
      recordAssessmentSignal(database, otherStudent, session.attempt.id, {
        eventType: "tab_switch",
        clientOccurredAt: null,
        metadata: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AssessmentError>);
  });

  it("blocks a camera-required attempt without explicit consent", async () => {
    const { database, assessment } = await setup({ cameraRequired: true });
    database.cameraConsents.add("student-1:camera-v2");

    await expect(
      startAssessmentAttempt(database, student, assessment.id, { cameraConsent: null }),
    ).rejects.toMatchObject({
      code: "CAMERA_CONSENT_REQUIRED",
    } satisfies Partial<AssessmentError>);
  });

  it("also requires an active record for the exact camera policy", async () => {
    const { database, assessment } = await setup({ cameraRequired: true });

    await expect(
      startAssessmentAttempt(database, student, assessment.id, {
        cameraConsent: { accepted: true, policyVersion: "camera-v2" },
      }),
    ).rejects.toMatchObject({
      code: "CAMERA_CONSENT_REQUIRED",
    } satisfies Partial<AssessmentError>);
  });

  it("requires the honor statement before submission", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });

    await expect(
      submitAssessmentAttempt(database, student, session.attempt.id, {
        honorStatementAccepted: false,
      }),
    ).rejects.toMatchObject({
      code: "HONOR_STATEMENT_REQUIRED",
    } satisfies Partial<AssessmentError>);

    await expect(
      submitAssessmentAttempt(database, student, session.attempt.id, {
        honorStatementAccepted: true,
      }),
    ).resolves.toMatchObject({
      status: "submitted",
      honorStatementAcceptedAt: expect.any(Date),
    });
  });

  it("selects the configured pool size and fixes randomized values for the attempt", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    const reloaded = await import("../../../../packages/domain/assessments/services").then(
      ({ getAssessmentSession }) => getAssessmentSession(database, student, session.attempt.id),
    );

    expect(session.questions).toHaveLength(2);
    expect(reloaded.questions).toEqual(session.questions);
    expect(session.questions.some((question) => question.prompt.includes("{{"))).toBe(false);
  });
});

describe("diagnostic report release", () => {
  it("keeps a tutor-written report from the parent until consultation and release", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    await submitAssessmentAttempt(database, student, session.attempt.id, {
      honorStatementAccepted: true,
    });
    const report = await writeDiagnosticReport(database, tutor, session.attempt.id, {
      summary: "The learner explains the method clearly.",
      strengths: "Equation structure",
      gaps: "Checking inverse operations",
      recommendedNextSteps: "Practice and discuss two worked examples.",
    });

    await expect(getDiagnosticReportForActor(database, parent, report.id)).rejects.toMatchObject({
      code: "REPORT_NOT_RELEASED",
    } satisfies Partial<AssessmentError>);
    await expect(releaseDiagnosticReport(database, tutor, report.id)).rejects.toMatchObject({
      code: "CONSULTATION_REQUIRED",
    } satisfies Partial<AssessmentError>);

    await recordDiagnosticConsultation(database, tutor, report.id, { consultedAt: null });
    await releaseDiagnosticReport(database, tutor, report.id);
    await expect(getDiagnosticReportForActor(database, parent, report.id)).resolves.toMatchObject({
      id: report.id,
      releasedToParentAt: expect.any(Date),
    });
  });
});

describe("tutor-facing attempt list", () => {
  it("shows the assigned tutor a submitted attempt with its suspicion severity", async () => {
    const { database, assessment } = await setup();
    database.studentNames.set("student-1", "Ari Student");
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    await recordAssessmentSignal(database, student, session.attempt.id, {
      eventType: "multiple_faces",
      clientOccurredAt: null,
      metadata: null,
    });
    await submitAssessmentAttempt(database, student, session.attempt.id, {
      honorStatementAccepted: true,
    });

    const page = await listAssessmentAttemptsForActor(database, tutor, assessment.id, {});
    expect(page.items).toHaveLength(1);
    const [item] = page.items;
    if (!item) throw new Error("expected one attempt in the list");
    expect(item).toMatchObject({
      id: session.attempt.id,
      studentName: "Ari Student",
      status: "submitted",
    });
    expect(item.suspicion.score).toBeGreaterThan(0);
    expect(page.nextCursor).toBeNull();
  });

  it("hides another tutor's students from the list, but staff see everyone", async () => {
    const { database, assessment } = await setup();
    const otherTutor = { userId: "tutor-2", roles: ["tutor"] as const };
    const staff = { userId: "admin-1", roles: ["administrator"] as const };
    await startAssessmentAttempt(database, student, assessment.id, { cameraConsent: null });

    const otherTutorPage = await listAssessmentAttemptsForActor(database, otherTutor, assessment.id, {});
    expect(otherTutorPage.items).toHaveLength(0);

    const staffPage = await listAssessmentAttemptsForActor(database, staff, assessment.id, {});
    expect(staffPage.items).toHaveLength(1);
  });

  it("rejects a student or parent trying to view the attempt list", async () => {
    const { database, assessment } = await setup();
    await expect(
      listAssessmentAttemptsForActor(database, student, assessment.id, {}),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AssessmentError>);
    await expect(
      listAssessmentAttemptsForActor(database, parent, assessment.id, {}),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AssessmentError>);
  });

  it("paginates with a cursor, newest attempt first", async () => {
    const { database, assessment } = await setup();
    const secondStudent = {
      userId: "student-2-user",
      studentProfileId: "student-2",
      roles: ["student"] as const,
    };
    database.tutorAssignments.add("tutor-1:student-2");
    const first = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    // ULIDs from the plain (non-monotonic) generator only sort reliably across different
    // milliseconds; force that gap so cursor ordering below is deterministic.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await startAssessmentAttempt(database, secondStudent, assessment.id, {
      cameraConsent: null,
    });

    const firstPage = await listAssessmentAttemptsForActor(database, tutor, assessment.id, {
      limit: 1,
    });
    expect(firstPage.items).toHaveLength(1);
    const [firstPageItem] = firstPage.items;
    if (!firstPageItem) throw new Error("expected one attempt in the first page");
    expect(firstPageItem.id).toBe(second.attempt.id);
    expect(firstPage.nextCursor).toBe(second.attempt.id);

    const secondPage = await listAssessmentAttemptsForActor(database, tutor, assessment.id, {
      limit: 1,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.items).toHaveLength(1);
    const [secondPageItem] = secondPage.items;
    if (!secondPageItem) throw new Error("expected one attempt in the second page");
    expect(secondPageItem.id).toBe(first.attempt.id);
    expect(secondPage.nextCursor).toBeNull();
  });
});

describe("audience", () => {
  it("keeps a published assessment open to every student by default", async () => {
    const { database, assessment } = await setup();
    await expect(
      startAssessmentAttempt(database, student, assessment.id, { cameraConsent: null }),
    ).resolves.toMatchObject({ attempt: { studentProfileId: "student-1" } });
  });

  it("blocks a student left out of a selected audience, both browsing and starting", async () => {
    const { database, assessment } = await setup({
      audience: { mode: "selected", studentProfileIds: ["student-2"] },
    });

    await expect(
      startAssessmentAttempt(database, student, assessment.id, { cameraConsent: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AssessmentError>);
    await expect(getAssessmentForActor(database, student, assessment.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<AssessmentError>);
    expect(await listAssessmentsForActor(database, student)).toHaveLength(0);
  });

  it("admits a student who is in the selected audience", async () => {
    const { database, assessment } = await setup({
      audience: { mode: "selected", studentProfileIds: ["student-1"] },
    });

    await expect(
      startAssessmentAttempt(database, student, assessment.id, { cameraConsent: null }),
    ).resolves.toMatchObject({ attempt: { studentProfileId: "student-1" } });
    expect(await listAssessmentsForActor(database, student)).toHaveLength(1);
  });

  it("never restricts a tutor or staff member browsing their own draft or any published assessment", async () => {
    const { database, assessment } = await setup({
      audience: { mode: "selected", studentProfileIds: ["student-2"] },
    });
    await expect(getAssessmentForActor(database, tutor, assessment.id)).resolves.toBeDefined();
  });

  it("lists a tutor's own assigned students, and every active student for staff", async () => {
    const { database } = await setup();
    database.studentNames.set("student-1", "Ari Student");
    database.activeStudents.push({ studentProfileId: "student-9", studentName: "Someone Else" });

    const forTutor = await listAssessableStudents(database, tutor);
    expect(forTutor).toEqual([{ studentProfileId: "student-1", studentName: "Ari Student" }]);

    const staff = { userId: "admin-1", roles: ["administrator"] as const };
    const forStaff = await listAssessableStudents(database, staff);
    expect(forStaff).toEqual([{ studentProfileId: "student-9", studentName: "Someone Else" }]);
  });
});

describe("max attempts", () => {
  it("allows a fresh attempt after time elapses without ever completing, without spending the allowance", async () => {
    const { database, assessment } = await setup({ maxAttempts: 1 });
    const first = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    // Simulate an abandoned (never-submitted) attempt — it must not consume the allowance.
    const stored = await database.getAttempt(first.attempt.id);
    if (!stored) throw new Error("expected the first attempt to exist");
    await database.saveAttempt({ ...stored, status: "abandoned" });

    await expect(
      startAssessmentAttempt(database, student, assessment.id, { cameraConsent: null }),
    ).resolves.toMatchObject({ attempt: { studentProfileId: "student-1" } });
  });

  it("blocks a new attempt once the student has completed the configured maximum", async () => {
    const { database, assessment } = await setup({ maxAttempts: 1 });
    const first = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    await submitAssessmentAttempt(database, student, first.attempt.id, {
      honorStatementAccepted: true,
    });

    await expect(
      startAssessmentAttempt(database, student, assessment.id, { cameraConsent: null }),
    ).rejects.toMatchObject({
      code: "ATTEMPT_LIMIT_REACHED",
    } satisfies Partial<AssessmentError>);
  });
});

describe("integrity policy", () => {
  it("leaves an attempt untouched under the default log-only policy, no matter how many signals arrive", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    for (let i = 0; i < 10; i += 1) {
      await recordAssessmentSignal(database, student, session.attempt.id, {
        eventType: "tab_switch",
        clientOccurredAt: null,
        metadata: null,
      });
    }
    const attempt = await database.getAttempt(session.attempt.id);
    expect(attempt?.status).toBe("in_progress");
  });

  it("auto-submits once the configured violation limit is reached, and stops accepting further answers", async () => {
    const { database, assessment } = await setup({
      integrityPolicy: { violationLimit: 2, action: "auto_submit" },
    });
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });

    const first = await recordAssessmentSignal(database, student, session.attempt.id, {
      eventType: "tab_switch",
      clientOccurredAt: null,
      metadata: null,
    });
    expect(first).not.toBeNull();
    let attempt = await database.getAttempt(session.attempt.id);
    expect(attempt?.status).toBe("in_progress");

    const secondBatch = await recordAssessmentSignals(database, student, session.attempt.id, {
      signals: [{ eventType: "fullscreen_exit", clientOccurredAt: null, metadata: null }],
    });
    expect(secondBatch.attemptStatus).toBe("abandoned");
    attempt = await database.getAttempt(session.attempt.id);
    expect(attempt?.status).toBe("abandoned");

    await expect(
      recordAssessmentSignal(database, student, session.attempt.id, {
        eventType: "tab_switch",
        clientOccurredAt: null,
        metadata: null,
      }),
    ).resolves.toBeNull();
  });

  it("never counts benign camera/face signals toward the violation limit", async () => {
    const { database, assessment } = await setup({
      integrityPolicy: { violationLimit: 1, action: "auto_submit" },
    });
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    await recordAssessmentSignals(database, student, session.attempt.id, {
      signals: [
        { eventType: "camera_ready", clientOccurredAt: null, metadata: null },
        { eventType: "face_returned", clientOccurredAt: null, metadata: null },
        { eventType: "connectivity_interruption", clientOccurredAt: null, metadata: null },
      ],
    });
    const attempt = await database.getAttempt(session.attempt.id);
    expect(attempt?.status).toBe("in_progress");
  });
});

describe("evidence capture", () => {
  async function startCameraAttempt(database: InMemoryAssessmentDatabase, assessmentId: string) {
    database.cameraConsents.add("student-1:camera-v2");
    return startAssessmentAttempt(database, student, assessmentId, {
      cameraConsent: { accepted: true, policyVersion: "camera-v2" },
    });
  }

  it("rejects an evidence upload when the version has not opted in", async () => {
    const { database, assessment } = await setup({ cameraRequired: true });
    const session = await startCameraAttempt(database, assessment.id);

    await expect(
      recordAssessmentEvidence(
        database,
        fakeEvidenceStorage(),
        student,
        session.attempt.id,
        { eventType: "multiple_faces", mimeType: "image/jpeg", sizeBytes: 16 },
        fakeJpegBytes(),
      ),
    ).rejects.toMatchObject({ code: "EVIDENCE_NOT_ENABLED" } satisfies Partial<AssessmentError>);
  });

  it("rejects an evidence upload from a student who does not own the attempt", async () => {
    const { database, assessment } = await setup({
      cameraRequired: true,
      evidenceCaptureEnabled: true,
    });
    const session = await startCameraAttempt(database, assessment.id);
    const otherStudent = {
      userId: "other-student-user",
      studentProfileId: "student-2",
      roles: ["student"] as const,
    };

    await expect(
      recordAssessmentEvidence(
        database,
        fakeEvidenceStorage(),
        otherStudent,
        session.attempt.id,
        { eventType: "multiple_faces", mimeType: "image/jpeg", sizeBytes: 16 },
        fakeJpegBytes(),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AssessmentError>);
  });

  it("records an evidence photo under its own event type, never inflating the triggering signal's count", async () => {
    const { database, assessment } = await setup({
      cameraRequired: true,
      evidenceCaptureEnabled: true,
    });
    const session = await startCameraAttempt(database, assessment.id);

    const evidence = await recordAssessmentEvidence(
      database,
      fakeEvidenceStorage(),
      student,
      session.attempt.id,
      { eventType: "multiple_faces", mimeType: "image/jpeg", sizeBytes: 16 },
      fakeJpegBytes(),
    );
    expect(evidence.eventType).toBe("multiple_faces");

    const review = await getAssessmentAttemptReview(database, tutor, session.attempt.id);
    expect(review.evidence).toHaveLength(1);
    expect(review.evidence[0]).toMatchObject({ id: evidence.id, eventType: "multiple_faces" });
    // The underlying row is "evidence_captured", not "multiple_faces" — see suspicion.test.ts for
    // the score-neutrality this is what protects.
    expect(review.eventCounts.multiple_faces ?? 0).toBe(0);
    expect(review.eventCounts.evidence_captured).toBe(1);
  });

  it("accepts evidence triggered by phone/unusual-item/eyes-closed detection, not just the original face-tracking triggers", async () => {
    const { database, assessment } = await setup({
      cameraRequired: true,
      evidenceCaptureEnabled: true,
    });
    const session = await startCameraAttempt(database, assessment.id);
    const storage = fakeEvidenceStorage();

    for (const eventType of ["phone_detected", "unusual_item_detected", "eyes_closed"] as const) {
      const evidence = await recordAssessmentEvidence(
        database,
        storage,
        student,
        session.attempt.id,
        { eventType, mimeType: "image/jpeg", sizeBytes: 16 },
        fakeJpegBytes(),
      );
      expect(evidence.eventType).toBe(eventType);
    }

    const review = await getAssessmentAttemptReview(database, tutor, session.attempt.id);
    expect(review.evidence.map((item) => item.eventType).sort()).toEqual([
      "eyes_closed",
      "phone_detected",
      "unusual_item_detected",
    ]);
  });

  it("lets the assigned tutor resolve the stored file, but rejects an unrelated tutor", async () => {
    const { database, assessment } = await setup({
      cameraRequired: true,
      evidenceCaptureEnabled: true,
    });
    const session = await startCameraAttempt(database, assessment.id);
    const evidence = await recordAssessmentEvidence(
      database,
      fakeEvidenceStorage(),
      student,
      session.attempt.id,
      { eventType: "face_missing", mimeType: "image/jpeg", sizeBytes: 16 },
      fakeJpegBytes(),
    );

    await expect(
      getAssessmentEvidenceForActor(database, tutor, session.attempt.id, evidence.id),
    ).resolves.toMatchObject({ mimeType: "image/jpeg" });

    const otherTutor = { userId: "tutor-2", roles: ["tutor"] as const };
    await expect(
      getAssessmentEvidenceForActor(database, otherTutor, session.attempt.id, evidence.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AssessmentError>);
  });

  it("stops accepting new evidence once the per-attempt cap is reached", async () => {
    const { database, assessment } = await setup({
      cameraRequired: true,
      evidenceCaptureEnabled: true,
    });
    const session = await startCameraAttempt(database, assessment.id);
    const storage = fakeEvidenceStorage();
    for (let i = 0; i < 60; i += 1) {
      await recordAssessmentEvidence(
        database,
        storage,
        student,
        session.attempt.id,
        { eventType: "multiple_faces", mimeType: "image/jpeg", sizeBytes: 16 },
        fakeJpegBytes(),
      );
    }

    await expect(
      recordAssessmentEvidence(
        database,
        storage,
        student,
        session.attempt.id,
        { eventType: "multiple_faces", mimeType: "image/jpeg", sizeBytes: 16 },
        fakeJpegBytes(),
      ),
    ).rejects.toMatchObject({ code: "EVIDENCE_LIMIT_REACHED" } satisfies Partial<AssessmentError>);
  });

  it("notifies the assigned tutor with a link to the review page when a camera-required attempt is submitted", async () => {
    const { database, assessment } = await setup({
      cameraRequired: true,
      evidenceCaptureEnabled: true,
    });
    const session = await startCameraAttempt(database, assessment.id);
    const notifier = fakeNotifier();

    await submitAssessmentAttempt(
      database,
      student,
      session.attempt.id,
      { honorStatementAccepted: true },
      notifier,
    );

    expect(notifier.calls).toHaveLength(1);
    expect(notifier.calls[0]).toMatchObject({
      userId: "tutor-1",
      type: "progress_update",
      data: { actionUrl: expect.stringContaining(session.attempt.id) },
    });
  });

  it("never notifies for an attempt that did not require a camera", async () => {
    const { database, assessment } = await setup();
    const session = await startAssessmentAttempt(database, student, assessment.id, {
      cameraConsent: null,
    });
    const notifier = fakeNotifier();

    await submitAssessmentAttempt(
      database,
      student,
      session.attempt.id,
      { honorStatementAccepted: true },
      notifier,
    );

    expect(notifier.calls).toHaveLength(0);
  });

  it("still submits successfully even when the notifier throws (e.g. an unconfigured dispatcher)", async () => {
    const { database, assessment } = await setup({
      cameraRequired: true,
      evidenceCaptureEnabled: true,
    });
    const session = await startCameraAttempt(database, assessment.id);
    const brokenNotifier: AssessmentNotifier = {
      async notify() {
        throw new Error("Notifications are not configured. Call configureNotifications() at the composition root.");
      },
    };

    await expect(
      submitAssessmentAttempt(
        database,
        student,
        session.attempt.id,
        { honorStatementAccepted: true },
        brokenNotifier,
      ),
    ).resolves.toMatchObject({ status: "submitted" });

    const attempt = await database.getAttempt(session.attempt.id);
    expect(attempt?.status).toBe("submitted");
  });
});

describe("delete (archive)", () => {
  it("lets the author archive their own assessment, dropping it out of every listing", async () => {
    const { database, assessment } = await setup();
    expect(await listAssessmentsForActor(database, student)).toHaveLength(1);

    await deleteAssessment(database, tutor, assessment.id);

    expect(await listAssessmentsForActor(database, student)).toHaveLength(0);
    expect(await listAssessmentsForActor(database, tutor)).toHaveLength(0);
    await expect(startAssessmentAttempt(database, student, assessment.id, { cameraConsent: null })).rejects.toMatchObject(
      { code: "ASSESSMENT_NOT_OPEN" } satisfies Partial<AssessmentError>,
    );
  });

  it("still lets the author (or staff) open an archived assessment directly, e.g. to review past attempts", async () => {
    const { database, assessment } = await setup();
    await deleteAssessment(database, tutor, assessment.id);
    await expect(getAssessmentForActor(database, tutor, assessment.id)).resolves.toBeDefined();
  });

  it("rejects a tutor deleting another tutor's assessment", async () => {
    const { database, assessment } = await setup();
    const otherTutor = { userId: "tutor-2", roles: ["tutor"] as const };
    await expect(deleteAssessment(database, otherTutor, assessment.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<AssessmentError>);
  });

  it("lets staff delete any assessment", async () => {
    const { database, assessment } = await setup();
    const staff = { userId: "admin-1", roles: ["administrator"] as const };
    await deleteAssessment(database, staff, assessment.id);
    expect(await database.getAssessment(assessment.id)).toMatchObject({ status: "archived" });
  });
});
