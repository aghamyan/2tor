import type {
  DiscussionFeedItem,
  DiscussionStatus,
} from "../../../../packages/domain/discussions/models";

export type QuestionState =
  "needs_answer" | "student_discussion" | "tutor_replied" | DiscussionStatus;

/** Turns stored workflow state plus real answer signals into language people can scan in a feed. */
export function questionState(item: DiscussionFeedItem): QuestionState {
  if (item.question.status === "open") {
    return item.answerCount === 0 ? "needs_answer" : "student_discussion";
  }
  if (item.question.status === "answered") {
    return item.tutorAnswerCount > 0 ? "tutor_replied" : "student_discussion";
  }
  return item.question.status;
}

export function needsTutorAttention(item: DiscussionFeedItem): boolean {
  const state = questionState(item);
  return state === "needs_answer" || state === "needs_tutor_review";
}

export function hasTutorReviewSignal(item: DiscussionFeedItem): boolean {
  const state = questionState(item);
  return (
    state === "tutor_replied" ||
    state === "tutor_verified" ||
    state === "accepted" ||
    state === "resolved"
  );
}
