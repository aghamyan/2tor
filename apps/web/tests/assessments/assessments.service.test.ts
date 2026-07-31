import { describe, expect, it } from "vitest";
import { AssessmentError } from "../../../../packages/domain/assessments/errors";
import {
  createAssessment,
  getAssessmentAttemptReview,
  getDiagnosticReportForActor,
  recordAssessmentSignal,
  recordDiagnosticConsultation,
  releaseDiagnosticReport,
  startAssessmentAttempt,
  submitAssessmentAttempt,
  writeDiagnosticReport,
} from "../../../../packages/domain/assessments/services";
import { InMemoryAssessmentDatabase } from "./support/in-memory-assessment-database";

const tutor = { userId: "tutor-1", roles: ["tutor"] as const };
const student = {
  userId: "student-user",
  studentProfileId: "student-1",
  roles: ["student"] as const,
};
const parent = { userId: "parent-1", roles: ["parent"] as const };

async function setup(options: { cameraRequired?: boolean } = {}) {
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
      },
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
