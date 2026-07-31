import type { SubmissionStorage } from "../assignments/storage";
/** Tutor-created materials use the existing private, quarantined D7 storage boundary. Video MIME types are deliberately excluded. */
export type ContentStorage = Pick<SubmissionStorage, "putPrivate">;
