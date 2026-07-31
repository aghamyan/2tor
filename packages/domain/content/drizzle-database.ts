import {
  bookmarks,
  contentReports,
  resourceAssignments,
  resourceLinks,
  resources,
  resourceTags,
  studentProfiles,
  tutorContentUploads,
  tutorProfiles,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
  ContentDatabase,
  ContentReportRecord,
  ResourceLinkRecord,
  ResourceRecord,
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
async function resourceFromRow(
  executor: Executor,
  row: typeof resources.$inferSelect,
): Promise<ResourceRecord> {
  const [links, tags] = await Promise.all([
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
  ]);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subjectId: row.subjectId,
    type: row.type,
    createdByUserId: row.createdByUserId,
    ownership: row.ownership,
    status: row.status,
    links: links.map(linkFromRow),
    tags: tags.map((tag) => tag.tag),
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
    },
    async getResource(resourceId) {
      const [row] = await executor
        .select()
        .from(resources)
        .where(eq(resources.id, resourceId))
        .limit(1);
      return row ? resourceFromRow(executor, row) : null;
    },
    async listPublishedResources(filters) {
      const conditions = [eq(resources.status, "published")];
      if (filters?.subjectId) conditions.push(eq(resources.subjectId, filters.subjectId));
      if (filters?.tag) {
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
    async saveAssignment(assignment) {
      await executor.insert(resourceAssignments).values(assignment);
    },
    async saveTutorUpload(upload) {
      await executor.insert(tutorContentUploads).values({
        id: upload.id,
        tutorProfileId: upload.tutorProfileId,
        resourceId: upload.resourceId,
        fileKey: upload.fileKey,
        rightsConfirmedAt: upload.rightsConfirmedAt,
        status: upload.status,
        createdAt: upload.createdAt,
        updatedAt: upload.updatedAt,
      });
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
  };
}
export function createDrizzleContentDatabase(database: Database): ContentDatabase {
  return repository(database, database, false);
}
