export interface DiscussionActionState {
  status: "idle" | "success" | "error";
  message:
    | null
    | "questionPosted"
    | "questionUpdated"
    | "questionDeleted"
    | "questionClosed"
    | "questionReopened"
    | "questionLocked"
    | "questionUnlocked"
    | "questionMarkedDuplicate"
    | "attachmentUploaded"
    | "answerPosted"
    | "answerUpdated"
    | "answerDeleted"
    | "answerAccepted"
    | "answerUnaccepted"
    | "helpfulVoted"
    | "answerVerified"
    | "revisionRequested"
    | "ratingSaved"
    | "ratingUpdated"
    | "ratingRemoved"
    | "ratingInvalidated"
    | "commentPosted"
    | "commentUpdated"
    | "commentDeleted"
    | "correctionProposed"
    | "correctionResponded"
    | "correctionResolved"
    | "followed"
    | "unfollowed"
    | "saved"
    | "unsaved"
    | "reported"
    | "reportAssigned"
    | "reportResolved"
    | "contentRemoved"
    | "contentRestored"
    | "errors.unauthenticated"
    | "errors.forbidden"
    | "errors.notFound"
    | "errors.conflict"
    | "errors.invalid"
    | "errors.rateLimited"
    | "errors.generic";
  fieldErrors: Record<string, string[]>;
  /** Set only by `askQuestionAction` on success, so the client can upload staged attachments to
   *  the new question before navigating — the action deliberately does not redirect itself. */
  slug?: string;
  questionId?: string;
}

export const initialDiscussionActionState: DiscussionActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
