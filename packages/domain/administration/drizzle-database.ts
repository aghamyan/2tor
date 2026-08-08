import {
  abuseReports,
  contentReports,
  deletionJobs,
  discounts,
  exports as exportsTable,
  incidents,
  marketingLeads,
  privacyRequests,
  roles,
  supportTickets,
  systemSettings,
  tutorContentUploads,
  tutorDocuments,
  tutorProfiles,
  tutorSuspensions,
  tutorVerifications,
  users,
  userRoles,
  type Database,
  type Transaction,
} from "@app/db";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { ulid } from "ulid";

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
} from "./models";

type Executor = Database | Transaction;

const OPEN_TICKET_STATUSES = ["open", "in_progress", "waiting_on_customer"] as const;

function mapUser(row: typeof users.$inferSelect, roleKeys: string[]): UserAccountSummary {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    status: row.status,
    roleKeys,
    createdAt: row.createdAt,
  };
}

function mapVerification(
  row: typeof tutorVerifications.$inferSelect,
  tutorUserId: string,
  tutorDisplayName: string,
): TutorVerificationSummary {
  return {
    id: row.id,
    tutorProfileId: row.tutorProfileId,
    tutorUserId,
    tutorDisplayName,
    type: row.type,
    status: row.status,
    notes: row.notes,
  };
}

function mapDocument(
  row: typeof tutorDocuments.$inferSelect,
  tutorUserId: string,
  tutorDisplayName: string,
): TutorDocumentSummary {
  return {
    id: row.id,
    tutorProfileId: row.tutorProfileId,
    tutorUserId,
    tutorDisplayName,
    type: row.type,
    status: row.status,
    fileKey: row.fileKey,
  };
}

function mapSuspension(row: typeof tutorSuspensions.$inferSelect): TutorSuspensionRecord {
  return {
    id: row.id,
    tutorProfileId: row.tutorProfileId,
    reason: row.reason,
    startAt: row.startAt,
    endAt: row.endAt,
    issuedByUserId: row.issuedByUserId,
    liftedAt: row.liftedAt,
    liftedByUserId: row.liftedByUserId,
  };
}

function mapAbuseReport(row: typeof abuseReports.$inferSelect): AbuseReportSummary {
  return {
    id: row.id,
    reportedByUserId: row.reportedByUserId,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    status: row.status,
    resolvedByUserId: row.resolvedByUserId,
    createdAt: row.createdAt,
  };
}

function mapContentReport(row: typeof contentReports.$inferSelect): ContentReportSummary {
  return {
    id: row.id,
    resourceId: row.resourceId,
    reportedByUserId: row.reportedByUserId,
    reason: row.reason,
    status: row.status,
    resolvedByUserId: row.resolvedByUserId,
    createdAt: row.createdAt,
  };
}

function mapTutorContentUpload(
  row: typeof tutorContentUploads.$inferSelect,
): TutorContentUploadSummary {
  return {
    id: row.id,
    tutorProfileId: row.tutorProfileId,
    resourceId: row.resourceId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function mapTicket(row: typeof supportTickets.$inferSelect): SupportTicketSummary {
  return {
    id: row.id,
    createdByUserId: row.createdByUserId,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    assignedToUserId: row.assignedToUserId,
    createdAt: row.createdAt,
  };
}

function mapExport(row: typeof exportsTable.$inferSelect): ExportRecord {
  return {
    id: row.id,
    requestedByUserId: row.requestedByUserId,
    type: row.type,
    filters: row.filters,
    status: row.status,
    fileKey: row.fileKey,
    expiresAt: row.expiresAt,
    approvedByUserId: row.approvedByUserId,
    createdAt: row.createdAt,
  };
}

function mapDeletionJob(row: typeof deletionJobs.$inferSelect): DeletionJobRecord {
  return {
    id: row.id,
    privacyRequestId: row.privacyRequestId,
    targetEntityType: row.targetEntityType,
    targetEntityId: row.targetEntityId,
    scope: row.scope,
    status: row.status,
    scheduledFor: row.scheduledFor,
    completedAt: row.completedAt,
    blockReason: row.blockReason,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function mapPrivacyRequest(row: typeof privacyRequests.$inferSelect): PrivacyRequestRecord {
  return {
    id: row.id,
    requestedByUserId: row.requestedByUserId,
    parentProfileId: row.parentProfileId,
    studentProfileId: row.studentProfileId,
    type: row.type,
    status: row.status,
    reason: row.reason,
    notes: row.notes,
    resolvedByUserId: row.resolvedByUserId,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

function mapDiscount(row: typeof discounts.$inferSelect): DiscountRecord {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    percentOff: row.percentOff,
    amountOffMinor: row.amountOffMinor,
    currency: row.currency,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
    createdByUserId: row.createdByUserId,
  };
}

function mapMarketingLead(row: typeof marketingLeads.$inferSelect): MarketingLeadSummary {
  return {
    id: row.id,
    kind: row.kind,
    parentName: row.parentName,
    email: row.email,
    phone: row.phone,
    learnerAgeBand: row.learnerAgeBand,
    interest: row.interest,
    message: row.message,
    locale: row.locale,
    createdAt: row.createdAt,
  };
}

function mapSetting(row: typeof systemSettings.$inferSelect): SystemSettingRecord {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description,
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): AdministrationDatabase {
  async function loadRoleKeys(userId: string): Promise<string[]> {
    const rows = await executor
      .select({ key: roles.key })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), isNull(userRoles.revokedAt)));
    return rows.map((row) => row.key);
  }

  async function loadTutorOwner(
    tutorProfileId: string,
  ): Promise<{ userId: string; displayName: string } | null> {
    const [row] = await executor
      .select({ userId: tutorProfiles.userId, displayName: tutorProfiles.publicDisplayName })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.id, tutorProfileId))
      .limit(1);
    return row ?? null;
  }

  return {
    async transaction<T>(operation: (database: AdministrationDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    // -- Users ------------------------------------------------------------------------------
    async findUserById(userId) {
      const [row] = await executor.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!row) return null;
      return mapUser(row, await loadRoleKeys(userId));
    },

    async listPendingUsers() {
      const rows = await executor
        .select()
        .from(users)
        .where(eq(users.status, "pending"))
        .orderBy(desc(users.createdAt))
        .limit(100);
      return Promise.all(rows.map(async (row) => mapUser(row, await loadRoleKeys(row.id))));
    },

    async setUserStatus(userId, status) {
      const [row] = await executor
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      if (!row) throw new Error("users update did not return a row.");
      return mapUser(row, await loadRoleKeys(userId));
    },

    // -- Roles --------------------------------------------------------------------------------
    async grantRole(userId, roleKey, grantedByUserId) {
      const [role] = await executor.select().from(roles).where(eq(roles.key, roleKey)).limit(1);
      if (!role) throw new Error(`Unknown role key: ${roleKey}`);
      const [existing] = await executor
        .select({ id: userRoles.id })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(userRoles.roleId, role.id),
            isNull(userRoles.revokedAt),
          ),
        )
        .limit(1);
      if (existing) return;
      await executor.insert(userRoles).values({
        id: ulid(),
        userId,
        roleId: role.id,
        grantedByUserId,
        grantedAt: new Date(),
      });
    },

    // -- Tutor verification / documents ------------------------------------------------------
    async listPendingTutorVerifications() {
      const rows = await executor
        .select({
          verification: tutorVerifications,
          tutorUserId: tutorProfiles.userId,
          tutorDisplayName: tutorProfiles.publicDisplayName,
        })
        .from(tutorVerifications)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorVerifications.tutorProfileId))
        .where(eq(tutorVerifications.status, "pending"))
        .orderBy(desc(tutorVerifications.createdAt))
        .limit(100);
      return rows.map((row) =>
        mapVerification(row.verification, row.tutorUserId, row.tutorDisplayName),
      );
    },

    async findTutorVerificationById(verificationId) {
      const [row] = await executor
        .select({
          verification: tutorVerifications,
          tutorUserId: tutorProfiles.userId,
          tutorDisplayName: tutorProfiles.publicDisplayName,
        })
        .from(tutorVerifications)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorVerifications.tutorProfileId))
        .where(eq(tutorVerifications.id, verificationId))
        .limit(1);
      return row ? mapVerification(row.verification, row.tutorUserId, row.tutorDisplayName) : null;
    },

    async decideTutorVerification(verificationId, values) {
      const [row] = await executor
        .update(tutorVerifications)
        .set({
          status: values.status,
          verifiedByUserId: values.verifiedByUserId,
          verifiedAt: new Date(),
          notes: values.notes,
          updatedAt: new Date(),
        })
        .where(eq(tutorVerifications.id, verificationId))
        .returning();
      if (!row) throw new Error("tutor_verifications update did not return a row.");
      const owner = await loadTutorOwner(row.tutorProfileId);
      return mapVerification(row, owner?.userId ?? "", owner?.displayName ?? "");
    },

    async listPendingTutorDocuments() {
      const rows = await executor
        .select({
          document: tutorDocuments,
          tutorUserId: tutorProfiles.userId,
          tutorDisplayName: tutorProfiles.publicDisplayName,
        })
        .from(tutorDocuments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorDocuments.tutorProfileId))
        .where(eq(tutorDocuments.status, "pending"))
        .orderBy(desc(tutorDocuments.createdAt))
        .limit(100);
      return rows.map((row) => mapDocument(row.document, row.tutorUserId, row.tutorDisplayName));
    },

    async findTutorDocumentById(documentId) {
      const [row] = await executor
        .select({
          document: tutorDocuments,
          tutorUserId: tutorProfiles.userId,
          tutorDisplayName: tutorProfiles.publicDisplayName,
        })
        .from(tutorDocuments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorDocuments.tutorProfileId))
        .where(eq(tutorDocuments.id, documentId))
        .limit(1);
      return row ? mapDocument(row.document, row.tutorUserId, row.tutorDisplayName) : null;
    },

    async decideTutorDocument(documentId, values) {
      const [row] = await executor
        .update(tutorDocuments)
        .set({
          status: values.status,
          reviewedByUserId: values.reviewedByUserId,
          reviewedAt: new Date(),
          notes: values.notes,
        })
        .where(eq(tutorDocuments.id, documentId))
        .returning();
      if (!row) throw new Error("tutor_documents update did not return a row.");
      const owner = await loadTutorOwner(row.tutorProfileId);
      return mapDocument(row, owner?.userId ?? "", owner?.displayName ?? "");
    },

    // -- Tutor suspensions --------------------------------------------------------------------
    async findTutorOwnerUserId(tutorProfileId) {
      const owner = await loadTutorOwner(tutorProfileId);
      return owner?.userId ?? null;
    },

    async listActiveTutorSuspensions() {
      const rows = await executor
        .select()
        .from(tutorSuspensions)
        .where(isNull(tutorSuspensions.liftedAt))
        .orderBy(desc(tutorSuspensions.startAt))
        .limit(100);
      return rows.map(mapSuspension);
    },

    async createTutorSuspension(values) {
      const [row] = await executor.insert(tutorSuspensions).values(values).returning();
      if (!row) throw new Error("tutor_suspensions insert did not return a row.");
      return mapSuspension(row);
    },

    async findTutorSuspensionById(suspensionId) {
      const [row] = await executor
        .select()
        .from(tutorSuspensions)
        .where(eq(tutorSuspensions.id, suspensionId))
        .limit(1);
      return row ? mapSuspension(row) : null;
    },

    async liftTutorSuspension(suspensionId, values) {
      const [row] = await executor
        .update(tutorSuspensions)
        .set({ liftedByUserId: values.liftedByUserId, liftedAt: values.liftedAt })
        .where(eq(tutorSuspensions.id, suspensionId))
        .returning();
      if (!row) throw new Error("tutor_suspensions update did not return a row.");
      return mapSuspension(row);
    },

    async setTutorProfileStatus(tutorProfileId, status) {
      await executor
        .update(tutorProfiles)
        .set({ status, updatedAt: new Date() })
        .where(eq(tutorProfiles.id, tutorProfileId));
    },

    // -- Disputes / moderation ----------------------------------------------------------------
    async listOpenAbuseReports() {
      const rows = await executor
        .select()
        .from(abuseReports)
        .where(eq(abuseReports.status, "open"))
        .orderBy(desc(abuseReports.createdAt))
        .limit(100);
      return rows.map(mapAbuseReport);
    },

    async findAbuseReportById(reportId) {
      const [row] = await executor
        .select()
        .from(abuseReports)
        .where(eq(abuseReports.id, reportId))
        .limit(1);
      return row ? mapAbuseReport(row) : null;
    },

    async decideAbuseReport(reportId, values) {
      const [row] = await executor
        .update(abuseReports)
        .set({
          status: values.status,
          resolvedByUserId: values.resolvedByUserId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(abuseReports.id, reportId))
        .returning();
      if (!row) throw new Error("abuse_reports update did not return a row.");
      return mapAbuseReport(row);
    },

    async listOpenContentReports() {
      const rows = await executor
        .select()
        .from(contentReports)
        .where(eq(contentReports.status, "open"))
        .orderBy(desc(contentReports.createdAt))
        .limit(100);
      return rows.map(mapContentReport);
    },

    async findContentReportById(reportId) {
      const [row] = await executor
        .select()
        .from(contentReports)
        .where(eq(contentReports.id, reportId))
        .limit(1);
      return row ? mapContentReport(row) : null;
    },

    async decideContentReport(reportId, values) {
      const [row] = await executor
        .update(contentReports)
        .set({
          status: values.status,
          resolvedByUserId: values.resolvedByUserId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contentReports.id, reportId))
        .returning();
      if (!row) throw new Error("content_reports update did not return a row.");
      return mapContentReport(row);
    },

    async listPendingTutorContentUploads() {
      const rows = await executor
        .select()
        .from(tutorContentUploads)
        .where(eq(tutorContentUploads.status, "pending_review"))
        .orderBy(desc(tutorContentUploads.createdAt))
        .limit(100);
      return rows.map(mapTutorContentUpload);
    },

    async findTutorContentUploadById(uploadId) {
      const [row] = await executor
        .select()
        .from(tutorContentUploads)
        .where(eq(tutorContentUploads.id, uploadId))
        .limit(1);
      return row ? mapTutorContentUpload(row) : null;
    },

    async decideTutorContentUpload(uploadId, values) {
      const [row] = await executor
        .update(tutorContentUploads)
        .set({
          status: values.status,
          reviewedByUserId: values.reviewedByUserId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tutorContentUploads.id, uploadId))
        .returning();
      if (!row) throw new Error("tutor_content_uploads update did not return a row.");
      return mapTutorContentUpload(row);
    },

    async listOpenSupportTickets() {
      const rows = await executor
        .select()
        .from(supportTickets)
        .where(inArray(supportTickets.status, [...OPEN_TICKET_STATUSES]))
        .orderBy(desc(supportTickets.createdAt))
        .limit(100);
      return rows.map(mapTicket);
    },

    async findSupportTicketById(ticketId) {
      const [row] = await executor
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketId))
        .limit(1);
      return row ? mapTicket(row) : null;
    },

    async resolveSupportTicket(ticketId, values) {
      const [row] = await executor
        .update(supportTickets)
        .set({ status: values.status, updatedAt: new Date() })
        .where(eq(supportTickets.id, ticketId))
        .returning();
      if (!row) throw new Error("support_tickets update did not return a row.");
      return mapTicket(row);
    },

    // -- Exports --------------------------------------------------------------------------------
    async createExport(values: NewExportValues) {
      const [row] = await executor.insert(exportsTable).values(values).returning();
      if (!row) throw new Error("exports insert did not return a row.");
      return mapExport(row);
    },

    async findExportById(exportId) {
      const [row] = await executor
        .select()
        .from(exportsTable)
        .where(eq(exportsTable.id, exportId))
        .limit(1);
      return row ? mapExport(row) : null;
    },

    async listExports() {
      const rows = await executor
        .select()
        .from(exportsTable)
        .orderBy(desc(exportsTable.createdAt))
        .limit(100);
      return rows.map(mapExport);
    },

    async setExportDecision(exportId, values) {
      const [row] = await executor
        .update(exportsTable)
        .set({
          status: values.status,
          approvedByUserId: values.approvedByUserId,
          fileKey: values.fileKey,
          expiresAt: values.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(exportsTable.id, exportId))
        .returning();
      if (!row) throw new Error("exports update did not return a row.");
      return mapExport(row);
    },

    // -- Deletion jobs / privacy requests -------------------------------------------------------
    async createDeletionJob(values: NewDeletionJobValues) {
      const [row] = await executor.insert(deletionJobs).values(values).returning();
      if (!row) throw new Error("deletion_jobs insert did not return a row.");
      return mapDeletionJob(row);
    },

    async findDeletionJobById(jobId) {
      const [row] = await executor
        .select()
        .from(deletionJobs)
        .where(eq(deletionJobs.id, jobId))
        .limit(1);
      return row ? mapDeletionJob(row) : null;
    },

    async listDeletionJobs() {
      const rows = await executor
        .select()
        .from(deletionJobs)
        .orderBy(desc(deletionJobs.createdAt))
        .limit(100);
      return rows.map(mapDeletionJob);
    },

    async setDeletionJobStatus(jobId, values) {
      const [row] = await executor
        .update(deletionJobs)
        .set({
          status: values.status,
          blockReason: values.blockReason,
          completedAt: values.completedAt ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(deletionJobs.id, jobId))
        .returning();
      if (!row) throw new Error("deletion_jobs update did not return a row.");
      return mapDeletionJob(row);
    },

    async listPrivacyRequests() {
      const rows = await executor
        .select()
        .from(privacyRequests)
        .orderBy(desc(privacyRequests.createdAt))
        .limit(100);
      return rows.map(mapPrivacyRequest);
    },

    async findPrivacyRequestById(requestId) {
      const [row] = await executor
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, requestId))
        .limit(1);
      return row ? mapPrivacyRequest(row) : null;
    },

    async resolvePrivacyRequest(requestId, values) {
      const [row] = await executor
        .update(privacyRequests)
        .set({
          status: values.status,
          notes: values.notes,
          resolvedByUserId: values.resolvedByUserId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(privacyRequests.id, requestId))
        .returning();
      if (!row) throw new Error("privacy_requests update did not return a row.");
      return mapPrivacyRequest(row);
    },

    // -- Discounts ------------------------------------------------------------------------------
    async listDiscounts() {
      const rows = await executor
        .select()
        .from(discounts)
        .orderBy(desc(discounts.createdAt))
        .limit(100);
      return rows.map(mapDiscount);
    },

    async createDiscount(values: NewDiscountValues) {
      const [row] = await executor.insert(discounts).values(values).returning();
      if (!row) throw new Error("discounts insert did not return a row.");
      return mapDiscount(row);
    },

    async setDiscountActive(discountId, isActive) {
      const [row] = await executor
        .update(discounts)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(discounts.id, discountId))
        .returning();
      if (!row) throw new Error("discounts update did not return a row.");
      return mapDiscount(row);
    },

    // -- System settings --------------------------------------------------------------------------
    async findSystemSetting(key) {
      const [row] = await executor
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);
      return row ? mapSetting(row) : null;
    },

    async upsertSystemSetting(values) {
      const [existing] = await executor
        .select({ id: systemSettings.id })
        .from(systemSettings)
        .where(eq(systemSettings.key, values.key))
        .limit(1);
      if (existing) {
        const [row] = await executor
          .update(systemSettings)
          .set({
            value: values.value,
            description: values.description,
            updatedByUserId: values.updatedByUserId,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.key, values.key))
          .returning();
        if (!row) throw new Error("system_settings update did not return a row.");
        return mapSetting(row);
      }
      const [row] = await executor
        .insert(systemSettings)
        .values({
          id: ulid(),
          key: values.key,
          value: values.value,
          description: values.description,
          updatedByUserId: values.updatedByUserId,
        })
        .returning();
      if (!row) throw new Error("system_settings insert did not return a row.");
      return mapSetting(row);
    },

    // -- Marketing leads --------------------------------------------------------------------
    async listMarketingLeads() {
      const rows = await executor
        .select()
        .from(marketingLeads)
        .where(gt(marketingLeads.retentionUntil, new Date()))
        .orderBy(desc(marketingLeads.createdAt))
        .limit(200);
      return rows.map(mapMarketingLead);
    },

    async createIncident(values) {
      const [row] = await executor
        .insert(incidents)
        .values({
          id: ulid(),
          title: values.title,
          description: values.description,
          severity: values.severity,
          relatedEntityType: values.relatedEntityType ?? null,
          relatedEntityId: values.relatedEntityId ?? null,
        })
        .returning({ id: incidents.id });
      if (!row) throw new Error("incidents insert did not return a row.");
      return row;
    },
  };
}

export function createDrizzleAdministrationDatabase(database: Database): AdministrationDatabase {
  return repository(database, database, false);
}
