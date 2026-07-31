import { describe, expect, it } from "vitest";

import { authorizeConversationAction } from "../../../../packages/domain/communication/authorize";
import type { ConversationMemberRecord } from "../../../../packages/domain/communication/models";
import {
  createConversation,
  deleteMessage,
  getConversationForActor,
  sendMessage,
} from "../../../../packages/domain/communication/services";
import { InMemoryCommunicationDatabase } from "./support/in-memory-communication-database";

const parent = { userId: "parent-user", roles: ["parent"] as const };
const tutor = { userId: "tutor-user", roles: ["tutor"] as const };
const staff = { userId: "admin-user", roles: ["administrator"] as const };

function databaseWithRoles() {
  const database = new InMemoryCommunicationDatabase();
  database.setRoles(parent.userId, { parent: true });
  database.setRoles(tutor.userId, { tutor: true });
  database.setRoles("student-user", { student: true });
  database.setRoles(staff.userId, { staff: true });
  return database;
}

async function createSafeConversation(database: InMemoryCommunicationDatabase) {
  return createConversation(database, parent, {
    type: "parent_tutor",
    title: "Algebra support",
    members: [
      { userId: parent.userId, role: "parent" },
      { userId: tutor.userId, role: "tutor" },
      { userId: "student-user", role: "student" },
    ],
  });
}

describe("communication safety and audit invariants", () => {
  it("rejects an adult-and-child-only conversation", async () => {
    const database = databaseWithRoles();
    await expect(
      createConversation(database, tutor, {
        type: "group_lesson",
        title: "Private tutoring",
        members: [
          { userId: tutor.userId, role: "tutor" },
          { userId: "student-user", role: "student" },
        ],
      }),
    ).rejects.toMatchObject({ code: "PARENT_REQUIRED", status: 409 });
    expect(database.conversations.size).toBe(0);
  });

  it("also rejects a parent-and-child-only conversation", async () => {
    const database = databaseWithRoles();
    await expect(
      createConversation(database, parent, {
        type: "support",
        title: "Two-person child room",
        members: [
          { userId: parent.userId, role: "parent" },
          { userId: "student-user", role: "student" },
        ],
      }),
    ).rejects.toMatchObject({ code: "PARENT_REQUIRED", status: 409 });
  });

  it("denies malformed adult-child membership in the authorization adapter too", () => {
    const now = new Date();
    const members: ConversationMemberRecord[] = [
      {
        id: "member-tutor",
        conversationId: "unsafe",
        userId: tutor.userId,
        role: "tutor",
        joinedAt: now,
        leftAt: null,
        createdAt: now,
      },
      {
        id: "member-student",
        conversationId: "unsafe",
        userId: "student-user",
        role: "student",
        joinedAt: now,
        leftAt: null,
        createdAt: now,
      },
    ];
    expect(() => authorizeConversationAction(tutor, "message.read", members)).toThrowError(
      expect.objectContaining({ code: "PARENT_REQUIRED", status: 403 }),
    );
  });

  it("does not let a caller disguise a student account as a parent", async () => {
    const database = databaseWithRoles();
    await expect(
      createConversation(database, tutor, {
        type: "parent_tutor",
        title: "Spoofed parent",
        members: [
          { userId: tutor.userId, role: "tutor" },
          { userId: "student-user", role: "parent" },
        ],
      }),
    ).rejects.toMatchObject({ code: "MEMBER_ROLE_MISMATCH" });
  });

  it("requires and writes a staff reason plus audit before messages are listed", async () => {
    const database = databaseWithRoles();
    const conversation = await createSafeConversation(database);
    await sendMessage(database, tutor, conversation.id, { body: "Practice set is attached." });

    await expect(getConversationForActor(database, staff, conversation.id)).rejects.toMatchObject({
      code: "STAFF_REASON_REQUIRED",
      status: 403,
    });
    expect(database.accessReasons).toHaveLength(0);
    expect(database.audits).toHaveLength(0);
    expect(database.events).not.toContain("messages:list");

    await expect(
      getConversationForActor(database, staff, conversation.id, {
        staffReason: "Reviewing a parent-reported safeguarding concern.",
      }),
    ).resolves.toMatchObject({ id: conversation.id });
    expect(database.accessReasons).toHaveLength(1);
    expect(database.audits).toHaveLength(1);
    expect(database.events).toEqual(["staff-reason:write", "audit:write", "messages:list"]);
  });

  it("never lets a tutor delete a message", async () => {
    const database = databaseWithRoles();
    const conversation = await createSafeConversation(database);
    const message = await sendMessage(database, tutor, conversation.id, {
      body: "This remains append-only.",
    });
    await expect(deleteMessage(database, tutor, message.id)).rejects.toMatchObject({
      code: "MESSAGE_APPEND_ONLY",
      status: 405,
    });
    expect(database.messages.get(message.id)?.body).toBe("This remains append-only.");
  });
});
