import { describe, expect, it } from "vitest";

import { createInMemoryAuditStore } from "./in-memory-store";
import { recordAudit } from "./record-audit";
import type { AuditStore } from "./types";

describe("recordAudit", () => {
  it("writes actor/action/resource/reason/previous-value/new-value", async () => {
    const store = createInMemoryAuditStore();
    const event = await recordAudit(store, {
      actorUserId: "admin-1",
      action: "user.suspended",
      resourceType: "users",
      resourceId: "user-1",
      reason: "Repeated policy violations.",
      previousValue: { status: "active" },
      newValue: { status: "suspended" },
    });

    expect(event.id).toBeTruthy();
    expect(event.actorUserId).toBe("admin-1");
    expect(event.action).toBe("user.suspended");
    expect(event.resourceType).toBe("users");
    expect(event.resourceId).toBe("user-1");
    expect(event.reason).toBe("Repeated policy violations.");
    expect(event.previousValue).toEqual({ status: "active" });
    expect(event.newValue).toEqual({ status: "suspended" });
    expect(event.createdAt).toBeInstanceOf(Date);
  });

  it("accepts a null actor for system-triggered events", async () => {
    const store = createInMemoryAuditStore();
    const event = await recordAudit(store, {
      actorUserId: null,
      action: "retention.deletion_completed",
      resourceType: "content_bookmarks",
      resourceId: "bookmark-1",
    });
    expect(event.actorUserId).toBeNull();
  });

  it("rejects an empty action or resourceType", async () => {
    const store = createInMemoryAuditStore();
    await expect(
      recordAudit(store, { actorUserId: "admin-1", action: "", resourceType: "users" }),
    ).rejects.toThrow();
    await expect(
      recordAudit(store, { actorUserId: "admin-1", action: "x", resourceType: "" }),
    ).rejects.toThrow();
  });

  it("is append-only: two calls for the same resource produce two independent rows, never an overwrite", async () => {
    const store = createInMemoryAuditStore();
    await recordAudit(store, {
      actorUserId: "admin-1",
      action: "note.added",
      resourceType: "matching_notes",
      resourceId: "note-1",
      newValue: { text: "first" },
    });
    await recordAudit(store, {
      actorUserId: "admin-1",
      action: "note.added",
      resourceType: "matching_notes",
      resourceId: "note-1",
      newValue: { text: "second" },
    });

    const page = await store.queryEvents({ resourceType: "matching_notes", resourceId: "note-1" });
    expect(page.items).toHaveLength(2);
    expect(new Set(page.items.map((event) => event.id)).size).toBe(2);
  });

  it("exposes no way to update or delete a previously written event", () => {
    const store = createInMemoryAuditStore();
    // The append-only guarantee is structural, not a runtime flag: `AuditStore` (types.ts) has no
    // update/delete method to begin with, so there is nothing for any caller — including this
    // package's own functions — to invoke. Assert that directly against the constructed object,
    // not just the compile-time type, so a future edit that quietly adds one fails this test.
    const surface = store as unknown as Record<string, unknown>;
    expect(surface.updateEvent).toBeUndefined();
    expect(surface.deleteEvent).toBeUndefined();
    expect(surface.update).toBeUndefined();
    expect(surface.delete).toBeUndefined();
    expect(surface.remove).toBeUndefined();

    const methodNames = Object.keys({
      transaction: 1,
      insertEvent: 1,
      findEventById: 1,
      findDecisionForRequest: 1,
      queryEvents: 1,
      insertAdminAccessReason: 1,
    } satisfies Record<keyof AuditStore, unknown>);
    expect(Object.keys(surface).sort()).toEqual(methodNames.sort());
  });
});
