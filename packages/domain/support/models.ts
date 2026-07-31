export type SupportRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export type SupportCategory =
  | "account"
  | "scheduling"
  | "lesson"
  | "tutor"
  | "academic"
  | "payment"
  | "technical"
  | "privacy"
  | "safety"
  | "content";
export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SupportTicketStatus =
  "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
export type SupportUrgency = "standard" | "lesson_starting_now";
export type SensitiveSupportChange = "billing" | "parent_relationship";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";

export interface SupportActor {
  userId: string;
  roles: readonly SupportRole[];
  /** A recent step-up challenge, not merely MFA at login. */
  mfaVerifiedAt?: Date | null;
}

export interface SupportTicketRecord {
  id: string;
  createdByUserId: string;
  subject: string;
  description: string;
  category: SupportCategory;
  priority: SupportPriority;
  urgency: SupportUrgency;
  sensitiveChange: SensitiveSupportChange | null;
  status: SupportTicketStatus;
  assignedToUserId: string | null;
  /** Calculated at creation using published support hours. */
  slaTargetAt: Date;
  /** Set only after the SLA alert notifier accepted the breach. */
  slaAlertedAt: Date | null;
  incidentId: string | null;
  source: { type: string; id: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportCommentRecord {
  id: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface IncidentRecord {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reportedByUserId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentActionRecord {
  id: string;
  incidentId: string;
  actionTakenByUserId: string;
  action: string;
  notes: string | null;
  createdAt: Date;
}

export interface SupportSlaBreach {
  ticket: SupportTicketRecord;
  breachedAt: Date;
}

export interface SupportSafetyEscalation {
  ticket: SupportTicketRecord;
  incident: IncidentRecord;
}

/** Implement this in the operations/on-call module. It is intentionally fire-and-forget safe. */
export interface SupportSafetyEscalationHook {
  escalate(escalation: SupportSafetyEscalation): Promise<void>;
}

export interface SupportSlaAlertHook {
  alert(breach: SupportSlaBreach): Promise<void>;
}

export interface SupportDatabase {
  transaction<T>(operation: (database: SupportDatabase) => Promise<T>): Promise<T>;
  saveTicket(ticket: SupportTicketRecord): Promise<void>;
  getTicket(ticketId: string): Promise<SupportTicketRecord | null>;
  listTickets(input: { createdByUserId?: string; limit: number }): Promise<SupportTicketRecord[]>;
  /** Returns unresolved tickets; callers decide whether each target has passed. */
  listUnresolvedTickets(limit: number): Promise<SupportTicketRecord[]>;
  saveComment(comment: SupportCommentRecord): Promise<void>;
  listComments(ticketId: string): Promise<SupportCommentRecord[]>;
  saveIncident(incident: IncidentRecord): Promise<void>;
  getIncident(incidentId: string): Promise<IncidentRecord | null>;
  saveIncidentAction(action: IncidentActionRecord): Promise<void>;
}
