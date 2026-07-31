import { describe, expect, it } from "vitest";
import { AssignmentError } from "../../../../packages/domain/assignments/errors";
import {
  createAssignment,
  getDownloadableSubmissionFile,
  getSubmissionForActor,
  gradeSubmission,
  recordSubmissionFileScanResult,
  saveSubmissionAnswers,
  uploadSubmissionFile,
} from "../../../../packages/domain/assignments/services";
import type { SubmissionStorage } from "../../../../packages/domain/assignments/storage";
import { InMemoryAssignmentDatabase } from "./support/in-memory-assignment-database";

const tutor = { userId: "tutor-assigned", roles: ["tutor"] as const };
const otherTutor = { userId: "tutor-unassigned", roles: ["tutor"] as const };
const student = {
  userId: "student-user",
  studentProfileId: "student-1",
  roles: ["student"] as const,
};
const storage: SubmissionStorage = {
  putPrivate: async () => {},
  getPrivate: async () => ({ body: new ReadableStream(), contentType: "application/pdf" }),
};

async function setup() {
  const database = new InMemoryAssignmentDatabase();
  database.tutorAssignments.add("tutor-assigned:student-1");
  const assignment = await createAssignment(database, tutor, {
    studentProfileId: "student-1",
    subjectId: null,
    lessonId: null,
    title: "Fraction practice",
    instructions: null,
    dueAt: null,
    status: "published",
    maxScore: 10,
    questions: [
      { type: "short_answer", prompt: "Add one half and one quarter.", options: null, points: 10 },
    ],
  });
  const question = assignment.questions.at(0);
  if (!question) throw new Error("Expected a question.");
  const submission = await saveSubmissionAnswers(database, student, assignment.id, {
    answers: [{ questionId: question.id, answerText: "Three quarters", selectedOptionKey: null }],
    submit: true,
  });
  return { database, assignment, submission };
}

describe("assignment submission security", () => {
  it("rejects disallowed and oversized uploads before private storage", async () => {
    const { database, submission } = await setup();
    const pdf = new TextEncoder().encode("%PDF-1.7");
    await expect(
      uploadSubmissionFile(
        database,
        storage,
        student,
        submission.id,
        { fileName: "script.exe", mimeType: "application/x-msdownload", sizeBytes: pdf.length },
        pdf,
      ),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_ALLOWED" } satisfies Partial<AssignmentError>);
    await expect(
      uploadSubmissionFile(
        database,
        storage,
        student,
        submission.id,
        { fileName: "huge.pdf", mimeType: "application/pdf", sizeBytes: 26 * 1024 * 1024 },
        pdf,
      ),
    ).rejects.toMatchObject({ code: "UPLOAD_TOO_LARGE" } satisfies Partial<AssignmentError>);
  });

  it("keeps a file quarantined until the scan reports clean", async () => {
    const { database, submission } = await setup();
    const pdf = new TextEncoder().encode("%PDF-1.7\ncontent");
    const file = await uploadSubmissionFile(
      database,
      storage,
      student,
      submission.id,
      { fileName: "work.pdf", mimeType: "application/pdf", sizeBytes: pdf.length },
      pdf,
    );
    await expect(getDownloadableSubmissionFile(database, student, file.id)).rejects.toMatchObject({
      code: "FILE_NOT_READY",
    } satisfies Partial<AssignmentError>);
    await recordSubmissionFileScanResult(database, file.id, "clean");
    await expect(getDownloadableSubmissionFile(database, student, file.id)).resolves.toMatchObject({
      id: file.id,
      virusScanStatus: "clean",
    });
  });

  it("denies an unassigned tutor both submission viewing and grading", async () => {
    const { database, submission } = await setup();
    await expect(getSubmissionForActor(database, otherTutor, submission.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<AssignmentError>);
    await expect(
      gradeSubmission(database, otherTutor, submission.id, {
        score: 8,
        maxScore: 10,
        feedback: "Good method.",
        rubricScores: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AssignmentError>);
  });
});
