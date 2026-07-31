import { describe, expect, it } from "vitest";

import { createInMemoryAuditStore } from "./in-memory-store";
import { recordAudit } from "./record-audit";
import { queryAuditEvents } from "./query";

describe("queryAuditEvents", () => {
  it("filters by actor/action/resource", async () => {
    const store = createInMemoryAuditStore();
    await recordAudit(store, {
      actorUserId: "admin-1",
      action: "user.suspended",
      resourceType: "users",
      resourceId: "u1",
    });
    await recordAudit(store, {
      actorUserId: "admin-2",
      action: "user.suspended",
      resourceType: "users",
      resourceId: "u2",
    });
    await recordAudit(store, {
      actorUserId: "admin-1",
      action: "export.created",
      resourceType: "exports",
      resourceId: "e1",
    });

    const byActor = await queryAuditEvents(store, { actorUserId: "admin-1" });
    expect(byActor.items).toHaveLength(2);

    const byAction = await queryAuditEvents(store, { action: "user.suspended" });
    expect(byAction.items).toHaveLength(2);

    const byResource = await queryAuditEvents(store, { resourceType: "exports", resourceId: "e1" });
    expect(byResource.items).toHaveLength(1);
  });

  it("paginates newest-first with an opaque cursor", async () => {
    const store = createInMemoryAuditStore();
    for (let i = 0; i < 5; i += 1) {
      await recordAudit(store, {
        actorUserId: "admin-1",
        action: "note.added",
        resourceType: "matching_notes",
        resourceId: `note-${i}`,
      });
    }

    const firstPage = await queryAuditEvents(store, { resourceType: "matching_notes", limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await queryAuditEvents(store, {
      resourceType: "matching_notes",
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.items).toHaveLength(2);
    const firstIds = new Set(firstPage.items.map((event) => event.id));
    for (const event of secondPage.items) expect(firstIds.has(event.id)).toBe(false);

    const thirdPage = await queryAuditEvents(store, {
      resourceType: "matching_notes",
      limit: 2,
      cursor: secondPage.nextCursor ?? undefined,
    });
    expect(thirdPage.items).toHaveLength(1);
    expect(thirdPage.nextCursor).toBeNull();
  });
});
