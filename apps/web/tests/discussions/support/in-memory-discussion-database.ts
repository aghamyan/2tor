import type {
  AttachmentScanStatus,
  DiscussionAnswerRecord,
  DiscussionAttachmentRecord,
  DiscussionDatabase,
  DiscussionQuestionRecord,
  DiscussionScope,
  DiscussionVoteRecord,
  SafeDisplayIdentity,
} from "../../../../../packages/domain/discussions/models";

export class InMemoryDiscussionDatabase implements DiscussionDatabase {
  readonly questions = new Map<string, DiscussionQuestionRecord>();
  readonly answers = new Map<string, DiscussionAnswerRecord>();
  readonly attachments = new Map<string, DiscussionAttachmentRecord>();
  readonly votes: DiscussionVoteRecord[] = [];
  readonly identities = new Map<string, SafeDisplayIdentity>();
  readonly parentLinks = new Set<string>();
  readonly tutorStudentAssignments = new Set<string>();
  readonly groupStudents = new Set<string>();
  readonly groupTutors = new Set<string>();
  readonly approvedAnswerers = new Set<string>();

  async transaction<T>(operation: (database: DiscussionDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async saveQuestion(question: DiscussionQuestionRecord) {
    this.questions.set(question.id, question);
  }
  async getQuestion(questionId: string) {
    return this.questions.get(questionId) ?? null;
  }
  async listQuestions(scope: DiscussionScope) {
    return [...this.questions.values()].filter(
      (question) =>
        question.courseId === scope.courseId &&
        question.groupId === scope.groupId &&
        question.subjectId === scope.subjectId,
    );
  }
  async updateQuestionStatus(questionId: string, status: DiscussionQuestionRecord["status"]) {
    const question = this.questions.get(questionId);
    if (question) this.questions.set(questionId, { ...question, status, updatedAt: new Date() });
  }
  async saveAnswer(answer: DiscussionAnswerRecord) {
    this.answers.set(answer.id, answer);
  }
  async getAnswer(answerId: string) {
    return this.answers.get(answerId) ?? null;
  }
  async listAnswers(questionId: string) {
    return [...this.answers.values()].filter((answer) => answer.questionId === questionId);
  }
  async updateAnswerVerification(answerId: string, verifiedByUserId: string, verifiedAt: Date) {
    const answer = this.answers.get(answerId);
    if (answer)
      this.answers.set(answerId, {
        ...answer,
        verificationStatus: "verified",
        verifiedByUserId,
        verifiedAt,
        updatedAt: verifiedAt,
      });
  }
  async saveAttachment(attachment: DiscussionAttachmentRecord) {
    this.attachments.set(attachment.id, attachment);
  }
  async getAttachment(attachmentId: string) {
    return this.attachments.get(attachmentId) ?? null;
  }
  async updateAttachmentScanStatus(attachmentId: string, status: AttachmentScanStatus) {
    const attachment = this.attachments.get(attachmentId);
    if (attachment) this.attachments.set(attachmentId, { ...attachment, virusScanStatus: status });
  }
  async saveVote(vote: DiscussionVoteRecord) {
    this.votes.push(vote);
  }
  async hasVote(answerId: string, voterUserId: string) {
    return this.votes.some(
      (vote) => vote.answerId === answerId && vote.voterUserId === voterUserId,
    );
  }
  async countVotesByUserSince(voterUserId: string, since: Date) {
    return this.votes.filter((vote) => vote.voterUserId === voterUserId && vote.createdAt >= since)
      .length;
  }
  async getSafeDisplayIdentity(userId: string) {
    return this.identities.get(userId) ?? null;
  }
  async isParentLinkedToStudent(parentUserId: string, studentProfileId: string) {
    return this.parentLinks.has(`${parentUserId}:${studentProfileId}`);
  }
  async isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string) {
    return this.tutorStudentAssignments.has(`${tutorUserId}:${studentProfileId}`);
  }
  async isStudentInGroup(studentProfileId: string, groupId: string) {
    return this.groupStudents.has(`${studentProfileId}:${groupId}`);
  }
  async isTutorAssignedToGroup(tutorUserId: string, groupId: string) {
    return this.groupTutors.has(`${tutorUserId}:${groupId}`);
  }
  async isApprovedStudentAnswerer(studentProfileId: string, groupId: string | null) {
    return this.approvedAnswerers.has(`${studentProfileId}:${groupId ?? "private"}`);
  }
}
