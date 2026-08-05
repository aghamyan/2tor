import { createHmac, timingSafeEqual } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface AssessmentEvidenceStorage {
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
  if (!value) throw new Error(`${name} is required for assessment evidence storage.`);
  return value;
}

/** Objects are always private; applications issue their own short-lived, user-bound download URLs. */
export function createS3AssessmentEvidenceStorage(): AssessmentEvidenceStorage {
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
      // An empty (but defined) KMS_KEY_ID must resolve to `undefined`, not `""` — the AWS SDK
      // treats a defined SSEKMSKeyId as "encrypt with aws:kms" regardless of ServerSideEncryption,
      // which local S3-compatible stores (e.g. MinIO) reject as an unsupported encryption method.
      const kmsKeyId = process.env.KMS_KEY_ID || undefined;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
          Metadata: metadata,
          ServerSideEncryption: kmsKeyId ? "aws:kms" : undefined,
          SSEKMSKeyId: kmsKeyId,
        }),
      );
    },
    async getPrivate(key) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!response.Body || !("transformToWebStream" in response.Body))
        throw new Error("Private evidence body is unavailable.");
      return { body: response.Body.transformToWebStream(), contentType: response.ContentType };
    },
  };
}

type DownloadPayload = { attemptId: string; evidenceId: string; userId: string; expiresAt: number };
function secret() {
  return required("SESSION_SECRET");
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function createAssessmentEvidenceSignedUrl(
  attemptId: string,
  evidenceId: string,
  userId: string,
  ttlSeconds = 60,
): string {
  const token = encode(
    JSON.stringify({
      attemptId,
      evidenceId,
      userId,
      expiresAt: Math.floor(Date.now() / 1_000) + ttlSeconds,
    } satisfies DownloadPayload),
  );
  return `/api/assessments/attempts/${encodeURIComponent(attemptId)}/evidence/${encodeURIComponent(evidenceId)}/download?token=${encode(`${token}.${sign(token)}`)}`;
}

export function verifyAssessmentEvidenceSignedUrl(
  token: string,
  attemptId: string,
  evidenceId: string,
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
      payload.attemptId === attemptId &&
      payload.evidenceId === evidenceId &&
      payload.userId === userId &&
      payload.expiresAt >= Math.floor(Date.now() / 1_000)
    );
  } catch {
    return false;
  }
}
