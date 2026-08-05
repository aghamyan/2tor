import type {
  AuditValues,
  GroupCandidates,
  GroupPreferenceValues,
  NewGroupMemberValues,
  WhatsAppDatabase,
  WhatsAppGroupMemberRecord,
  WhatsAppGroupRecord,
} from "../../../../../packages/domain/whatsapp/models";

function now(): Date {
  return new Date("2026-07-29T12:00:00.000Z");
}

/**
 * `resolveGroupCandidates` is set directly per test (via `.candidatesByStudentId`) rather than
 * derived from linked-parent/tutor-assignment state, the same simplification
 * `apps/web/tests/families/support/in-memory-family-database.ts` doesn't need to make (families
 * owns that state) but this fake does — `packages/domain/whatsapp/drizzle-database.ts`'s real
 * cross-table joins (tutor assignments, parent links, phone numbers) aren't re-derived here; only
 * `services.ts`'s logic is under test.
 */
export class InMemoryWhatsAppDatabase implements WhatsAppDatabase {
  readonly audits: AuditValues[] = [];
  readonly groups = new Map<string, WhatsAppGroupRecord>();
  readonly members = new Map<string, WhatsAppGroupMemberRecord>();
  readonly candidatesByStudentId = new Map<string, GroupCandidates>();
  private sequence = 0;

  async transaction<T>(operation: (database: WhatsAppDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findGroupByStudentId(studentProfileId: string) {
    return (
      [...this.groups.values()].find((group) => group.studentProfileId === studentProfileId) ??
      null
    );
  }

  async upsertGroupPreferences(studentProfileId: string, values: GroupPreferenceValues) {
    const existing = await this.findGroupByStudentId(studentProfileId);
    if (existing) {
      const updated: WhatsAppGroupRecord = { ...existing, ...values, updatedAt: now() };
      this.groups.set(existing.id, updated);
      return updated;
    }
    const record: WhatsAppGroupRecord = {
      id: `group_${++this.sequence}`,
      studentProfileId,
      status: "not_provisioned",
      providerGroupId: null,
      inviteLink: null,
      ...values,
      createdAt: now(),
      updatedAt: now(),
    };
    this.groups.set(record.id, record);
    return record;
  }

  async markGroupActive(
    studentProfileId: string,
    values: { providerGroupId: string; inviteLink: string },
  ) {
    const existing = await this.findGroupByStudentId(studentProfileId);
    if (!existing) throw new Error("group missing");
    const updated: WhatsAppGroupRecord = {
      ...existing,
      status: "active",
      ...values,
      updatedAt: now(),
    };
    this.groups.set(existing.id, updated);
    return updated;
  }

  async resolveGroupCandidates(studentProfileId: string): Promise<GroupCandidates> {
    return this.candidatesByStudentId.get(studentProfileId) ?? { student: null, parents: [], tutors: [] };
  }

  async listGroupMembers(whatsappGroupId: string) {
    return [...this.members.values()].filter(
      (member) => member.whatsappGroupId === whatsappGroupId,
    );
  }

  async insertGroupMember(values: NewGroupMemberValues) {
    const record: WhatsAppGroupMemberRecord = {
      ...values,
      status: "invited",
      invitedAt: now(),
      joinedAt: null,
      createdAt: now(),
    };
    this.members.set(record.id, record);
    return record;
  }

  async appendAudit(values: AuditValues) {
    this.audits.push(values);
  }
}
