import type {
  AuditValues,
  ConsentDatabase,
  ConsentRecord,
  NewConsentRecordValues,
  ParentVerificationStatus,
  StudentConsentProfile,
} from "../../../../../packages/domain/consent/models";

function now(): Date {
  return new Date("2026-07-29T12:00:00.000Z");
}

export class InMemoryConsentDatabase implements ConsentDatabase {
  readonly audits: AuditValues[] = [];
  readonly consentRecords = new Map<string, ConsentRecord>();
  readonly students = new Map<string, StudentConsentProfile>();
  /** Keyed by parent `userId`. */
  readonly parentVerification = new Map<string, ParentVerificationStatus>();
  /** studentProfileId -> parent `userId`. */
  readonly primaryParentUserIds = new Map<string, string>();

  async transaction<T>(operation: (database: ConsentDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findParentVerificationStatus(userId: string) {
    return this.parentVerification.get(userId) ?? null;
  }

  async findStudentConsentProfile(studentProfileId: string) {
    return this.students.get(studentProfileId) ?? null;
  }

  async activateStudentStatus(studentProfileId: string) {
    const current = this.students.get(studentProfileId);
    if (!current) throw new Error("student missing");
    const updated: StudentConsentProfile = { ...current, status: "active" };
    this.students.set(studentProfileId, updated);
    return updated;
  }

  async hasNonRevokedConsentRecord(studentProfileId: string) {
    return [...this.consentRecords.values()].some(
      (record) => record.studentProfileId === studentProfileId && record.revokedAt === null,
    );
  }

  async listConsentRecords(studentProfileId: string) {
    return [...this.consentRecords.values()]
      .filter((record) => record.studentProfileId === studentProfileId)
      .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());
  }

  async insertConsentRecord(values: NewConsentRecordValues) {
    const record: ConsentRecord = {
      ...values,
      dataCategories: [...values.dataCategories],
      revokedAt: null,
      createdAt: now(),
    };
    this.consentRecords.set(record.id, record);
    return record;
  }

  async findPrimaryParentUserId(studentProfileId: string) {
    return this.primaryParentUserIds.get(studentProfileId) ?? null;
  }

  async appendAudit(values: AuditValues) {
    this.audits.push(values);
  }
}
