import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, HMAC-signed download tokens for question attachments — same scheme as
 * `packages/domain/communication/storage.ts`'s message-attachment download links. The token
 * authorizes hitting our own API route (which re-checks question access server-side and streams
 * from S3), never a direct/public bucket URL.
 */
type DownloadPayload = { attachmentId: string; userId: string; expiresAt: number };
const encode = (value: string) => Buffer.from(value).toString("base64url");

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for signed attachment URLs.`);
  return value;
}
const sign = (value: string) =>
  createHmac("sha256", required("SESSION_SECRET")).update(value).digest("base64url");

export function createDiscussionAttachmentSignedUrl(
  attachmentId: string,
  userId: string,
  ttlSeconds = 60,
): string {
  const payload = encode(
    JSON.stringify({
      attachmentId,
      userId,
      expiresAt: Math.floor(Date.now() / 1_000) + ttlSeconds,
    } satisfies DownloadPayload),
  );
  return `/api/discussions/attachments/${attachmentId}/download?token=${encode(`${payload}.${sign(payload)}`)}`;
}

export function verifyDiscussionAttachmentSignedUrl(
  token: string,
  attachmentId: string,
  userId: string,
): boolean {
  try {
    const decodedToken = Buffer.from(token, "base64url").toString("utf8");
    const [payload, actual] = decodedToken.split(".");
    if (!payload || !actual) return false;
    const expected = sign(payload);
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      return false;
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as DownloadPayload;
    return (
      decoded.attachmentId === attachmentId &&
      decoded.userId === userId &&
      decoded.expiresAt >= Math.floor(Date.now() / 1_000)
    );
  } catch {
    return false;
  }
}
