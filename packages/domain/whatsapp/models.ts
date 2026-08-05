/**
 * Deliberately duplicates `@app/auth`'s `Role` union rather than importing it, mirroring
 * `packages/domain/consent/models.ts`'s `ConsentActor` — keeps this module's public surface
 * import-free of `@app/auth` so it stays trivially unit-testable with plain object literals.
 */
export type WhatsAppRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface WhatsAppActor {
  userId: string;
  roles: readonly WhatsAppRole[];
}

/** Mirrors `packages/db/src/schema/whatsapp.ts`'s `whatsappGroupStatusEnum`. */
export type WhatsAppGroupStatus = "not_provisioned" | "active" | "disabled";
/** Mirrors `whatsappGroupMemberRoleEnum`. */
export type WhatsAppGroupMemberRole = "tutor" | "parent" | "student";
/** Mirrors `whatsappGroupMemberStatusEnum`. */
export type WhatsAppGroupMemberStatus = "invited" | "joined" | "removed";

export interface WhatsAppGroupRecord {
  id: string;
  studentProfileId: string;
  status: WhatsAppGroupStatus;
  providerGroupId: string | null;
  inviteLink: string | null;
  reminderLeadMinutes: number;
  isEnabled: boolean;
  includeChild: boolean;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppGroupMemberRecord {
  id: string;
  whatsappGroupId: string;
  userId: string;
  role: WhatsAppGroupMemberRole;
  phoneNumber: string;
  status: WhatsAppGroupMemberStatus;
  invitedAt: Date;
  joinedAt: Date | null;
  createdAt: Date;
}

export interface GroupPreferenceValues {
  isEnabled: boolean;
  reminderLeadMinutes: number;
  includeChild: boolean;
  updatedByUserId: string;
}

export interface NewGroupMemberValues {
  id: string;
  whatsappGroupId: string;
  userId: string;
  role: WhatsAppGroupMemberRole;
  phoneNumber: string;
}

/** A resolved, invitable person — always has a non-null phone; contacts without one are excluded upstream. */
export interface GroupCandidateContact {
  userId: string;
  phone: string;
  locale: "en" | "hy";
}

export interface GroupCandidates {
  student: (GroupCandidateContact & { displayName: string }) | null;
  parents: GroupCandidateContact[];
  tutors: GroupCandidateContact[];
}

export interface AuditValues {
  id: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * Structurally compatible with `@app/whatsapp`'s `WhatsAppProvider`, but declared locally rather
 * than imported — identical reasoning to `consent/models.ts`'s `ConsentNotifier`:
 * `packages/domain/package.json` does not declare `@app/whatsapp`, and a bare
 * `import ... from "@app/whatsapp"` inside `packages/domain/**` doesn't resolve under this
 * workspace's strict pnpm linking (confirmed for the identical `@app/auth`/`@app/notifications`
 * case in consent's README). The composition root (`apps/worker`'s job directory, `apps/web`'s
 * `runtime.ts`) — both of which *do* declare `@app/whatsapp` — build a small adapter satisfying
 * this shape around the real provider.
 */
export interface SendInviteLinkInput {
  phone: string;
  locale: "en" | "hy";
  inviteLink: string;
  studentDisplayName: string;
}

export interface WhatsAppSender {
  /** 1:1 invite-link delivery to a member who hasn't joined the group yet. */
  sendInviteLink(input: SendInviteLinkInput): Promise<void>;
  /** Posts a message into the group itself (used by the worker sweep jobs, not this module directly). */
  sendGroupMessage(providerGroupId: string, body: string): Promise<void>;
  createGroup(subject: string, description?: string): Promise<{ providerGroupId: string; inviteLink: string }>;
}

export interface WhatsAppDatabase {
  transaction<T>(operation: (database: WhatsAppDatabase) => Promise<T>): Promise<T>;

  findGroupByStudentId(studentProfileId: string): Promise<WhatsAppGroupRecord | null>;
  /** Creates the row (status `"not_provisioned"`) on first call for a student, updates it otherwise. */
  upsertGroupPreferences(
    studentProfileId: string,
    values: GroupPreferenceValues,
  ): Promise<WhatsAppGroupRecord>;
  /** Sets `status: "active"` and persists the provider's group id/invite link. Idempotent. */
  markGroupActive(
    studentProfileId: string,
    values: { providerGroupId: string; inviteLink: string },
  ): Promise<WhatsAppGroupRecord>;

  /** Active tutor assignment(s), linked parent(s), and (if a phone is on file) the student — see README for who's excluded and why. */
  resolveGroupCandidates(studentProfileId: string): Promise<GroupCandidates>;

  listGroupMembers(whatsappGroupId: string): Promise<WhatsAppGroupMemberRecord[]>;
  insertGroupMember(values: NewGroupMemberValues): Promise<WhatsAppGroupMemberRecord>;

  appendAudit(values: AuditValues): Promise<void>;
}
