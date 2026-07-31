import {
  parentProfiles,
  parentStudentLinks,
  portfolioItems,
  portfolioSharingConsents,
  projectFiles,
  projectMembers,
  projectRubrics,
  projects,
  projectUpdates,
  rubrics,
  studentProfiles,
  tutorProfiles,
  tutorStudentAssignments,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { ulid } from "ulid";
import type {
  PortfolioItemRecord,
  ProjectDatabase,
  ProjectFileRecord,
  ProjectMemberRecord,
  ProjectRecord,
  ProjectRubricRecord,
  ProjectUpdateRecord,
} from "./models";

type Executor = Database | Transaction;

const memberFromRow = (row: typeof projectMembers.$inferSelect): ProjectMemberRecord => ({
  id: row.id,
  projectId: row.projectId,
  studentProfileId: row.studentProfileId,
  roleLabel: row.roleLabel,
  joinedAt: row.joinedAt,
  createdAt: row.createdAt,
});
const updateFromRow = (row: typeof projectUpdates.$inferSelect): ProjectUpdateRecord => ({
  id: row.id,
  projectId: row.projectId,
  authorUserId: row.authorUserId,
  note: row.note,
  progressPercentage: row.progressPercentage,
  createdAt: row.createdAt,
});
const fileFromRow = (row: typeof projectFiles.$inferSelect): ProjectFileRecord => ({
  id: row.id,
  projectId: row.projectId,
  uploadedByUserId: row.uploadedByUserId,
  fileKey: row.fileKey,
  fileName: row.fileName,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  virusScanStatus: row.virusScanStatus,
  createdAt: row.createdAt,
});
const rubricFromRow = (row: typeof rubrics.$inferSelect): ProjectRubricRecord => ({
  id: row.id,
  title: row.title,
  description: row.description,
  createdByUserId: row.createdByUserId,
  subjectId: row.subjectId,
  scope: "project",
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const itemFromRow = (row: typeof portfolioItems.$inferSelect): PortfolioItemRecord => ({
  id: row.id,
  studentProfileId: row.studentProfileId,
  projectId: row.projectId,
  title: row.title,
  description: row.description,
  fileKey: row.fileKey,
  linkUrl: row.linkUrl,
  visibility: row.visibility,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): ProjectDatabase {
  return {
    async transaction<T>(operation: (database: ProjectDatabase) => Promise<T>) {
      return insideTransaction
        ? operation(repository(executor, root, true))
        : root.transaction((tx) => operation(repository(tx, root, true)));
    },
    async saveProject(project) {
      await executor.insert(projects).values({
        id: project.id,
        courseId: project.courseId,
        subjectId: project.subjectId,
        title: project.title,
        description: project.description,
        isGroup: project.isGroup,
        status: project.status,
        startDate: project.startDate,
        dueDate: project.dueDate,
        createdByUserId: project.createdByUserId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });
      await executor.insert(projectMembers).values(
        project.members.map((member) => ({
          id: member.id,
          projectId: project.id,
          studentProfileId: member.studentProfileId,
          roleLabel: member.roleLabel,
          joinedAt: member.joinedAt,
          createdAt: member.createdAt,
        })),
      );
    },
    async getProject(projectId) {
      const [row] = await executor
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!row) return null;
      const [members, updates, files, links] = await Promise.all([
        executor
          .select()
          .from(projectMembers)
          .where(eq(projectMembers.projectId, projectId))
          .orderBy(asc(projectMembers.joinedAt)),
        executor
          .select()
          .from(projectUpdates)
          .where(eq(projectUpdates.projectId, projectId))
          .orderBy(asc(projectUpdates.createdAt)),
        executor
          .select()
          .from(projectFiles)
          .where(eq(projectFiles.projectId, projectId))
          .orderBy(asc(projectFiles.createdAt)),
        executor
          .select({ rubricId: projectRubrics.rubricId })
          .from(projectRubrics)
          .where(eq(projectRubrics.projectId, projectId)),
      ]);
      const rubricIds = links.map((link) => link.rubricId);
      const rubricRows = rubricIds.length
        ? await executor.select().from(rubrics).where(inArray(rubrics.id, rubricIds))
        : [];
      return {
        id: row.id,
        courseId: row.courseId,
        subjectId: row.subjectId,
        title: row.title,
        description: row.description,
        isGroup: row.isGroup,
        status: row.status,
        startDate: row.startDate,
        dueDate: row.dueDate,
        createdByUserId: row.createdByUserId,
        members: members.map(memberFromRow),
        updates: updates.map(updateFromRow),
        files: files.map(fileFromRow),
        rubrics: rubricRows.filter((rubric) => rubric.scope === "project").map(rubricFromRow),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies ProjectRecord;
    },
    async addProjectMember(member) {
      await executor.insert(projectMembers).values(member);
    },
    async addProjectUpdate(update) {
      await executor.insert(projectUpdates).values(update);
    },
    async saveProjectFile(file) {
      await executor.insert(projectFiles).values(file);
    },
    async getProjectFile(fileId) {
      const [row] = await executor
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.id, fileId))
        .limit(1);
      return row ? fileFromRow(row) : null;
    },
    async updateProjectFileScanStatus(fileId, status) {
      await executor
        .update(projectFiles)
        .set({ virusScanStatus: status })
        .where(eq(projectFiles.id, fileId));
    },
    async saveProjectRubric(rubric) {
      await executor.insert(rubrics).values(rubric);
    },
    async getProjectRubric(rubricId) {
      const [row] = await executor
        .select()
        .from(rubrics)
        .where(and(eq(rubrics.id, rubricId), eq(rubrics.scope, "project")))
        .limit(1);
      return row ? rubricFromRow(row) : null;
    },
    async attachRubric(projectId, rubricId) {
      await executor.insert(projectRubrics).values({ id: ulid(), projectId, rubricId });
    },
    async savePortfolioItem(item) {
      await executor.insert(portfolioItems).values(item);
    },
    async getPortfolioItem(portfolioItemId) {
      const [row] = await executor
        .select()
        .from(portfolioItems)
        .where(eq(portfolioItems.id, portfolioItemId))
        .limit(1);
      return row ? itemFromRow(row) : null;
    },
    async updatePortfolioVisibility(portfolioItemId, visibility) {
      await executor
        .update(portfolioItems)
        .set({ visibility, updatedAt: new Date() })
        .where(eq(portfolioItems.id, portfolioItemId));
    },
    async savePortfolioSharingConsent(consent) {
      await executor.insert(portfolioSharingConsents).values(consent);
    },
    async hasActivePortfolioSharingConsent(portfolioItemId) {
      const [row] = await executor
        .select({ id: portfolioSharingConsents.id })
        .from(portfolioSharingConsents)
        .where(
          and(
            eq(portfolioSharingConsents.portfolioItemId, portfolioItemId),
            isNull(portfolioSharingConsents.revokedAt),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async findStudentProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },
    async isTutorAssignedToStudent(tutorUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: tutorStudentAssignments.id })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .where(
          and(
            eq(tutorProfiles.userId, tutorUserId),
            eq(tutorStudentAssignments.studentProfileId, studentProfileId),
            eq(tutorStudentAssignments.status, "active"),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async isParentLinkedToStudent(parentUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: parentStudentLinks.id })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(
          and(
            eq(parentProfiles.userId, parentUserId),
            eq(parentStudentLinks.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async findParentProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: parentProfiles.id })
        .from(parentProfiles)
        .where(eq(parentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },
  };
}

export function createDrizzleProjectsDatabase(database: Database): ProjectDatabase {
  return repository(database, database, false);
}
