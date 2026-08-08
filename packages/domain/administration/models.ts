/**
 * Deliberately duplicates `@app/auth`'s `Role` union rather than importing it — same rationale as
 * `packages/domain/consent/models.ts`'s `ConsentRole` / `packages/domain/matching/models.ts`'s
 * `MatchingRole`: keeps `services.ts` import-free of `@app/auth` so it resolves under a bare
 * `vitest run` with no dependency on `packages/domain/package.json` declaring `@app/auth` (it
 * doesn't, and this module's file scope can't add it). `runtime.ts` is the composition seam that
 * bridges a real `@app/auth` `Actor` into this shape.
 */
export type AdministrationRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface AdministrationActor {
  userId: string;
  roles: readonly AdministrationRole[];
  /** Mirrors `@app/auth`'s `Actor.mfaVerifiedAt` — services that gate on step-up read this directly. */
  mfaVerifiedAt?: Date | null;
}

// ---------------------------------------------------------------------------------------------
// Audit port — see packages/audit/README.md, "Wiring note for consumers", for why this is a
// locally-declared structural port rather than a direct `@app/audit` import in this file.
// ---------------------------------------------------------------------------------------------

export interface RecordAuditValues {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  reason?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
}

export interface RecordAdminAccessValues {
  adminUserId: string;
  targetEntityType: string;
  targetEntityId: string;
  reason: string;
  action?: string;
}

/** Mirrors `@app/audit`'s `HighRiskAction` — duplicated for the same import-boundary reason as `AdministrationRole`. */
export type HighRiskAction =
  | "bulk_export"
  | "role_elevation"
  | "audit_access"
  | "mass_deletion"
  | "large_refund"
  | "payment_config_change"
  | "disable_security_control";

export interface RequestApprovalValues {
  actorUserId: string;
  action: HighRiskAction;
  resourceType: string;
  resourceId: string;
  reason: string;
  payload?: unknown;
}

export interface ApprovalRequestResult {
  approvalRequestId: string;
  requestedAt: Date;
}

export interface ApproveHighRiskActionValues {
  approvalRequestId: string;
  approverUserId: string;
  decision: "approved" | "rejected";
  reason: string;
}

export interface ApprovalDecisionResult {
  decision: "approved" | "rejected";
  requestedByUserId: string;
  approvedByUserId: string;
  action: HighRiskAction;
  targetResourceType: string;
  targetResourceId: string;
  payload: unknown;
  decidedAt: Date;
}

export interface PendingApprovalSummary {
  approvalRequestId: string;
  requestedByUserId: string;
  action: HighRiskAction;
  targetResourceType: string;
  targetResourceId: string;
  payload: unknown;
  reason: string;
  requestedAt: Date;
}

export interface AuditQueryFilters {
  actorUserId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
}

export interface AuditEventSummary {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  previousValue: unknown;
  newValue: unknown;
  createdAt: Date;
}

export interface AuditQueryPage {
  items: AuditEventSummary[];
  nextCursor: string | null;
}

/**
 * Everything `services.ts` needs from `@app/audit`, shaped structurally so the real package
 * (`packages/audit`) satisfies this interface as-is with no adapter — see `runtime.ts`.
 */
export interface AuditPort {
  recordAudit(values: RecordAuditValues): Promise<void>;
  recordAdminAccessReason(values: RecordAdminAccessValues): Promise<void>;
  requestApproval(values: RequestApprovalValues): Promise<ApprovalRequestResult>;
  approveHighRiskAction(values: ApproveHighRiskActionValues): Promise<ApprovalDecisionResult>;
  /** The latest undecided `approval.requested` event for this resource, or `null`. */
  findPendingApproval(
    resourceType: string,
    resourceId: string,
  ): Promise<PendingApprovalSummary | null>;
  /** Every undecided request for one high-risk action kind — for approvals-inbox screens with no dedicated DB row (role elevation, security settings). */
  listPendingApprovals(action: HighRiskAction): Promise<PendingApprovalSummary[]>;
  queryEvents(filters: AuditQueryFilters): Promise<AuditQueryPage>;
}

// ---------------------------------------------------------------------------------------------
// Record shapes
// ---------------------------------------------------------------------------------------------

export type UserAccountStatus = "pending" | "active" | "suspended" | "deleted";

export interface UserAccountSummary {
  id: string;
  email: string | null;
  username: string | null;
  status: UserAccountStatus;
  roleKeys: string[];
  createdAt: Date;
}

export type TutorVerificationStatus = "pending" | "passed" | "failed" | "waived";

export interface TutorVerificationSummary {
  id: string;
  tutorProfileId: string;
  tutorUserId: string;
  tutorDisplayName: string;
  type: string;
  status: TutorVerificationStatus;
  notes: string | null;
}

export type TutorDocumentStatus = "pending" | "approved" | "rejected";

export interface TutorDocumentSummary {
  id: string;
  tutorProfileId: string;
  tutorUserId: string;
  tutorDisplayName: string;
  type: string;
  status: TutorDocumentStatus;
  fileKey: string;
}

export interface TutorSuspensionRecord {
  id: string;
  tutorProfileId: string;
  reason: string;
  startAt: Date;
  endAt: Date | null;
  issuedByUserId: string;
  liftedAt: Date | null;
  liftedByUserId: string | null;
}

export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface AbuseReportSummary {
  id: string;
  reportedByUserId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolvedByUserId: string | null;
  createdAt: Date;
}

export interface ContentReportSummary {
  id: string;
  resourceId: string | null;
  reportedByUserId: string;
  reason: string;
  status: ReportStatus;
  resolvedByUserId: string | null;
  createdAt: Date;
}

/** A tutor-uploaded file quarantined until staff clear it — see `packages/domain/content/README.md`. */
export interface TutorContentUploadSummary {
  id: string;
  tutorProfileId: string;
  resourceId: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: "pending_review" | "approved" | "rejected";
  createdAt: Date;
}

export type SupportTicketStatus =
  "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";

export interface SupportTicketSummary {
  id: string;
  createdByUserId: string;
  subject: string;
  status: SupportTicketStatus;
  priority: string;
  assignedToUserId: string | null;
  createdAt: Date;
}

export type ExportStatus = "pending" | "processing" | "completed" | "failed";

export interface ExportRecord {
  id: string;
  requestedByUserId: string;
  type: string;
  filters: unknown;
  status: ExportStatus;
  fileKey: string | null;
  expiresAt: Date | null;
  approvedByUserId: string | null;
  createdAt: Date;
}

export interface NewExportValues {
  id: string;
  requestedByUserId: string;
  type: string;
  filters: unknown;
}

export type DeletionScope = "full_erase" | "anonymize";
export type DeletionJobStatus = "scheduled" | "running" | "completed" | "failed" | "blocked";

export interface DeletionJobRecord {
  id: string;
  privacyRequestId: string | null;
  targetEntityType: string;
  targetEntityId: string;
  scope: DeletionScope;
  status: DeletionJobStatus;
  scheduledFor: Date | null;
  completedAt: Date | null;
  blockReason: string | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface NewDeletionJobValues {
  id: string;
  privacyRequestId?: string | null;
  targetEntityType: string;
  targetEntityId: string;
  scope: DeletionScope;
  status: DeletionJobStatus;
  scheduledFor?: Date | null;
  blockReason?: string | null;
  createdByUserId: string;
}

export type PrivacyRequestType = "export" | "deletion" | "correction";
export type PrivacyRequestStatus = "received" | "in_review" | "approved" | "rejected" | "completed";

export interface PrivacyRequestRecord {
  id: string;
  requestedByUserId: string;
  parentProfileId: string | null;
  studentProfileId: string | null;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  reason: string | null;
  notes: string | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

/** Mirrors `packages/db/src/schema/finance.ts`'s `discountTypeEnum`. */
export type DiscountType = "sibling" | "referral" | "promotional" | "admin_manual";

export interface DiscountRecord {
  id: string;
  code: string | null;
  type: DiscountType;
  percentOff: string | null;
  amountOffMinor: number | null;
  currency: "USD" | "AMD" | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdByUserId: string;
}

export interface NewDiscountValues {
  id: string;
  code: string | null;
  type: DiscountType;
  percentOff: string | null;
  amountOffMinor: number | null;
  currency: "USD" | "AMD" | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdByUserId: string;
}

/** Mirrors `packages/domain/marketing/models.ts`'s `LeadKind` — duplicated for the same import-boundary reason as `AdministrationRole`. */
export type MarketingLeadKind =
  | "consultation"
  | "assessment"
  | "contact"
  | "tutor_application"
  | "trial_class"
  | "group_matching";

/** A public consultation/free-class/contact submission, for the staff "requests" queue. */
export interface MarketingLeadSummary {
  id: string;
  kind: MarketingLeadKind;
  parentName: string;
  email: string;
  phone: string | null;
  learnerAgeBand: string | null;
  interest: string | null;
  message: string | null;
  locale: "en" | "hy";
  createdAt: Date;
}

export interface SystemSettingRecord {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedByUserId: string | null;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------------------------
// Database port
// ---------------------------------------------------------------------------------------------

export interface AdministrationDatabase {
  transaction<T>(operation: (database: AdministrationDatabase) => Promise<T>): Promise<T>;

  // Users
  findUserById(userId: string): Promise<UserAccountSummary | null>;
  listPendingUsers(): Promise<UserAccountSummary[]>;
  setUserStatus(userId: string, status: UserAccountStatus): Promise<UserAccountSummary>;

  // Roles
  grantRole(userId: string, roleKey: string, grantedByUserId: string): Promise<void>;

  // Tutor verification / documents / suspensions
  listPendingTutorVerifications(): Promise<TutorVerificationSummary[]>;
  findTutorVerificationById(verificationId: string): Promise<TutorVerificationSummary | null>;
  decideTutorVerification(
    verificationId: string,
    values: { status: TutorVerificationStatus; verifiedByUserId: string; notes: string | null },
  ): Promise<TutorVerificationSummary>;

  listPendingTutorDocuments(): Promise<TutorDocumentSummary[]>;
  findTutorDocumentById(documentId: string): Promise<TutorDocumentSummary | null>;
  decideTutorDocument(
    documentId: string,
    values: { status: TutorDocumentStatus; reviewedByUserId: string; notes: string | null },
  ): Promise<TutorDocumentSummary>;

  findTutorOwnerUserId(tutorProfileId: string): Promise<string | null>;
  listActiveTutorSuspensions(): Promise<TutorSuspensionRecord[]>;
  createTutorSuspension(values: {
    id: string;
    tutorProfileId: string;
    reason: string;
    startAt: Date;
    endAt: Date | null;
    issuedByUserId: string;
  }): Promise<TutorSuspensionRecord>;
  findTutorSuspensionById(suspensionId: string): Promise<TutorSuspensionRecord | null>;
  liftTutorSuspension(
    suspensionId: string,
    values: { liftedByUserId: string; liftedAt: Date },
  ): Promise<TutorSuspensionRecord>;
  setTutorProfileStatus(tutorProfileId: string, status: "active" | "suspended"): Promise<void>;

  // Disputes / moderation
  listOpenAbuseReports(): Promise<AbuseReportSummary[]>;
  findAbuseReportById(reportId: string): Promise<AbuseReportSummary | null>;
  decideAbuseReport(
    reportId: string,
    values: { status: ReportStatus; resolvedByUserId: string },
  ): Promise<AbuseReportSummary>;

  listOpenContentReports(): Promise<ContentReportSummary[]>;
  findContentReportById(reportId: string): Promise<ContentReportSummary | null>;
  decideContentReport(
    reportId: string,
    values: { status: ReportStatus; resolvedByUserId: string },
  ): Promise<ContentReportSummary>;

  listPendingTutorContentUploads(): Promise<TutorContentUploadSummary[]>;
  findTutorContentUploadById(uploadId: string): Promise<TutorContentUploadSummary | null>;
  decideTutorContentUpload(
    uploadId: string,
    values: { status: "approved" | "rejected"; reviewedByUserId: string },
  ): Promise<TutorContentUploadSummary>;

  listOpenSupportTickets(): Promise<SupportTicketSummary[]>;
  findSupportTicketById(ticketId: string): Promise<SupportTicketSummary | null>;
  resolveSupportTicket(
    ticketId: string,
    values: { status: SupportTicketStatus },
  ): Promise<SupportTicketSummary>;

  // Exports
  createExport(values: NewExportValues): Promise<ExportRecord>;
  findExportById(exportId: string): Promise<ExportRecord | null>;
  listExports(): Promise<ExportRecord[]>;
  setExportDecision(
    exportId: string,
    values: {
      status: ExportStatus;
      approvedByUserId?: string | null;
      fileKey?: string | null;
      expiresAt?: Date | null;
    },
  ): Promise<ExportRecord>;

  // Deletion jobs / privacy requests
  createDeletionJob(values: NewDeletionJobValues): Promise<DeletionJobRecord>;
  findDeletionJobById(jobId: string): Promise<DeletionJobRecord | null>;
  listDeletionJobs(): Promise<DeletionJobRecord[]>;
  setDeletionJobStatus(
    jobId: string,
    values: { status: DeletionJobStatus; blockReason: string | null; completedAt?: Date | null },
  ): Promise<DeletionJobRecord>;

  listPrivacyRequests(): Promise<PrivacyRequestRecord[]>;
  findPrivacyRequestById(requestId: string): Promise<PrivacyRequestRecord | null>;
  resolvePrivacyRequest(
    requestId: string,
    values: { status: PrivacyRequestStatus; notes: string | null; resolvedByUserId: string },
  ): Promise<PrivacyRequestRecord>;

  // Discounts
  listDiscounts(): Promise<DiscountRecord[]>;
  createDiscount(values: NewDiscountValues): Promise<DiscountRecord>;
  setDiscountActive(discountId: string, isActive: boolean): Promise<DiscountRecord>;

  // System settings (feature flags / security toggles)
  findSystemSetting(key: string): Promise<SystemSettingRecord | null>;
  upsertSystemSetting(values: {
    key: string;
    value: unknown;
    description: string | null;
    updatedByUserId: string;
  }): Promise<SystemSettingRecord>;

  // Marketing leads (consultation requests / free-class bookings / contact submissions)
  listMarketingLeads(): Promise<MarketingLeadSummary[]>;

  // Incidents (used by apps/worker/src/jobs/admin/backup-verification-alert.job.ts)
  createIncident(values: {
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
  }): Promise<{ id: string }>;
}
