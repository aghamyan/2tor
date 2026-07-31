import { createHmac, timingSafeEqual } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface SubmissionStorage {
  putPrivate(input: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    metadata: Record<string, string>;
  }): Promise<void>;
  getPrivate(
    key: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentType: string | undefined }>;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for assignment storage.`);
  return value;
}

/** Objects are always private; applications issue their own short-lived, user-bound download URLs. */
export function createS3SubmissionStorage(): SubmissionStorage {
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
        throw new Error("Private submission body is unavailable.");
      return { body: response.Body.transformToWebStream(), contentType: response.ContentType };
    },
  };
}

type DownloadPayload = { fileId: string; userId: string; expiresAt: number };
function secret() {
  return required("SESSION_SECRET");
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function createSubmissionFileSignedUrl(
  fileId: string,
  userId: string,
  ttlSeconds = 60,
): string {
  const token = encode(
    JSON.stringify({
      fileId,
      userId,
      expiresAt: Math.floor(Date.now() / 1_000) + ttlSeconds,
    } satisfies DownloadPayload),
  );
  return `/api/assignments/files/${fileId}/download?token=${encode(`${token}.${sign(token)}`)}`;
}

export function verifySubmissionFileSignedUrl(
  token: string,
  fileId: string,
  userId: string,
): boolean {
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
      payload.fileId === fileId &&
      payload.userId === userId &&
      payload.expiresAt >= Math.floor(Date.now() / 1_000)
    );
  } catch {
    return false;
  }
}
