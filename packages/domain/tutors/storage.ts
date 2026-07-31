import { createHmac, timingSafeEqual } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { TutorDocumentStorage } from "./services";

export interface PrivateTutorDocumentStorage extends TutorDocumentStorage {
  getPrivate(
    key: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentType: string | undefined }>;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for private tutor document storage.`);
  return value;
}

/** S3 is deliberately private: no ACL/public URL is set and new documents remain quarantined. */
export function createS3TutorDocumentStorage(): PrivateTutorDocumentStorage {
  const client = new S3Client({
    endpoint: required("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
  });
  const bucket = required("S3_BUCKET");
  return {
    async putPrivate({ key, body, mimeType, metadata }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
          Metadata: metadata,
          ServerSideEncryption: process.env.KMS_KEY_ID ? "aws:kms" : undefined,
          SSEKMSKeyId: process.env.KMS_KEY_ID,
        }),
      );
    },
    async getPrivate(key) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!response.Body || !("transformToWebStream" in response.Body))
        throw new Error("Private document body is unavailable.");
      return { body: response.Body.transformToWebStream(), contentType: response.ContentType };
    },
  };
}

type SignedDownloadPayload = { documentId: string; userId: string; expiresAt: number };

function downloadSecret(): string {
  return required("SESSION_SECRET");
}
function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}
function sign(value: string): string {
  return createHmac("sha256", downloadSecret()).update(value).digest("base64url");
}

/** A short-lived signed application URL, not a public S3 URL. The route streams the private object. */
export function createTutorDocumentSignedUrl(
  documentId: string,
  userId: string,
  ttlSeconds = 60,
): string {
  const payload: SignedDownloadPayload = {
    documentId,
    userId,
    expiresAt: Math.floor(Date.now() / 1_000) + ttlSeconds,
  };
  const token = encode(JSON.stringify(payload));
  return `/api/tutors/documents/${documentId}/download?token=${encode(`${token}.${sign(token)}`)}`;
}

export function verifyTutorDocumentSignedUrl(
  token: string,
  documentId: string,
  userId: string,
): boolean {
  try {
    const [encodedPayload, actualSignature] = Buffer.from(token, "base64url")
      .toString("utf8")
      .split(".");
    if (!encodedPayload || !actualSignature) return false;
    const expectedSignature = sign(encodedPayload);
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(actualSignature), Buffer.from(expectedSignature))
    )
      return false;
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SignedDownloadPayload;
    return (
      payload.documentId === documentId &&
      payload.userId === userId &&
      payload.expiresAt >= Math.floor(Date.now() / 1_000)
    );
  } catch {
    return false;
  }
}
