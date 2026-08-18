import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { DiscussionStorage } from "./storage";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for discussion attachment storage.`);
  return value;
}

/** Mirrors `packages/domain/communication/storage.ts`'s S3/MinIO client shape. */
export function createS3DiscussionStorage(): DiscussionStorage {
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
      // which MinIO rejects as an unsupported encryption method. See `assignments/storage.ts`.
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
        throw new Error("Private discussion attachment body is unavailable.");
      return { body: response.Body.transformToWebStream(), contentType: response.ContentType };
    },
    async deletePrivate(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
