import { ulid } from "ulid";
import { isAssignmentError } from "../assignments/errors";
import { validateSubmissionUpload } from "../assignments/services";
import { ProjectError } from "./errors";
import type {
  PortfolioItemRecord,
  PortfolioSharingConsentRecord,
  ProjectActor,
  ProjectDatabase,
  ProjectFileRecord,
  ProjectMemberRecord,
  ProjectRecord,
  ProjectRubricRecord,
  ProjectUpdateRecord,
  PublicPortfolioItem,
} from "./models";
import {
  addPortfolioItemSchema,
  addProjectMemberSchema,
  createProjectRubricSchema,
  createProjectSchema,
  createProjectUpdateSchema,
  type AddPortfolioItemInput,
  type AddProjectMemberInput,
  type CreateProjectInput,
  type CreateProjectRubricInput,
  type CreateProjectUpdateInput,
} from "./schemas";
import type { ProjectStorage } from "./storage";

function hasRole(actor: ProjectActor, ...roles: ProjectActor["roles"][number][]) {
  return roles.some((role) => actor.roles.includes(role));
}
function requireActor(actor: ProjectActor | null | undefined): asserts actor is ProjectActor {
  if (!actor) throw new ProjectError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}
function isStaff(actor: ProjectActor) {
  return hasRole(actor, "administrator", "super_administrator");
}
function isMember(project: ProjectRecord, studentProfileId: string | undefined) {
  return Boolean(
    studentProfileId &&
    project.members.some((member) => member.studentProfileId === studentProfileId),
  );
}

async function requireProjectTutor(
  database: ProjectDatabase,
  actor: ProjectActor,
  project: ProjectRecord,
): Promise<void> {
  if (isStaff(actor) || project.createdByUserId === actor.userId) return;
  if (
    !hasRole(actor, "tutor") ||
    !(
      await Promise.all(
        project.members.map((member) =>
          database.isTutorAssignedToStudent(actor.userId, member.studentProfileId),
        ),
      )
    ).every(Boolean)
  )
    throw new ProjectError(
      "FORBIDDEN",
      "Only the project tutor assigned to every member may access this project.",
      403,
    );
}

async function requireProjectAccess(
  database: ProjectDatabase,
  actor: ProjectActor,
  project: ProjectRecord,
): Promise<void> {
  if (isStaff(actor) || (hasRole(actor, "student") && isMember(project, actor.studentProfileId)))
    return;
  await requireProjectTutor(database, actor, project);
}

async function getProjectOrThrow(
  database: ProjectDatabase,
  projectId: string,
): Promise<ProjectRecord> {
  const project = await database.getProject(projectId);
  if (!project) throw new ProjectError("PROJECT_NOT_FOUND", "Project was not found.", 404);
  return project;
}

/** A tutor can create a project only for students they are currently assigned to. */
export async function createProject(
  database: ProjectDatabase,
  actor: ProjectActor | null | undefined,
  input: CreateProjectInput,
): Promise<ProjectRecord> {
  requireActor(actor);
  if (!isStaff(actor) && !hasRole(actor, "tutor"))
    throw new ProjectError("FORBIDDEN", "Only teaching staff can create a project.", 403);
  const values = createProjectSchema.parse(input);
  if (!isStaff(actor)) {
    const assignments = await Promise.all(
      values.members.map((member) =>
        database.isTutorAssignedToStudent(actor.userId, member.studentProfileId),
      ),
    );
    if (!assignments.every(Boolean))
      throw new ProjectError(
        "FORBIDDEN",
        "A tutor may only create projects for assigned students.",
        403,
      );
  }
  const now = new Date();
  const id = ulid();
  const members: ProjectMemberRecord[] = values.members.map((member) => ({
    id: ulid(),
    projectId: id,
    studentProfileId: member.studentProfileId,
    roleLabel: member.roleLabel,
    joinedAt: now,
    createdAt: now,
  }));
  const project: ProjectRecord = {
    id,
    courseId: values.courseId,
    subjectId: values.subjectId,
    title: values.title,
    description: values.description,
    isGroup: values.isGroup,
    status: values.status,
    startDate: values.startDate,
    dueDate: values.dueDate,
    createdByUserId: actor.userId,
    members,
    updates: [],
    files: [],
    rubrics: [],
    createdAt: now,
    updatedAt: now,
  };
  await database.saveProject(project);
  return project;
}

export async function getProjectForActor(
  database: ProjectDatabase,
  actor: ProjectActor | null | undefined,
  projectId: string,
): Promise<ProjectRecord> {
  requireActor(actor);
  const project = await getProjectOrThrow(database, projectId);
  await requireProjectAccess(database, actor, project);
  return project;
}

export async function addProjectMember(
  database: ProjectDatabase,
  actor: ProjectActor | null | undefined,
  projectId: string,
  input: AddProjectMemberInput,
): Promise<ProjectMemberRecord> {
  requireActor(actor);
  const project = await getProjectOrThrow(database, projectId);
  await requireProjectTutor(database, actor, project);
  if (!project.isGroup)
    throw new ProjectError("INVALID_INPUT", "Members can only be added to group projects.", 409);
  const values = addProjectMemberSchema.parse(input);
  if (project.members.some((member) => member.studentProfileId === values.studentProfileId))
    throw new ProjectError("INVALID_INPUT", "This student is already a project member.", 409);
  if (
    !isStaff(actor) &&
    !(await database.isTutorAssignedToStudent(actor.userId, values.studentProfileId))
  )
    throw new ProjectError("FORBIDDEN", "A tutor may only add assigned students.", 403);
  const now = new Date();
  const member = {
    id: ulid(),
    projectId,
    studentProfileId: values.studentProfileId,
    roleLabel: values.roleLabel,
    joinedAt: now,
    createdAt: now,
  } satisfies ProjectMemberRecord;
  await database.addProjectMember(member);
  return member;
}

/** Members can document their own work; teaching staff can document supervised projects. */
export async function addProjectUpdate(
  database: ProjectDatabase,
  actor: ProjectActor | null | undefined,
  projectId: string,
  input: CreateProjectUpdateInput,
): Promise<ProjectUpdateRecord> {
  requireActor(actor);
  const project = await getProjectOrThrow(database, projectId);
  await requireProjectAccess(database, actor, project);
  const values = createProjectUpdateSchema.parse(input);
  const update = {
    id: ulid(),
    projectId,
    authorUserId: actor.userId,
    note: values.note,
    progressPercentage: values.progressPercentage,
    createdAt: new Date(),
  } satisfies ProjectUpdateRecord;
  await database.addProjectUpdate(update);
  return update;
}

/**
 * D7 upload policy reused exactly: server-side bytes validation, declared-size comparison,
 * magic-byte checks, JPEG/PNG metadata removal, private quarantine storage, and pending scan.
 */
export async function uploadProjectFile(
  database: ProjectDatabase,
  storage: ProjectStorage,
  actor: ProjectActor | null | undefined,
  projectId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number },
  bytes: Uint8Array,
): Promise<ProjectFileRecord> {
  requireActor(actor);
  const project = await getProjectOrThrow(database, projectId);
  await requireProjectAccess(database, actor, project);
  let validated: ReturnType<typeof validateSubmissionUpload>;
  try {
    validated = validateSubmissionUpload(input, bytes);
  } catch (error) {
    if (isAssignmentError(error))
      throw new ProjectError(
        error.code as Extract<
          typeof error.code,
          "UPLOAD_NOT_ALLOWED" | "UPLOAD_TOO_LARGE" | "UPLOAD_SIGNATURE_INVALID"
        >,
        error.message.replace("assignments", "projects"),
        error.status,
      );
    throw error;
  }
  const file: ProjectFileRecord = {
    id: ulid(),
    projectId,
    uploadedByUserId: actor.userId,
    fileKey: `projects/${projectId}/${ulid()}.${validated.extension}`,
    fileName: input.fileName.trim().slice(0, 255) || "project-file",
    mimeType: validated.mimeType,
    sizeBytes: validated.safeBytes.byteLength,
    virusScanStatus: "pending",
    createdAt: new Date(),
  };
  await storage.putPrivate({
    key: file.fileKey,
    body: validated.safeBytes,
    mimeType: file.mimeType,
    metadata: { projectFileId: file.id, quarantine: "pending", originalName: file.fileName },
  });
  await database.saveProjectFile(file);
  return file;
}

async function projectForFile(database: ProjectDatabase, fileId: string) {
  const file = await database.getProjectFile(fileId);
  if (!file) throw new ProjectError("PROJECT_FILE_NOT_FOUND", "Project file was not found.", 404);
  return { file, project: await getProjectOrThrow(database, file.projectId) };
}

/** Pending, infected, and errored evidence never receives a download URL. */
export async function getDownloadableProjectFile(
  database: ProjectDatabase,
  actor: ProjectActor | null | undefined,
  fileId: string,
): Promise<ProjectFileRecord> {
  requireActor(actor);
  const { file, project } = await projectForFile(database, fileId);
  await requireProjectAccess(database, actor, project);
  if (file.virusScanStatus !== "clean")
    throw new ProjectError(
      "FILE_NOT_READY",
      "This file remains quarantined until malware scanning clears it.",
      409,
    );
  return file;
}

export async function recordProjectFileScanResult(
  database: ProjectDatabase,
  fileId: string,
  status: Exclude<ProjectFileRecord["virusScanStatus"], "pending">,
): Promise<void> {
  await projectForFile(database, fileId);
  await database.updateProjectFileScanStatus(fileId, status);
}

export async function createAndAttachProjectRubric(
  database: ProjectDatabase,
  actor: ProjectActor | null | undefined,
  projectId: string,
  input: CreateProjectRubricInput,
): Promise<ProjectRubricRecord> {
  requireActor(actor);
  const project = await getProjectOrThrow(database, projectId);
  await requireProjectTutor(database, actor, project);
  const values = createProjectRubricSchema.parse(input);
  const now = new Date();
  const rubric = {
    id: ulid(),
    ...values,
    createdByUserId: actor.userId,
    scope: "project",
    createdAt: now,
    updatedAt: now,
  } satisfies ProjectRubricRecord;
  await database.transaction(async (tx) => {
    await tx.saveProjectRubric(rubric);
    await tx.attachRubric(projectId, rubric.id);
  });
  return rubric;
}

/**
 * A student assembles a private portfolio item from project evidence or an assignment-evidence
 * reference. A `linkUrl` must already be public; private project/assignment file keys are never
 * emitted in a public portfolio response.
 */
export async function addPortfolioItem(
  database: ProjectDatabase,
  actor: ProjectActor | null | undefined,
  input: AddPortfolioItemInput,
): Promise<PortfolioItemRecord> {
  requireActor(actor);
  if (!hasRole(actor, "student") || !actor.studentProfileId)
    throw new ProjectError("FORBIDDEN", "Only a student can assemble their portfolio item.", 403);
  const values = addPortfolioItemSchema.parse(input);
  if (values.projectId) {
    const project = await getProjectOrThrow(database, values.projectId);
    if (!isMember(project, actor.studentProfileId))
      throw new ProjectError("FORBIDDEN", "Project evidence must belong to the student.", 403);
  }
  const now = new Date();
  const item: PortfolioItemRecord = {
    id: ulid(),
    studentProfileId: actor.studentProfileId,
    projectId: values.projectId,
    title: values.title,
    description: values.description,
    fileKey: null,
    linkUrl: values.linkUrl,
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  };
  await database.savePortfolioItem(item);
  return item;
}

/** An explicit record is written before visibility becomes public. There is no bypass. */
export async function approvePortfolioSharing(
  database: ProjectDatabase,
  actor: ProjectActor | null | undefined,
  portfolioItemId: string,
): Promise<PortfolioSharingConsentRecord> {
  requireActor(actor);
  if (!hasRole(actor, "parent"))
    throw new ProjectError("FORBIDDEN", "Only a linked parent can approve public sharing.", 403);
  const item = await database.getPortfolioItem(portfolioItemId);
  if (!item)
    throw new ProjectError("PORTFOLIO_ITEM_NOT_FOUND", "Portfolio item was not found.", 404);
  if (!(await database.isParentLinkedToStudent(actor.userId, item.studentProfileId)))
    throw new ProjectError(
      "FORBIDDEN",
      "Only a parent linked to this student can approve sharing.",
      403,
    );
  const parentProfileId = await database.findParentProfileIdByUserId(actor.userId);
  if (!parentProfileId)
    throw new ProjectError("FORBIDDEN", "A parent profile is required to approve sharing.", 409);
  const now = new Date();
  const consent = {
    id: ulid(),
    portfolioItemId,
    parentProfileId,
    consentGivenAt: now,
    revokedAt: null,
    createdAt: now,
  } satisfies PortfolioSharingConsentRecord;
  await database.transaction(async (tx) => {
    await tx.savePortfolioSharingConsent(consent);
    await tx.updatePortfolioVisibility(portfolioItemId, "public");
  });
  return consent;
}

/** Defense in depth for a direct visibility mutation or a consent that has been revoked. */
export async function getPublicPortfolioItem(
  database: ProjectDatabase,
  portfolioItemId: string,
): Promise<PublicPortfolioItem> {
  const item = await database.getPortfolioItem(portfolioItemId);
  if (!item)
    throw new ProjectError("PORTFOLIO_ITEM_NOT_FOUND", "Portfolio item was not found.", 404);
  if (item.visibility !== "public")
    throw new ProjectError("PORTFOLIO_NOT_PUBLIC", "This portfolio item is private.", 404);
  if (!(await database.hasActivePortfolioSharingConsent(portfolioItemId)))
    throw new ProjectError(
      "PORTFOLIO_CONSENT_REQUIRED",
      "A current parent sharing consent is required.",
      403,
    );
  return { id: item.id, title: item.title, description: item.description, linkUrl: item.linkUrl };
}
