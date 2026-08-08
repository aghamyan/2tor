import type {
  AbuseReportSummary,
  AdministrationDatabase,
  ContentReportSummary,
  DeletionJobRecord,
  DiscountRecord,
  ExportRecord,
  MarketingLeadSummary,
  NewDeletionJobValues,
  NewDiscountValues,
  NewExportValues,
  PrivacyRequestRecord,
  SupportTicketSummary,
  SystemSettingRecord,
  TutorContentUploadSummary,
  TutorDocumentSummary,
  TutorSuspensionRecord,
  TutorVerificationSummary,
  UserAccountSummary,
} from "../../../../../packages/domain/administration/models";

function now(): Date {
  return new Date("2026-07-29T12:00:00.000Z");
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * Hand-rolled `AdministrationDatabase` fake for tests — same pattern as
 * `apps/web/tests/consent/support/in-memory-consent-database.ts`: state lives in plain public
 * `Map`s tests seed directly, no real Postgres involved.
 */
export class InMemoryAdministrationDatabase implements AdministrationDatabase {
  readonly users = new Map<string, UserAccountSummary>();
  readonly userRoleKeys = new Map<string, Set<string>>();
  readonly tutorOwners = new Map<string, { userId: string; displayName: string }>();
  readonly tutorVerifications = new Map<string, TutorVerificationSummary>();
  readonly tutorDocuments = new Map<string, TutorDocumentSummary>();
  readonly tutorSuspensions = new Map<string, TutorSuspensionRecord>();
  readonly tutorProfileStatus = new Map<string, "active" | "suspended">();
  readonly abuseReports = new Map<string, AbuseReportSummary>();
  readonly contentReports = new Map<string, ContentReportSummary>();
  readonly tutorContentUploads = new Map<string, TutorContentUploadSummary>();
  readonly supportTickets = new Map<string, SupportTicketSummary>();
  readonly exports = new Map<string, ExportRecord>();
  readonly deletionJobs = new Map<string, DeletionJobRecord>();
  readonly privacyRequests = new Map<string, PrivacyRequestRecord>();
  readonly discounts = new Map<string, DiscountRecord>();
  readonly systemSettings = new Map<string, SystemSettingRecord>();
  readonly marketingLeads = new Map<string, MarketingLeadSummary>();
  readonly incidents: Array<{ id: string; title: string; severity: string }> = [];

  async transaction<T>(operation: (database: AdministrationDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async listPendingUsers() {
    return [...this.users.values()].filter((user) => user.status === "pending");
  }

  async setUserStatus(userId: string, status: UserAccountSummary["status"]) {
    const current = this.users.get(userId);
    if (!current) throw new Error("user missing");
    const updated = { ...current, status };
    this.users.set(userId, updated);
    return updated;
  }

  async grantRole(userId: string, roleKey: string, _grantedByUserId: string) {
    const keys = this.userRoleKeys.get(userId) ?? new Set<string>();
    keys.add(roleKey);
    this.userRoleKeys.set(userId, keys);
  }

  async listPendingTutorVerifications() {
    return [...this.tutorVerifications.values()].filter((v) => v.status === "pending");
  }

  async findTutorVerificationById(verificationId: string) {
    return this.tutorVerifications.get(verificationId) ?? null;
  }

  async decideTutorVerification(
    verificationId: string,
    values: {
      status: TutorVerificationSummary["status"];
      verifiedByUserId: string;
      notes: string | null;
    },
  ) {
    const current = this.tutorVerifications.get(verificationId);
    if (!current) throw new Error("verification missing");
    const updated: TutorVerificationSummary = {
      ...current,
      status: values.status,
      notes: values.notes,
    };
    this.tutorVerifications.set(verificationId, updated);
    return updated;
  }

  async listPendingTutorDocuments() {
    return [...this.tutorDocuments.values()].filter((d) => d.status === "pending");
  }

  async findTutorDocumentById(documentId: string) {
    return this.tutorDocuments.get(documentId) ?? null;
  }

  async decideTutorDocument(
    documentId: string,
    values: {
      status: TutorDocumentSummary["status"];
      reviewedByUserId: string;
      notes: string | null;
    },
  ) {
    const current = this.tutorDocuments.get(documentId);
    if (!current) throw new Error("document missing");
    const updated: TutorDocumentSummary = { ...current, status: values.status };
    this.tutorDocuments.set(documentId, updated);
    return updated;
  }

  async findTutorOwnerUserId(tutorProfileId: string) {
    return this.tutorOwners.get(tutorProfileId)?.userId ?? null;
  }

  async listActiveTutorSuspensions() {
    return [...this.tutorSuspensions.values()].filter((s) => s.liftedAt === null);
  }

  async createTutorSuspension(values: {
    id: string;
    tutorProfileId: string;
    reason: string;
    startAt: Date;
    endAt: Date | null;
    issuedByUserId: string;
  }) {
    const record: TutorSuspensionRecord = {
      id: values.id,
      tutorProfileId: values.tutorProfileId,
      reason: values.reason,
      startAt: values.startAt,
      endAt: values.endAt,
      issuedByUserId: values.issuedByUserId,
      liftedAt: null,
      liftedByUserId: null,
    };
    this.tutorSuspensions.set(record.id, record);
    return record;
  }

  async findTutorSuspensionById(suspensionId: string) {
    return this.tutorSuspensions.get(suspensionId) ?? null;
  }

  async liftTutorSuspension(
    suspensionId: string,
    values: { liftedByUserId: string; liftedAt: Date },
  ) {
    const current = this.tutorSuspensions.get(suspensionId);
    if (!current) throw new Error("suspension missing");
    const updated: TutorSuspensionRecord = {
      ...current,
      liftedAt: values.liftedAt,
      liftedByUserId: values.liftedByUserId,
    };
    this.tutorSuspensions.set(suspensionId, updated);
    return updated;
  }

  async setTutorProfileStatus(tutorProfileId: string, status: "active" | "suspended") {
    this.tutorProfileStatus.set(tutorProfileId, status);
  }

  async listOpenAbuseReports() {
    return [...this.abuseReports.values()].filter((r) => r.status === "open");
  }

  async findAbuseReportById(reportId: string) {
    return this.abuseReports.get(reportId) ?? null;
  }

  async decideAbuseReport(
    reportId: string,
    values: { status: AbuseReportSummary["status"]; resolvedByUserId: string },
  ) {
    const current = this.abuseReports.get(reportId);
    if (!current) throw new Error("report missing");
    const updated: AbuseReportSummary = {
      ...current,
      status: values.status,
      resolvedByUserId: values.resolvedByUserId,
    };
    this.abuseReports.set(reportId, updated);
    return updated;
  }

  async listOpenContentReports() {
    return [...this.contentReports.values()].filter((r) => r.status === "open");
  }

  async findContentReportById(reportId: string) {
    return this.contentReports.get(reportId) ?? null;
  }

  async decideContentReport(
    reportId: string,
    values: { status: ContentReportSummary["status"]; resolvedByUserId: string },
  ) {
    const current = this.contentReports.get(reportId);
    if (!current) throw new Error("report missing");
    const updated: ContentReportSummary = {
      ...current,
      status: values.status,
      resolvedByUserId: values.resolvedByUserId,
    };
    this.contentReports.set(reportId, updated);
    return updated;
  }

  async listPendingTutorContentUploads() {
    return [...this.tutorContentUploads.values()].filter((u) => u.status === "pending_review");
  }

  async findTutorContentUploadById(uploadId: string) {
    return this.tutorContentUploads.get(uploadId) ?? null;
  }

  async decideTutorContentUpload(
    uploadId: string,
    values: { status: "approved" | "rejected"; reviewedByUserId: string },
  ) {
    const current = this.tutorContentUploads.get(uploadId);
    if (!current) throw new Error("upload missing");
    const updated: TutorContentUploadSummary = { ...current, status: values.status };
    this.tutorContentUploads.set(uploadId, updated);
    return updated;
  }

  async listOpenSupportTickets() {
    return [...this.supportTickets.values()].filter(
      (t) => t.status !== "resolved" && t.status !== "closed",
    );
  }

  async findSupportTicketById(ticketId: string) {
    return this.supportTickets.get(ticketId) ?? null;
  }

  async resolveSupportTicket(ticketId: string, values: { status: SupportTicketSummary["status"] }) {
    const current = this.supportTickets.get(ticketId);
    if (!current) throw new Error("ticket missing");
    const updated: SupportTicketSummary = { ...current, status: values.status };
    this.supportTickets.set(ticketId, updated);
    return updated;
  }

  async createExport(values: NewExportValues) {
    const record: ExportRecord = {
      id: values.id,
      requestedByUserId: values.requestedByUserId,
      type: values.type,
      filters: values.filters,
      status: "pending",
      fileKey: null,
      expiresAt: null,
      approvedByUserId: null,
      createdAt: now(),
    };
    this.exports.set(record.id, record);
    return record;
  }

  async findExportById(exportId: string) {
    return this.exports.get(exportId) ?? null;
  }

  async listExports() {
    return [...this.exports.values()];
  }

  async setExportDecision(
    exportId: string,
    values: {
      status: ExportRecord["status"];
      approvedByUserId?: string | null;
      fileKey?: string | null;
      expiresAt?: Date | null;
    },
  ) {
    const current = this.exports.get(exportId);
    if (!current) throw new Error("export missing");
    const updated: ExportRecord = {
      ...current,
      status: values.status,
      approvedByUserId:
        values.approvedByUserId !== undefined ? values.approvedByUserId : current.approvedByUserId,
      fileKey: values.fileKey !== undefined ? values.fileKey : current.fileKey,
      expiresAt: values.expiresAt !== undefined ? values.expiresAt : current.expiresAt,
    };
    this.exports.set(exportId, updated);
    return updated;
  }

  async createDeletionJob(values: NewDeletionJobValues) {
    const record: DeletionJobRecord = {
      id: values.id,
      privacyRequestId: values.privacyRequestId ?? null,
      targetEntityType: values.targetEntityType,
      targetEntityId: values.targetEntityId,
      scope: values.scope,
      status: values.status,
      scheduledFor: values.scheduledFor ?? null,
      completedAt: null,
      blockReason: values.blockReason ?? null,
      createdByUserId: values.createdByUserId,
      createdAt: now(),
    };
    this.deletionJobs.set(record.id, record);
    return record;
  }

  async findDeletionJobById(jobId: string) {
    return this.deletionJobs.get(jobId) ?? null;
  }

  async listDeletionJobs() {
    return [...this.deletionJobs.values()];
  }

  async setDeletionJobStatus(
    jobId: string,
    values: {
      status: DeletionJobRecord["status"];
      blockReason: string | null;
      completedAt?: Date | null;
    },
  ) {
    const current = this.deletionJobs.get(jobId);
    if (!current) throw new Error("deletion job missing");
    const updated: DeletionJobRecord = {
      ...current,
      status: values.status,
      blockReason: values.blockReason,
      completedAt: values.completedAt !== undefined ? values.completedAt : current.completedAt,
    };
    this.deletionJobs.set(jobId, updated);
    return updated;
  }

  async listPrivacyRequests() {
    return [...this.privacyRequests.values()];
  }

  async findPrivacyRequestById(requestId: string) {
    return this.privacyRequests.get(requestId) ?? null;
  }

  async resolvePrivacyRequest(
    requestId: string,
    values: {
      status: PrivacyRequestRecord["status"];
      notes: string | null;
      resolvedByUserId: string;
    },
  ) {
    const current = this.privacyRequests.get(requestId);
    if (!current) throw new Error("privacy request missing");
    const updated: PrivacyRequestRecord = {
      ...current,
      status: values.status,
      notes: values.notes,
      resolvedByUserId: values.resolvedByUserId,
      resolvedAt: now(),
    };
    this.privacyRequests.set(requestId, updated);
    return updated;
  }

  async listDiscounts() {
    return [...this.discounts.values()];
  }

  async createDiscount(values: NewDiscountValues) {
    const record: DiscountRecord = {
      id: values.id,
      code: values.code,
      type: values.type,
      percentOff: values.percentOff,
      amountOffMinor: values.amountOffMinor,
      currency: values.currency,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      isActive: true,
      createdByUserId: values.createdByUserId,
    };
    this.discounts.set(record.id, record);
    return record;
  }

  async setDiscountActive(discountId: string, isActive: boolean) {
    const current = this.discounts.get(discountId);
    if (!current) throw new Error("discount missing");
    const updated: DiscountRecord = { ...current, isActive };
    this.discounts.set(discountId, updated);
    return updated;
  }

  async findSystemSetting(key: string) {
    return this.systemSettings.get(key) ?? null;
  }

  async upsertSystemSetting(values: {
    key: string;
    value: unknown;
    description: string | null;
    updatedByUserId: string;
  }) {
    const record: SystemSettingRecord = {
      id: this.systemSettings.get(values.key)?.id ?? nextId("setting"),
      key: values.key,
      value: values.value,
      description: values.description,
      updatedByUserId: values.updatedByUserId,
      updatedAt: now(),
    };
    this.systemSettings.set(values.key, record);
    return record;
  }

  async listMarketingLeads() {
    return [...this.marketingLeads.values()];
  }

  async createIncident(values: {
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
  }) {
    const id = nextId("incident");
    this.incidents.push({ id, title: values.title, severity: values.severity });
    return { id };
  }
}
