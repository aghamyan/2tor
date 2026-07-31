import { ulid } from "ulid";
import { SupportError } from "./errors";
import type {
  IncidentActionInput,
  ParentOwnershipReviewInput,
  AddSupportCommentInput,
  CreateSupportTicketInput,
  UpdateSupportTicketInput,
} from "./schemas";
import {
  addSupportCommentSchema,
  createSupportTicketSchema,
  incidentActionSchema,
  parentOwnershipReviewSchema,
  updateSupportTicketSchema,
} from "./schemas";
import { calculateSlaTarget, isSlaBreached } from "./sla";
import type {
  IncidentRecord,
  SupportActor,
  SupportDatabase,
  SupportSafetyEscalationHook,
  SupportSlaAlertHook,
  SupportTicketRecord,
} from "./models";

function requireActor(actor: SupportActor | null | undefined): asserts actor is SupportActor {
  if (!actor) throw new SupportError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}
function isStaff(actor: SupportActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}
function requireStaff(actor: SupportActor): void {
  if (!isStaff(actor))
    throw new SupportError("FORBIDDEN", "Only support staff can perform this action.", 403);
}
function hasFreshStepUp(actor: SupportActor, now: Date): boolean {
  return Boolean(
    actor.mfaVerifiedAt && now.getTime() - actor.mfaVerifiedAt.getTime() <= 15 * 60_000,
  );
}
function canAccess(actor: SupportActor, ticket: SupportTicketRecord): boolean {
  return (
    isStaff(actor) ||
    ticket.createdByUserId === actor.userId ||
    ticket.assignedToUserId === actor.userId
  );
}

function effectivePriority(input: CreateSupportTicketInput): SupportTicketRecord["priority"] {
  return input.category === "safety" || input.urgency === "lesson_starting_now"
    ? "urgent"
    : input.priority;
}

export function compareSupportQueue(left: SupportTicketRecord, right: SupportTicketRecord): number {
  const safety = (ticket: SupportTicketRecord) => (ticket.category === "safety" ? 1 : 0);
  if (safety(left) !== safety(right)) return safety(right) - safety(left);
  const priority = { urgent: 3, high: 2, normal: 1, low: 0 } as const;
  if (priority[left.priority] !== priority[right.priority])
    return priority[right.priority] - priority[left.priority];
  return left.createdAt.getTime() - right.createdAt.getTime();
}

/** Creates a ticket and opens a critical incident before calling the safety escalation hook. */
export async function createSupportTicket(
  database: SupportDatabase,
  actor: SupportActor | null | undefined,
  input: CreateSupportTicketInput,
  safetyHook?: SupportSafetyEscalationHook,
): Promise<SupportTicketRecord> {
  requireActor(actor);
  const values = createSupportTicketSchema.parse(input);
  const now = new Date();
  if (values.sensitiveChange && !hasFreshStepUp(actor, now))
    throw new SupportError(
      "STEP_UP_REQUIRED",
      "Billing and parent-relationship recovery changes require recent step-up verification.",
      403,
    );
  let escalation: { ticket: SupportTicketRecord; incident: IncidentRecord } | null = null;
  const ticket = await database.transaction(async (tx) => {
    const priority = effectivePriority(values);
    const result: SupportTicketRecord = {
      id: ulid(),
      createdByUserId: actor.userId,
      subject: values.subject,
      description: values.description,
      category: values.category,
      priority,
      urgency: values.urgency,
      sensitiveChange: values.sensitiveChange,
      status: "open",
      assignedToUserId: null,
      slaTargetAt: calculateSlaTarget(now, priority),
      slaAlertedAt: null,
      incidentId: null,
      source: values.source,
      createdAt: now,
      updatedAt: now,
    };
    if (values.category === "safety") {
      const incident: IncidentRecord = {
        id: ulid(),
        title: values.subject,
        description: values.description,
        severity: "critical",
        status: "open",
        reportedByUserId: actor.userId,
        relatedEntityType: "support_ticket",
        relatedEntityId: result.id,
        createdAt: now,
        updatedAt: now,
      };
      result.incidentId = incident.id;
      await tx.saveIncident(incident);
      await tx.saveIncidentAction({
        id: ulid(),
        incidentId: incident.id,
        actionTakenByUserId: actor.userId,
        action: "Safety report received; immediate escalation initiated.",
        notes: null,
        createdAt: now,
      });
      escalation = { ticket: result, incident };
    }
    await tx.saveTicket(result);
    return result;
  });
  if (escalation && safetyHook) await safetyHook.escalate(escalation);
  return ticket;
}

/** Stable integration entrypoint for abuse reports and other safety-producing modules. */
export async function createSafetyReport(
  database: SupportDatabase,
  actor: SupportActor | null | undefined,
  input: Omit<CreateSupportTicketInput, "category" | "priority">,
  hook?: SupportSafetyEscalationHook,
) {
  return createSupportTicket(
    database,
    actor,
    { ...input, category: "safety", priority: "urgent" },
    hook,
  );
}

export async function getSupportTicket(
  database: SupportDatabase,
  actor: SupportActor | null | undefined,
  ticketId: string,
) {
  requireActor(actor);
  const ticket = await database.getTicket(ticketId);
  if (!ticket) throw new SupportError("TICKET_NOT_FOUND", "Support ticket was not found.", 404);
  if (!canAccess(actor, ticket))
    throw new SupportError("FORBIDDEN", "You cannot access this support ticket.", 403);
  const comments = await database.listComments(ticketId);
  return {
    ticket,
    comments: isStaff(actor) ? comments : comments.filter((comment) => !comment.isInternal),
  };
}

export async function listSupportTickets(
  database: SupportDatabase,
  actor: SupportActor | null | undefined,
  limit = 100,
) {
  requireActor(actor);
  const safeLimit = Math.min(Math.max(limit, 1), 250);
  const tickets = await database.listTickets({
    createdByUserId: isStaff(actor) ? undefined : actor.userId,
    limit: safeLimit,
  });
  return tickets.sort(compareSupportQueue);
}

export async function addSupportComment(
  database: SupportDatabase,
  actor: SupportActor | null | undefined,
  ticketId: string,
  input: AddSupportCommentInput,
) {
  requireActor(actor);
  const values = addSupportCommentSchema.parse(input);
  const ticket = await database.getTicket(ticketId);
  if (!ticket) throw new SupportError("TICKET_NOT_FOUND", "Support ticket was not found.", 404);
  if (!canAccess(actor, ticket))
    throw new SupportError("FORBIDDEN", "You cannot comment on this support ticket.", 403);
  if (values.isInternal && !isStaff(actor))
    throw new SupportError(
      "INTERNAL_COMMENT_FORBIDDEN",
      "Only support staff can write internal comments.",
      403,
    );
  const comment = {
    id: ulid(),
    ticketId,
    authorUserId: actor.userId,
    ...values,
    createdAt: new Date(),
  };
  await database.saveComment(comment);
  return comment;
}

export async function updateSupportTicket(
  database: SupportDatabase,
  actor: SupportActor | null | undefined,
  ticketId: string,
  input: UpdateSupportTicketInput,
) {
  requireActor(actor);
  requireStaff(actor);
  const values = updateSupportTicketSchema.parse(input);
  const ticket = await database.getTicket(ticketId);
  if (!ticket) throw new SupportError("TICKET_NOT_FOUND", "Support ticket was not found.", 404);
  const next = { ...ticket, ...values, updatedAt: new Date() };
  await database.saveTicket(next);
  return next;
}

export async function recordIncidentAction(
  database: SupportDatabase,
  actor: SupportActor | null | undefined,
  incidentId: string,
  input: IncidentActionInput,
) {
  requireActor(actor);
  requireStaff(actor);
  const values = incidentActionSchema.parse(input);
  const incident = await database.getIncident(incidentId);
  if (!incident) throw new SupportError("INCIDENT_NOT_FOUND", "Incident was not found.", 404);
  const now = new Date();
  const action = {
    id: ulid(),
    incidentId,
    actionTakenByUserId: actor.userId,
    action: values.action,
    notes: values.notes,
    createdAt: now,
  };
  await database.transaction(async (tx) => {
    await tx.saveIncidentAction(action);
    if (values.status)
      await tx.saveIncident({ ...incident, status: values.status, updatedAt: now });
  });
  return action;
}

/** A family-ownership mutation must be preceded by this immutable internal support record. */
export async function documentParentOwnershipReview(
  database: SupportDatabase,
  actor: SupportActor | null | undefined,
  ticketId: string,
  input: ParentOwnershipReviewInput,
) {
  requireActor(actor);
  requireStaff(actor);
  if (!hasFreshStepUp(actor, new Date()))
    throw new SupportError(
      "STEP_UP_REQUIRED",
      "Parent ownership review requires recent step-up verification.",
      403,
    );
  const values = parentOwnershipReviewSchema.parse(input);
  const ticket = await database.getTicket(ticketId);
  if (!ticket) throw new SupportError("TICKET_NOT_FOUND", "Support ticket was not found.", 404);
  if (ticket.sensitiveChange !== "parent_relationship")
    throw new SupportError(
      "DOCUMENTED_REVIEW_REQUIRED",
      "A parent ownership review must be attached to a parent-relationship recovery ticket.",
      409,
    );
  return addSupportComment(database, actor, ticketId, {
    body: `[parent-ownership-review] ${values.review}`,
    isInternal: true,
  });
}

/** Finds newly overdue tickets, calls the alert sink, then persists the dedupe timestamp. */
export async function alertOnSlaBreaches(
  database: SupportDatabase,
  hook: SupportSlaAlertHook,
  now = new Date(),
  limit = 250,
): Promise<number> {
  const candidates = await database.listUnresolvedTickets(Math.min(Math.max(limit, 1), 1_000));
  const breaches = candidates.filter((ticket) => isSlaBreached(ticket, now));
  for (const ticket of breaches) {
    await hook.alert({ ticket, breachedAt: now });
    await database.saveTicket({ ...ticket, slaAlertedAt: now, updatedAt: now });
  }
  return breaches.length;
}
