import { describe, expect, it } from "vitest";

import {
  enforceOrdinaryMessageRetention,
  ordinaryMessageRetentionCutoff,
} from "../../../../packages/domain/communication/retention";
import type { CommunicationStorage } from "../../../../packages/domain/communication/storage";
import { InMemoryCommunicationDatabase } from "./support/in-memory-communication-database";

describe("communication retention", () => {
  it("uses a UTC two-year inactivity cutoff", () => {
    expect(ordinaryMessageRetentionCutoff(new Date("2026-07-29T12:00:00.000Z"))).toEqual(
      new Date("2024-07-29T12:00:00.000Z"),
    );
  });

  it("deletes only candidates returned by the safety-aware retention query", async () => {
    const database = new InMemoryCommunicationDatabase();
    const deletedKeys: string[] = [];
    const storage: CommunicationStorage = {
      putPrivate: async () => {},
      getPrivate: async () => ({ body: new ReadableStream(), contentType: undefined }),
      deletePrivate: async (key) => {
        deletedKeys.push(key);
      },
    };
    const oldMessage = {
      id: "ordinary-old",
      conversationId: "conversation",
      senderUserId: "parent",
      body: "ordinary",
      sentAt: new Date("2020-01-01T00:00:00.000Z"),
      editedAt: null,
      isRedacted: false,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      attachments: [],
      reads: [],
    };
    await database.saveMessage(oldMessage);
    database.retentionCandidates = [
      { messageId: oldMessage.id, attachmentFileKeys: ["communication/old/file.pdf"] },
    ];

    await expect(enforceOrdinaryMessageRetention(database, storage)).resolves.toEqual({
      deletedMessages: 1,
      deletedFiles: 1,
    });
    expect(deletedKeys).toEqual(["communication/old/file.pdf"]);
    expect(database.messages.has(oldMessage.id)).toBe(false);
  });
});
