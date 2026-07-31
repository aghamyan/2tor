import {
  incidents,
  incidentActions,
  supportComments,
  supportTickets,
  type Database,
  type Transaction,
} from "@app/db";
import { asc, desc, eq, notInArray } from "drizzle-orm";
import type {
  IncidentRecord,
  SupportCommentRecord,
  SupportDatabase,
  SupportTicketRecord,
} from "./models";

type Executor = Database | Transaction;
const META_PREFIX = "[support-meta:v1]";

type StoredMetadata = Pick<
  SupportTicketRecord,
  | "category"
  | "urgency"
  | "sensitiveChange"
  | "slaTargetAt"
  | "slaAlertedAt"
  | "incidentId"
  | "source"
>;

function storedDescription(ticket: SupportTicketRecord): string {
  const metadata: StoredMetadata = {
    category: ticket.category,
    urgency: ticket.urgency,
    sensitiveChange: ticket.sensitiveChange,
    slaTargetAt: ticket.slaTargetAt,
    slaAlertedAt: ticket.slaAlertedAt,
    incidentId: ticket.incidentId,
    source: ticket.source,
  };
  return `${META_PREFIX}${JSON.stringify(metadata)}\n${ticket.description}`;
}

function readDescription(
  value: string,
  createdAt: Date,
): { description: string; metadata: StoredMetadata } {
  if (!value.startsWith(META_PREFIX))
    return {
      description: value,
      metadata: {
        category: "technical",
        urgency: "standard",
        sensitiveChange: null,
        slaTargetAt: createdAt,
        slaAlertedAt: null,
        incidentId: null,
        source: null,
      },
    };
  const newline = value.indexOf("\n");
  try {
    const raw = JSON.parse(
      value.slice(META_PREFIX.length, newline === -1 ? undefined : newline),
    ) as Partial<StoredMetadata>;
    const category = [
      "account",
      "scheduling",
      "lesson",
      "tutor",
      "academic",
      "payment",
      "technical",
      "privacy",
      "safety",
      "content",
    ].includes(raw.category ?? "")
      ? (raw.category as StoredMetadata["category"])
      : "technical";
    return {
      description: newline === -1 ? "" : value.slice(newline + 1),
      metadata: {
        category,
        urgency: raw.urgency === "lesson_starting_now" ? "lesson_starting_now" : "standard",
        sensitiveChange:
          raw.sensitiveChange === "billing" || raw.sensitiveChange === "parent_relationship"
            ? raw.sensitiveChange
            : null,
        slaTargetAt: raw.slaTargetAt ? new Date(raw.slaTargetAt) : createdAt,
        slaAlertedAt: raw.slaAlertedAt ? new Date(raw.slaAlertedAt) : null,
        incidentId: typeof raw.incidentId === "string" ? raw.incidentId : null,
        source:
          raw.source && typeof raw.source.type === "string"
            ? {
                type: raw.source.type,
                id: typeof raw.source.id === "string" ? raw.source.id : null,
              }
            : null,
      },
    };
  } catch {
    return {
      description: value,
      metadata: {
        category: "technical",
        urgency: "standard",
        sensitiveChange: null,
        slaTargetAt: createdAt,
        slaAlertedAt: null,
        incidentId: null,
        source: null,
      },
    };
  }
}

function ticketFromRow(row: typeof supportTickets.$inferSelect): SupportTicketRecord {
  const parsed = readDescription(row.description, row.createdAt);
  return {
    id: row.id,
    createdByUserId: row.createdByUserId,
    subject: row.subject,
    description: parsed.description,
    ...parsed.metadata,
    priority: row.priority,
    status: row.status,
    assignedToUserId: row.assignedToUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function commentFromRow(row: typeof supportComments.$inferSelect): SupportCommentRecord {
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorUserId: row.authorUserId,
    body: row.body,
    isInternal: row.isInternal,
    createdAt: row.createdAt,
  };
}
function incidentFromRow(row: typeof incidents.$inferSelect): IncidentRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    reportedByUserId: row.reportedByUserId,
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): SupportDatabase {
  return {
    async transaction<T>(operation: (database: SupportDatabase) => Promise<T>) {
      return insideTransaction
        ? operation(repository(executor, root, true))
        : root.transaction((tx) => operation(repository(tx, root, true)));
    },
    async saveTicket(ticket) {
      const values = {
        subject: ticket.subject,
        description: storedDescription(ticket),
        priority: ticket.priority,
        status: ticket.status,
        assignedToUserId: ticket.assignedToUserId,
        updatedAt: ticket.updatedAt,
      };
      const [existing] = await executor
        .select({ id: supportTickets.id })
        .from(supportTickets)
        .where(eq(supportTickets.id, ticket.id))
        .limit(1);
      if (existing)
        await executor.update(supportTickets).set(values).where(eq(supportTickets.id, ticket.id));
      else
        await executor.insert(supportTickets).values({
          id: ticket.id,
          createdByUserId: ticket.createdByUserId,
          ...values,
          createdAt: ticket.createdAt,
        });
    },
    async getTicket(ticketId) {
      const [row] = await executor
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketId))
        .limit(1);
      return row ? ticketFromRow(row) : null;
    },
    async listTickets(input) {
      const query = executor
        .select()
        .from(supportTickets)
        .orderBy(desc(supportTickets.createdAt))
        .limit(input.limit);
      const rows = input.createdByUserId
        ? await executor
            .select()
            .from(supportTickets)
            .where(eq(supportTickets.createdByUserId, input.createdByUserId))
            .orderBy(desc(supportTickets.createdAt))
            .limit(input.limit)
        : await query;
      return rows.map(ticketFromRow);
    },
    async listUnresolvedTickets(limit) {
      const rows = await executor
        .select()
        .from(supportTickets)
        .where(notInArray(supportTickets.status, ["resolved", "closed"]))
        .orderBy(asc(supportTickets.createdAt))
        .limit(limit);
      return rows.map(ticketFromRow);
    },
    async saveComment(comment) {
      await executor.insert(supportComments).values(comment);
    },
    async listComments(ticketId) {
      const rows = await executor
        .select()
        .from(supportComments)
        .where(eq(supportComments.ticketId, ticketId))
        .orderBy(asc(supportComments.createdAt));
      return rows.map(commentFromRow);
    },
    async saveIncident(incident) {
      const values = {
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        reportedByUserId: incident.reportedByUserId,
        relatedEntityType: incident.relatedEntityType,
        relatedEntityId: incident.relatedEntityId,
        updatedAt: incident.updatedAt,
      };
      const [existing] = await executor
        .select({ id: incidents.id })
        .from(incidents)
        .where(eq(incidents.id, incident.id))
        .limit(1);
      if (existing)
        await executor.update(incidents).set(values).where(eq(incidents.id, incident.id));
      else
        await executor
          .insert(incidents)
          .values({ id: incident.id, ...values, createdAt: incident.createdAt });
    },
    async getIncident(incidentId) {
      const [row] = await executor
        .select()
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);
      return row ? incidentFromRow(row) : null;
    },
    async saveIncidentAction(action) {
      await executor.insert(incidentActions).values({
        id: action.id,
        incidentId: action.incidentId,
        actionTakenByUserId: action.actionTakenByUserId,
        action: action.action,
        notes: action.notes,
        createdAt: action.createdAt,
      });
    },
  };
}

export function createDrizzleSupportDatabase(database: Database): SupportDatabase {
  return repository(database, database, false);
}
