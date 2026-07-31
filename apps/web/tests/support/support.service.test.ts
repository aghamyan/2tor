import { describe, expect, it, vi } from "vitest";
import type {
  IncidentActionRecord,
  IncidentRecord,
  SupportCommentRecord,
  SupportDatabase,
  SupportTicketRecord,
} from "../../../../packages/domain/support/models";
import {
  alertOnSlaBreaches,
  compareSupportQueue,
  createSupportTicket,
} from "../../../../packages/domain/support/services";

class MemorySupportDatabase implements SupportDatabase {
  tickets = new Map<string, SupportTicketRecord>();
  comments: SupportCommentRecord[] = [];
  incidents = new Map<string, IncidentRecord>();
  actions: IncidentActionRecord[] = [];
  async transaction<T>(operation: (database: SupportDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async saveTicket(ticket: SupportTicketRecord) {
    this.tickets.set(ticket.id, ticket);
  }
  async getTicket(id: string) {
    return this.tickets.get(id) ?? null;
  }
  async listTickets(input: { createdByUserId?: string; limit: number }) {
    return [...this.tickets.values()]
      .filter(
        (ticket) => !input.createdByUserId || ticket.createdByUserId === input.createdByUserId,
      )
      .slice(0, input.limit);
  }
  async listUnresolvedTickets(limit: number) {
    return [...this.tickets.values()]
      .filter((ticket) => !["resolved", "closed"].includes(ticket.status))
      .slice(0, limit);
  }
  async saveComment(comment: SupportCommentRecord) {
    this.comments.push(comment);
  }
  async listComments(ticketId: string) {
    return this.comments.filter((comment) => comment.ticketId === ticketId);
  }
  async saveIncident(incident: IncidentRecord) {
    this.incidents.set(incident.id, incident);
  }
  async getIncident(id: string) {
    return this.incidents.get(id) ?? null;
  }
  async saveIncidentAction(action: IncidentActionRecord) {
    this.actions.push(action);
  }
}

const reporter = { userId: "parent-1", roles: ["parent"] as const };

describe("support safety priority and SLA alerts", () => {
  it("ranks a safety report above an older urgent non-safety ticket", async () => {
    const database = new MemorySupportDatabase();
    const urgent = await createSupportTicket(database, reporter, {
      subject: "Lesson is starting",
      description: "Tutor link is unavailable.",
      category: "lesson",
      priority: "urgent",
      urgency: "lesson_starting_now",
      sensitiveChange: null,
      source: null,
    });
    const escalate = vi.fn(async () => undefined);
    const safety = await createSupportTicket(
      database,
      reporter,
      {
        subject: "Safeguarding concern",
        description: "Please review this report.",
        category: "safety",
        priority: "normal",
        urgency: "standard",
        sensitiveChange: null,
        source: null,
      },
      { escalate },
    );
    expect([urgent, safety].sort(compareSupportQueue).map((ticket) => ticket.id)).toEqual([
      safety.id,
      urgent.id,
    ]);
    expect(safety.priority).toBe("urgent");
    expect(database.incidents.get(safety.incidentId ?? "")?.severity).toBe("critical");
    expect(escalate).toHaveBeenCalledWith(
      expect.objectContaining({ ticket: expect.objectContaining({ id: safety.id }) }),
    );
  });

  it("fires one SLA alert and persists its dedupe marker", async () => {
    const database = new MemorySupportDatabase();
    const ticket = await createSupportTicket(database, reporter, {
      subject: "Login help",
      description: "I cannot sign in.",
      category: "account",
      priority: "normal",
      urgency: "standard",
      sensitiveChange: null,
      source: null,
    });
    const overdue = { ...ticket, slaTargetAt: new Date("2026-01-01T09:00:00.000Z") };
    await database.saveTicket(overdue);
    const alert = vi.fn(async () => undefined);
    expect(
      await alertOnSlaBreaches(database, { alert }, new Date("2026-01-02T09:00:00.000Z")),
    ).toBe(1);
    expect(alert).toHaveBeenCalledWith(
      expect.objectContaining({ ticket: expect.objectContaining({ id: ticket.id }) }),
    );
    expect((await database.getTicket(ticket.id))?.slaAlertedAt).not.toBeNull();
    expect(
      await alertOnSlaBreaches(database, { alert }, new Date("2026-01-02T10:00:00.000Z")),
    ).toBe(0);
  });

  it("requires fresh step-up verification for sensitive account recovery", async () => {
    const database = new MemorySupportDatabase();
    await expect(
      createSupportTicket(database, reporter, {
        subject: "Update billing owner",
        description: "I need to recover access to billing.",
        category: "account",
        priority: "normal",
        urgency: "standard",
        sensitiveChange: "billing",
        source: null,
      }),
    ).rejects.toMatchObject({ code: "STEP_UP_REQUIRED", status: 403 });
    await expect(
      createSupportTicket(
        database,
        { ...reporter, mfaVerifiedAt: new Date() },
        {
          subject: "Update billing owner",
          description: "I need to recover access to billing.",
          category: "account",
          priority: "normal",
          urgency: "standard",
          sensitiveChange: "billing",
          source: null,
        },
      ),
    ).resolves.toMatchObject({ sensitiveChange: "billing" });
  });
});
