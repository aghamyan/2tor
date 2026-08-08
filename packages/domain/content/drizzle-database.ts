import {
  bookmarks,
  contentReports,
  parentProfiles,
  parentStudentLinks,
  resourceAssignments,
  resourceGradeLevels,
  resourceLinks,
  resources,
  resourceTags,
  studentProfiles,
  subjects,
  tutorContentUploads,
  tutorProfiles,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import type {
  ContentDatabase,
  ContentReportRecord,
  GuardianStudentContext,
  ResourceLinkRecord,
  ResourceRecord,
  ResourceViewer,
  TutorUploadRecord,
} from "./models";

type Executor = Database | Transaction;
const linkFromRow = (row: typeof resourceLinks.$inferSelect): ResourceLinkRecord => ({
  id: row.id,
  resourceId: row.resourceId,
  url: row.url,
  provider: row.provider,
  title: row.title,
  createdAt: row.createdAt,
});
const reportFromRow = (row: typeof contentReports.$inferSelect): ContentReportRecord => ({
  id: row.id,
  resourceId: row.resourceId,
  reportedByUserId: row.reportedByUserId,
  reason: row.reason,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const uploadFromRow = (row: typeof tutorContentUploads.$inferSelect): TutorUploadRecord => ({
  id: row.id,
  tutorProfileId: row.tutorProfileId,
  resourceId: row.resourceId,
  fileKey: row.fileKey,
  fileName: row.fileName,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  rightsConfirmedAt: row.rightsConfirmedAt,
  status: row.status,
  reviewedByUserId: row.reviewedByUserId,
  reviewedAt: row.reviewedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
/** Grade levels relevant to this viewer — the student's own grade, or the union across a parent's linked children. */
function viewerGradeLevels(viewer: ResourceViewer): string[] {
  if (viewer.scope === "student") return viewer.gradeLevel ? [viewer.gradeLevel] : [];
  if (viewer.scope === "parent")
    return [...new Set(viewer.students.map((s) => s.gradeLevel).filter((g): g is string => g !== null))];
  return [];
}
/** Student profile ids relevant to this viewer — the student themself, or a parent's linked children. */
function viewerStudentProfileIds(viewer: ResourceViewer): string[] {
  if (viewer.scope === "student") return viewer.studentProfileId ? [viewer.studentProfileId] : [];
  if (viewer.scope === "parent") return viewer.students.map((s) => s.studentProfileId);
  return [];
}
async function resourceFromRow(
  executor: Executor,
  row: typeof resources.$inferSelect,
): Promise<ResourceRecord> {
  const [links, tags, gradeLevelRows, approvedUploads] = await Promise.all([
    executor
      .select()
      .from(resourceLinks)
      .where(eq(resourceLinks.resourceId, row.id))
      .orderBy(asc(resourceLinks.createdAt)),
    executor
      .select({ tag: resourceTags.tag })
      .from(resourceTags)
      .where(eq(resourceTags.resourceId, row.id))
      .orderBy(asc(resourceTags.tag)),
    executor
      .select({ gradeLevel: resourceGradeLevels.gradeLevel })
      .from(resourceGradeLevels)
      .where(eq(resourceGradeLevels.resourceId, row.id))
      .orderBy(asc(resourceGradeLevels.gradeLevel)),
    executor
      .select()
      .from(tutorContentUploads)
      .where(and(eq(tutorContentUploads.resourceId, row.id), eq(tutorContentUploads.status, "approved")))
      .orderBy(desc(tutorContentUploads.updatedAt))
      .limit(1),
  ]);
  const upload = approvedUploads[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subjectId: row.subjectId,
    type: row.type,
    createdByUserId: row.createdByUserId,
    ownership: row.ownership,
    status: row.status,
    visibility: row.visibility,
    gradeLevels: gradeLevelRows.map((entry) => entry.gradeLevel),
    links: links.map(linkFromRow),
    tags: tags.map((tag) => tag.tag),
    file: upload
      ? {
          id: upload.id,
          fileName: upload.fileName ?? "file",
          mimeType: upload.mimeType ?? "application/octet-stream",
          sizeBytes: upload.sizeBytes ?? 0,
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): ContentDatabase {
  return {
    async transaction<T>(operation: (database: ContentDatabase) => Promise<T>) {
      return insideTransaction
        ? operation(repository(executor, root, true))
        : root.transaction((tx) => operation(repository(tx, root, true)));
    },
    async saveResource(resource) {
      await executor.insert(resources).values({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        subjectId: resource.subjectId,
        type: resource.type,
        createdByUserId: resource.createdByUserId,
        ownership: resource.ownership,
        status: resource.status,
        visibility: resource.visibility,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      });
      if (resource.links.length)
        await executor.insert(resourceLinks).values(
          resource.links.map((link) => ({
            id: link.id,
            resourceId: link.resourceId,
            url: link.url,
            provider: link.provider,
            title: link.title,
            createdAt: link.createdAt,
          })),
        );
      if (resource.tags.length)
        await executor.insert(resourceTags).values(
          resource.tags.map((tag) => ({
            id: crypto.randomUUID(),
            resourceId: resource.id,
            tag,
            createdAt: resource.createdAt,
          })),
        );
      if (resource.gradeLevels.length)
        await executor.insert(resourceGradeLevels).values(
          resource.gradeLevels.map((gradeLevel) => ({
            id: crypto.randomUUID(),
            resourceId: resource.id,
            gradeLevel,
            createdAt: resource.createdAt,
          })),
        );
    },
    async getResource(resourceId) {
      const [row] = await executor
        .select()
        .from(resources)
        .where(eq(resources.id, resourceId))
        .limit(1);
      return row ? resourceFromRow(executor, row) : null;
    },
    async isResourceVisibleToViewer(resourceId, viewer) {
      const [row] = await executor
        .select({ visibility: resources.visibility, status: resources.status })
        .from(resources)
        .where(eq(resources.id, resourceId))
        .limit(1);
      if (!row || row.status !== "published") return false;
      if (viewer.scope === "all" || row.visibility === "everyone") return true;
      if (row.visibility === "grades") {
        const gradeLevels = viewerGradeLevels(viewer);
        if (!gradeLevels.length) return false;
        const [match] = await executor
          .select({ id: resourceGradeLevels.id })
          .from(resourceGradeLevels)
          .where(
            and(
              eq(resourceGradeLevels.resourceId, resourceId),
              inArray(resourceGradeLevels.gradeLevel, gradeLevels),
            ),
          )
          .limit(1);
        return Boolean(match);
      }
      const studentProfileIds = viewerStudentProfileIds(viewer);
      if (!studentProfileIds.length) return false;
      const [match] = await executor
        .select({ id: resourceAssignments.id })
        .from(resourceAssignments)
        .where(
          and(
            eq(resourceAssignments.resourceId, resourceId),
            inArray(resourceAssignments.studentProfileId, studentProfileIds),
          ),
        )
        .limit(1);
      return Boolean(match);
    },
    async listPublishedResources(filters) {
      const conditions = filters.includeDraftsByUserId
        ? [
            or(
              eq(resources.status, "published"),
              and(
                eq(resources.status, "draft"),
                eq(resources.createdByUserId, filters.includeDraftsByUserId),
              ),
            ),
          ]
        : [eq(resources.status, "published")];
      if (filters.subjectId) conditions.push(eq(resources.subjectId, filters.subjectId));
      if (filters.tag) {
        const tagged = await executor
          .select({ resourceId: resourceTags.resourceId })
          .from(resourceTags)
          .where(eq(resourceTags.tag, filters.tag.toLocaleLowerCase()));
        if (!tagged.length) return [];
        conditions.push(
          inArray(
            resources.id,
            tagged.map((entry) => entry.resourceId),
          ),
        );
      }
      if (filters.viewer.scope !== "all") {
        const visibilityConditions = [eq(resources.visibility, "everyone")];
        const gradeLevels = viewerGradeLevels(filters.viewer);
        if (gradeLevels.length) {
          const gradeMatches = await executor
            .select({ resourceId: resourceGradeLevels.resourceId })
            .from(resourceGradeLevels)
            .where(inArray(resourceGradeLevels.gradeLevel, gradeLevels));
          const gradeCondition =
            gradeMatches.length &&
            and(
              eq(resources.visibility, "grades"),
              inArray(
                resources.id,
                gradeMatches.map((entry) => entry.resourceId),
              ),
            );
          if (gradeCondition) visibilityConditions.push(gradeCondition);
        }
        const studentProfileIds = viewerStudentProfileIds(filters.viewer);
        if (studentProfileIds.length) {
          const studentMatches = await executor
            .select({ resourceId: resourceAssignments.resourceId })
            .from(resourceAssignments)
            .where(inArray(resourceAssignments.studentProfileId, studentProfileIds));
          const studentCondition =
            studentMatches.length &&
            and(
              eq(resources.visibility, "students"),
              inArray(
                resources.id,
                studentMatches.map((entry) => entry.resourceId),
              ),
            );
          if (studentCondition) visibilityConditions.push(studentCondition);
        }
        const visibilityCondition = or(...visibilityConditions);
        if (visibilityCondition) conditions.push(visibilityCondition);
      }
      const rows = await executor
        .select()
        .from(resources)
        .where(and(...conditions))
        .orderBy(desc(resources.createdAt));
      return Promise.all(rows.map((row) => resourceFromRow(executor, row)));
    },
    async addBookmark(studentProfileId, resourceId) {
      await executor
        .insert(bookmarks)
        .values({ id: crypto.randomUUID(), studentProfileId, resourceId })
        .onConflictDoNothing();
    },
    async removeBookmark(studentProfileId, resourceId) {
      await executor
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.studentProfileId, studentProfileId),
            eq(bookmarks.resourceId, resourceId),
          ),
        );
    },
    async hasBookmark(studentProfileId, resourceId) {
      const [row] = await executor
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.studentProfileId, studentProfileId),
            eq(bookmarks.resourceId, resourceId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async listBookmarkedResourceIds(studentProfileId) {
      const rows = await executor
        .select({ resourceId: bookmarks.resourceId })
        .from(bookmarks)
        .where(eq(bookmarks.studentProfileId, studentProfileId));
      return rows.map((row) => row.resourceId);
    },
    async saveAssignment(assignment) {
      await executor.insert(resourceAssignments).values(assignment);
    },
    async saveTutorUpload(upload) {
      await executor.insert(tutorContentUploads).values({
        id: upload.id,
        tutorProfileId: upload.tutorProfileId,
        resourceId: upload.resourceId,
        fileKey: upload.fileKey,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        rightsConfirmedAt: upload.rightsConfirmedAt,
        status: upload.status,
        reviewedByUserId: upload.reviewedByUserId,
        reviewedAt: upload.reviewedAt,
        createdAt: upload.createdAt,
        updatedAt: upload.updatedAt,
      });
    },
    async getTutorUpload(uploadId) {
      const [row] = await executor
        .select()
        .from(tutorContentUploads)
        .where(eq(tutorContentUploads.id, uploadId))
        .limit(1);
      return row ? uploadFromRow(row) : null;
    },
    async listPendingTutorUploads(limit) {
      const rows = await executor
        .select()
        .from(tutorContentUploads)
        .where(eq(tutorContentUploads.status, "pending_review"))
        .orderBy(asc(tutorContentUploads.createdAt))
        .limit(limit);
      return rows.map(uploadFromRow);
    },
    async reviewTutorUpload(uploadId, decision) {
      await executor
        .update(tutorContentUploads)
        .set({
          status: decision.status,
          reviewedByUserId: decision.reviewedByUserId,
          reviewedAt: decision.reviewedAt,
          updatedAt: decision.reviewedAt,
        })
        .where(eq(tutorContentUploads.id, uploadId));
    },
    async findTutorProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: tutorProfiles.id })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },
    async findStudentProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },
    async getStudentGradeLevel(studentProfileId) {
      const [row] = await executor
        .select({ gradeLevel: studentProfiles.gradeLevel })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId))
        .limit(1);
      return row?.gradeLevel ?? null;
    },
    async findGuardianStudentContexts(userId): Promise<GuardianStudentContext[]> {
      const rows = await executor
        .select({
          studentProfileId: parentStudentLinks.studentProfileId,
          gradeLevel: studentProfiles.gradeLevel,
        })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .innerJoin(studentProfiles, eq(studentProfiles.id, parentStudentLinks.studentProfileId))
        .where(eq(parentProfiles.userId, userId));
      return rows;
    },
    async saveReport(report) {
      await executor.insert(contentReports).values(report);
    },
    async listOpenReports(limit) {
      const rows = await executor
        .select()
        .from(contentReports)
        .where(inArray(contentReports.status, ["open", "reviewing"]))
        .orderBy(asc(contentReports.createdAt))
        .limit(limit);
      return rows.map(reportFromRow);
    },
    async deleteLink(linkId) {
      await executor.delete(resourceLinks).where(eq(resourceLinks.id, linkId));
    },
    async listLinksForHealthCheck(limit) {
      const rows = await executor
        .select()
        .from(resourceLinks)
        .orderBy(asc(resourceLinks.createdAt))
        .limit(limit);
      return rows.map(linkFromRow);
    },
    async listActiveSubjects() {
      return executor
        .select({ id: subjects.id, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.isActive, true))
        .orderBy(asc(subjects.name));
    },
  };
}
export function createDrizzleContentDatabase(database: Database): ContentDatabase {
  return repository(database, database, false);
}
