/** Mirrors the server-side allow-list in `packages/domain/discussions/services.ts` — this is a
 *  UX-only pre-check so users get instant feedback; the server re-validates every upload. */
export const ALLOWED_ATTACHMENT_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export const ALLOWED_ATTACHMENT_EXTENSIONS = ".jpg,.jpeg,.png,.pdf";
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_QUESTION = 6;

export function isAllowedAttachmentType(mimeType: string): boolean {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
