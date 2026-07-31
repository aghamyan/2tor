import { createHmac, timingSafeEqual } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface CommunicationStorage {
  putPrivate(input: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    metadata: Record<string, string>;
  }): Promise<void>;
  getPrivate(
    key: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentType: string | undefined }>;
  deletePrivate(key: string): Promise<void>;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for communication storage.`);
  return value;
}

export function createS3CommunicationStorage(): CommunicationStorage {
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
      if (!response.Body || !("transformToWebStream" in response.Body)) {
        throw new Error("Private communication attachment body is unavailable.");
      }
      return {
        body: response.Body.transformToWebStream(),
        contentType: response.ContentType,
      };
    },
    async deletePrivate(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

type DownloadPayload = { attachmentId: string; userId: string; expiresAt: number };
const encode = (value: string) => Buffer.from(value).toString("base64url");
const sign = (value: string) =>
  createHmac("sha256", required("SESSION_SECRET")).update(value).digest("base64url");

export function createMessageAttachmentSignedUrl(
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
  return `/api/communication/attachments/${attachmentId}/download?token=${encode(
    `${payload}.${sign(payload)}`,
  )}`;
}

export function verifyMessageAttachmentSignedUrl(
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
    ) {
      return false;
    }
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
