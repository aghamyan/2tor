import {
  assignmentQuestions,
  assignments,
  assignmentSubmissions,
  gradingRecords,
  rubricScores,
  rubrics,
  studentProfiles,
  submissionAnswers,
  submissionFiles,
  tutorProfiles,
  tutorStudentAssignments,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
import type {
  AssignmentDatabase,
  AssignmentQuestionRecord,
  AssignmentRecord,
  GradingRecord,
  SubmissionAnswerRecord,
  SubmissionRecord,
  VirusScanStatus,
} from "./models";

type Executor = Database | Transaction;
const numeric = (value: string | null) => (value === null ? null : Number(value));
const questionFromRow = (
  row: typeof assignmentQuestions.$inferSelect,
): AssignmentQuestionRecord => ({
  id: row.id,
  assignmentId: row.assignmentId,
  orderIndex: row.orderIndex,
  type: row.type,
  prompt: row.prompt,
  options: (row.options as AssignmentQuestionRecord["options"]) ?? null,
  points: numeric(row.points),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const answerFromRow = (row: typeof submissionAnswers.$inferSelect): SubmissionAnswerRecord => ({
  id: row.id,
  submissionId: row.submissionId,
  questionId: row.questionId,
  answerText: row.answerText,
  selectedOptionKey: row.selectedOptionKey,
  pointsAwarded: numeric(row.pointsAwarded),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): AssignmentDatabase {
  return {
    async transaction<T>(operation: (database: AssignmentDatabase) => Promise<T>) {
      return insideTransaction
        ? operation(repository(executor, root, true))
        : root.transaction((tx) => operation(repository(tx, root, true)));
    },
    async saveAssignment(assignment) {
      await executor.insert(assignments).values({
        id: assignment.id,
        createdByUserId: assignment.createdByUserId,
        studentProfileId: assignment.studentProfileId,
        subjectId: assignment.subjectId,
        lessonId: assignment.lessonId,
        title: assignment.title,
        instructions: assignment.instructions,
        dueAt: assignment.dueAt,
        status: assignment.status,
        maxScore: assignment.maxScore === null ? null : String(assignment.maxScore),
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      });
      await executor.insert(assignmentQuestions).values(
        assignment.questions.map((question) => ({
          id: question.id,
          assignmentId: assignment.id,
          orderIndex: question.orderIndex,
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          points: question.points === null ? null : String(question.points),
          createdAt: question.createdAt,
          updatedAt: question.updatedAt,
        })),
      );
    },
    async getAssignment(assignmentId) {
      const [row] = await executor
        .select()
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);
      if (!row) return null;
      const questions = await executor
        .select()
        .from(assignmentQuestions)
        .where(eq(assignmentQuestions.assignmentId, assignmentId))
        .orderBy(asc(assignmentQuestions.orderIndex));
      return {
        id: row.id,
        createdByUserId: row.createdByUserId,
        studentProfileId: row.studentProfileId,
        subjectId: row.subjectId,
        lessonId: row.lessonId,
        title: row.title,
        instructions: row.instructions,
        dueAt: row.dueAt,
        status: row.status,
        maxScore: numeric(row.maxScore),
        questions: questions.map(questionFromRow),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies AssignmentRecord;
    },
    async saveSubmission(submission) {
      const [existing] = await executor
        .select({ id: assignmentSubmissions.id })
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.id, submission.id))
        .limit(1);
      const values = {
        status: submission.status,
        submittedAt: submission.submittedAt,
        updatedAt: submission.updatedAt,
      };
      if (existing)
        await executor
          .update(assignmentSubmissions)
          .set(values)
          .where(eq(assignmentSubmissions.id, submission.id));
      else
        await executor.insert(assignmentSubmissions).values({
          id: submission.id,
          assignmentId: submission.assignmentId,
          studentProfileId: submission.studentProfileId,
          attemptNumber: submission.attemptNumber,
          ...values,
          createdAt: submission.createdAt,
        });
    },
    async getSubmission(submissionId) {
      const [row] = await executor
        .select()
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.id, submissionId))
        .limit(1);
      if (!row) return null;
      const answers = await executor
        .select()
        .from(submissionAnswers)
        .where(eq(submissionAnswers.submissionId, row.id));
      return {
        id: row.id,
        assignmentId: row.assignmentId,
        studentProfileId: row.studentProfileId,
        status: row.status,
        attemptNumber: row.attemptNumber,
        submittedAt: row.submittedAt,
        answers: answers.map(answerFromRow),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies SubmissionRecord;
    },
    async getSubmissionForAssignmentStudent(assignmentId, studentProfileId) {
      const [row] = await executor
        .select({ id: assignmentSubmissions.id })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentProfileId, studentProfileId),
          ),
        )
        .orderBy(asc(assignmentSubmissions.attemptNumber))
        .limit(1);
      return row ? this.getSubmission(row.id) : null;
    },
    async replaceSubmissionAnswers(submissionId, answers) {
      await executor
        .delete(submissionAnswers)
        .where(eq(submissionAnswers.submissionId, submissionId));
      if (answers.length)
        await executor.insert(submissionAnswers).values(
          answers.map((answer) => ({
            ...answer,
            pointsAwarded: answer.pointsAwarded === null ? null : String(answer.pointsAwarded),
          })),
        );
    },
    async saveSubmissionFile(file) {
      await executor.insert(submissionFiles).values(file);
    },
    async getSubmissionFile(fileId) {
      const [row] = await executor
        .select()
        .from(submissionFiles)
        .where(eq(submissionFiles.id, fileId))
        .limit(1);
      return row
        ? {
            id: row.id,
            submissionId: row.submissionId,
            fileKey: row.fileKey,
            fileName: row.fileName,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            virusScanStatus: row.virusScanStatus,
            uploadedAt: row.uploadedAt,
          }
        : null;
    },
    async updateSubmissionFileScanStatus(fileId, status: VirusScanStatus) {
      await executor
        .update(submissionFiles)
        .set({ virusScanStatus: status })
        .where(eq(submissionFiles.id, fileId));
    },
    async saveGrading(grading: GradingRecord) {
      await executor
        .insert(gradingRecords)
        .values({
          ...grading,
          score: grading.score === null ? null : String(grading.score),
          maxScore: grading.maxScore === null ? null : String(grading.maxScore),
        })
        .onConflictDoUpdate({
          target: gradingRecords.submissionId,
          set: {
            gradedByUserId: grading.gradedByUserId,
            score: grading.score === null ? null : String(grading.score),
            maxScore: grading.maxScore === null ? null : String(grading.maxScore),
            feedback: grading.feedback,
            gradedAt: grading.gradedAt,
            updatedAt: grading.updatedAt,
          },
        });
    },
    async replaceRubricScores(submissionId, scores) {
      await executor.delete(rubricScores).where(eq(rubricScores.submissionId, submissionId));
      if (scores.length)
        await executor.insert(rubricScores).values(
          scores.map((score) => ({
            ...score,
            scoreValue: String(score.scoreValue),
            maxValue: String(score.maxValue),
          })),
        );
    },
    async saveRubric(rubric) {
      await executor.insert(rubrics).values(rubric);
    },
    async getRubric(rubricId) {
      const [row] = await executor.select().from(rubrics).where(eq(rubrics.id, rubricId)).limit(1);
      return row ? { ...row, description: row.description, subjectId: row.subjectId } : null;
    },
    async findStudentProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },
    async isTutorAssignedToStudent(tutorUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: tutorStudentAssignments.id })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .where(
          and(
            eq(tutorProfiles.userId, tutorUserId),
            eq(tutorStudentAssignments.studentProfileId, studentProfileId),
            eq(tutorStudentAssignments.status, "active"),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async listStaleAssignmentReminders(before, limit) {
      const overdue = await executor
        .select({
          assignmentId: assignments.id,
          studentProfileId: assignments.studentProfileId,
          studentUserId: studentProfiles.userId,
          dueAt: assignments.dueAt,
        })
        .from(assignments)
        .innerJoin(studentProfiles, eq(studentProfiles.id, assignments.studentProfileId))
        .where(and(eq(assignments.status, "published"), lt(assignments.dueAt, before)))
        .orderBy(asc(assignments.dueAt))
        .limit(limit * 2);
      if (!overdue.length) return [];
      const submitted = await executor
        .select({
          assignmentId: assignmentSubmissions.assignmentId,
          studentProfileId: assignmentSubmissions.studentProfileId,
        })
        .from(assignmentSubmissions)
        .where(
          and(
            inArray(
              assignmentSubmissions.assignmentId,
              overdue.map((assignment) => assignment.assignmentId),
            ),
            inArray(assignmentSubmissions.status, ["submitted", "graded", "returned"]),
          ),
        );
      const complete = new Set(
        submitted.map((item) => `${item.assignmentId}:${item.studentProfileId}`),
      );
      return overdue
        .filter(
          (
            assignment,
          ): assignment is {
            assignmentId: string;
            studentProfileId: string;
            studentUserId: string;
            dueAt: Date;
          } =>
            assignment.dueAt !== null &&
            !complete.has(`${assignment.assignmentId}:${assignment.studentProfileId}`),
        )
        .slice(0, limit);
    },
  };
}

export function createDrizzleAssignmentsDatabase(database: Database): AssignmentDatabase {
  return repository(database, database, false);
}
