import { createHmac, timingSafeEqual } from "node:crypto";
import type { SubmissionStorage } from "../assignments/storage";
/** Tutor-created materials use the existing private, quarantined D7 storage boundary. Video MIME types are deliberately excluded. */
export type ContentStorage = Pick<SubmissionStorage, "putPrivate" | "getPrivate">;

/** Short-lived, user-bound download links — same signing shape as `assignments/storage.ts`'s
 *  submission files, kept as an independent implementation here since it embeds this domain's URL. */
type DownloadPayload = { uploadId: string; userId: string; expiresAt: number };
function secret() {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value) throw new Error("SESSION_SECRET is required for content storage.");
  return value;
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}
export function createContentUploadSignedUrl(
  uploadId: string,
  userId: string,
  ttlSeconds = 60,
): string {
  const token = encode(
    JSON.stringify({
      uploadId,
      userId,
      expiresAt: Math.floor(Date.now() / 1_000) + ttlSeconds,
    } satisfies DownloadPayload),
  );
  return `/api/content/uploads/${uploadId}/download?token=${encode(`${token}.${sign(token)}`)}`;
}
export function verifyContentUploadSignedUrl(token: string, uploadId: string, userId: string): boolean {
  try {
    const [encodedPayload, actualSignature] = Buffer.from(token, "base64url")
      .toString("utf8")
      .split(".");
    if (!encodedPayload || !actualSignature) return false;
    const expected = sign(encodedPayload);
    if (
      actualSignature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(actualSignature), Buffer.from(expected))
    )
      return false;
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as DownloadPayload;
    return (
      payload.uploadId === uploadId &&
      payload.userId === userId &&
      payload.expiresAt >= Math.floor(Date.now() / 1_000)
    );
  } catch {
    return false;
  }
}
