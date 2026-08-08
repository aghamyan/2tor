export interface DiscussionStorage {
  putPrivate(input: {
    key: string;
    body: Uint8Array;
    mimeType: "image/jpeg" | "image/png" | "application/pdf";
    metadata: Record<string, string>;
  }): Promise<void>;
  getPrivate(
    key: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentType: string | undefined }>;
  deletePrivate(key: string): Promise<void>;
}
