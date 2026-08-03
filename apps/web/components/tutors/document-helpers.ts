import type { TutorDocumentRecord, TutorDocumentType } from "../../../../packages/domain/tutors/models";

export const REQUIRED_DOCUMENT_TYPES: readonly TutorDocumentType[] = [
  "identity",
  "education",
  "certification",
];

/** A tutor can re-upload after a rejection, so multiple rows can share a type — the most recent one
 * is what "status" means for that type. Shared by `VerificationDocuments` (the upload rows) and
 * `ProfileCompletionCard` (the checklist), so the two never disagree about what's on file. */
export function latestDocumentByType(
  documents: readonly TutorDocumentRecord[],
  type: TutorDocumentType,
): TutorDocumentRecord | undefined {
  return documents
    .filter((document) => document.type === type)
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
}

/** "Complete" means a non-rejected submission is on file for every required type — a rejected
 * document means the tutor still owes a resubmission, not that the step is done. */
export function hasRequiredDocuments(documents: readonly TutorDocumentRecord[]): boolean {
  return REQUIRED_DOCUMENT_TYPES.every((type) => {
    const latest = latestDocumentByType(documents, type);
    return latest !== undefined && latest.status !== "rejected";
  });
}
