import { ulid } from "ulid";
import { validateSubmissionUpload } from "../assignments/services";
import { ContentError } from "./errors";
import type {
  ContentActor,
  ContentDatabase,
  ContentReportRecord,
  ResourceLinkRecord,
  ResourceRecord,
  ResourceViewer,
  TutorUploadRecord,
} from "./models";
import { createResourceSchema, type CreateResourceInput } from "./schemas";
import type { ContentStorage } from "./storage";

const roles = (actor: ContentActor, ...allowed: ContentActor["roles"][number][]) =>
  allowed.some((role) => actor.roles.includes(role));
const staff = (actor: ContentActor) => roles(actor, "administrator", "super_administrator");
function actorRequired(actor: ContentActor | null | undefined): asserts actor is ContentActor {
  if (!actor) throw new ContentError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}
/** Tutors/staff manage the whole library; everyone else is scoped to what `visibility` admits them to. */
function resolveViewer(actor: ContentActor): ResourceViewer {
  if (roles(actor, "tutor", "administrator", "super_administrator", "finance"))
    return { scope: "all" };
  if (roles(actor, "student") && actor.studentProfileId)
    return {
      scope: "student",
      studentProfileId: actor.studentProfileId,
      gradeLevel: actor.gradeLevel ?? null,
    };
  if (roles(actor, "parent")) return { scope: "parent", students: actor.guardianStudents ?? [] };
  return { scope: "student", studentProfileId: "", gradeLevel: null };
}
function youtube(url: string): boolean {
  try {
    const value = new URL(url);
    return (
      (value.protocol === "https:" || value.protocol === "http:") &&
      (value.hostname === "youtube.com" ||
        value.hostname.endsWith(".youtube.com") ||
        value.hostname === "youtu.be")
    );
  } catch {
    return false;
  }
}
function videoEmbedUrl(url: string): string {
  const value = new URL(url);
  const id =
    value.hostname === "youtu.be"
      ? value.pathname.slice(1)
      : (value.searchParams.get("v") ?? value.pathname.match(/^\/embed\/([^/?]+)/)?.[1] ?? "");
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id))
    throw new ContentError("INVALID_VIDEO_URL", "Use a valid YouTube video URL.");
  return `https://www.youtube.com/embed/${id}`;
}

/** Creates metadata and an embed/link reference only. This service intentionally has no fetch/download capability. */
export async function createResource(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  input: CreateResourceInput,
): Promise<ResourceRecord> {
  actorRequired(actor);
  if (!roles(actor, "tutor", "administrator", "super_administrator"))
    throw new ContentError("FORBIDDEN", "Only tutors or administrators can create resources.", 403);
  const values = createResourceSchema.parse(input);
  const now = new Date();
  const links: ResourceLinkRecord[] = values.links.map((link) => {
    if (values.type === "video") {
      if (!youtube(link.url))
        throw new ContentError("INVALID_VIDEO_URL", "Video resources may only reference YouTube.");
      return {
        id: ulid(),
        resourceId: "",
        url: videoEmbedUrl(link.url),
        provider: "youtube",
        title: link.title,
        createdAt: now,
      };
    }
    return {
      id: ulid(),
      resourceId: "",
      url: link.url,
      provider: youtube(link.url) ? "youtube" : "other",
      title: link.title,
      createdAt: now,
    };
  });
  const studentProfileIds = [...new Set(values.studentProfileIds)];
  const resource: ResourceRecord = {
    id: ulid(),
    title: values.title,
    description: values.description,
    subjectId: values.subjectId,
    type: values.type,
    createdByUserId: actor.userId,
    ownership: values.ownership,
    status: values.status,
    visibility: values.visibility,
    gradeLevels: values.visibility === "grades" ? [...new Set(values.gradeLevels)] : [],
    links: [],
    tags: [...new Set(values.tags.map((tag) => tag.toLocaleLowerCase()))],
    file: null,
    createdAt: now,
    updatedAt: now,
  };
  resource.links = links.map((link) => ({ ...link, resourceId: resource.id }));
  await database.transaction(async (tx) => {
    await tx.saveResource(resource);
    if (values.visibility === "students")
      for (const studentProfileId of studentProfileIds)
        await tx.saveAssignment({
          id: ulid(),
          resourceId: resource.id,
          studentProfileId,
          courseId: null,
          assignedByUserId: actor.userId,
          assignedAt: now,
          createdAt: now,
        });
  });
  return resource;
}
export async function listResources(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  filters?: { tag?: string; subjectId?: string | null },
) {
  actorRequired(actor);
  const canAuthor = roles(actor, "tutor", "administrator", "super_administrator");
  return database.listPublishedResources({
    ...filters,
    viewer: resolveViewer(actor),
    includeDraftsByUserId: canAuthor ? actor.userId : undefined,
  });
}
export async function listResourceSubjects(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
) {
  actorRequired(actor);
  return database.listActiveSubjects();
}
export async function listBookmarkedResourceIds(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
) {
  actorRequired(actor);
  if (!actor.studentProfileId || !roles(actor, "student")) return [];
  return database.listBookmarkedResourceIds(actor.studentProfileId);
}
export async function bookmarkResource(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  resourceId: string,
) {
  actorRequired(actor);
  if (!actor.studentProfileId || !roles(actor, "student"))
    throw new ContentError("FORBIDDEN", "Only students can bookmark resources.", 403);
  const resource = await database.getResource(resourceId);
  if (!resource) throw new ContentError("RESOURCE_NOT_FOUND", "Resource not found.", 404);
  if (
    resource.status !== "published" ||
    !(await database.isResourceVisibleToViewer(resourceId, resolveViewer(actor)))
  )
    throw new ContentError("RESOURCE_NOT_FOUND", "Resource not found.", 404);
  await database.addBookmark(actor.studentProfileId, resourceId);
}
export async function removeBookmark(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  resourceId: string,
) {
  actorRequired(actor);
  if (!actor.studentProfileId || !roles(actor, "student"))
    throw new ContentError("FORBIDDEN", "Only students can manage bookmarks.", 403);
  await database.removeBookmark(actor.studentProfileId, resourceId);
}
export async function assignResource(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  input: { resourceId: string; studentProfileId: string | null; courseId: string | null },
) {
  actorRequired(actor);
  if (!roles(actor, "tutor", "administrator", "super_administrator"))
    throw new ContentError("FORBIDDEN", "Only tutors or administrators can assign resources.", 403);
  if (!(await database.getResource(input.resourceId)))
    throw new ContentError("RESOURCE_NOT_FOUND", "Resource not found.", 404);
  const now = new Date();
  await database.saveAssignment({
    id: ulid(),
    ...input,
    assignedByUserId: actor.userId,
    assignedAt: now,
    createdAt: now,
  });
}
export async function reportContent(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  resourceId: string,
  reason: string,
) {
  actorRequired(actor);
  if (!(await database.getResource(resourceId)))
    throw new ContentError("RESOURCE_NOT_FOUND", "Resource not found.", 404);
  const now = new Date();
  const report: ContentReportRecord = {
    id: ulid(),
    resourceId,
    reportedByUserId: actor.userId,
    reason: reason.trim(),
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  await database.transaction(async (tx) => {
    const resource = await tx.getResource(resourceId);
    if (!resource) throw new ContentError("RESOURCE_NOT_FOUND", "Resource not found.", 404);
    await Promise.all(resource.links.map((link) => tx.deleteLink(link.id)));
    await tx.saveReport(report);
  });
  return report;
}
/** D7-style private upload: rights acknowledgement is mandatory; videos never enter server storage. */
export async function uploadTutorMaterial(
  database: ContentDatabase,
  storage: ContentStorage,
  actor: ContentActor | null | undefined,
  input: {
    resourceId: string | null;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    rightsConfirmed: boolean;
  },
  bytes: Uint8Array,
): Promise<TutorUploadRecord> {
  actorRequired(actor);
  if (!roles(actor, "tutor"))
    throw new ContentError("FORBIDDEN", "Only tutors can upload materials.", 403);
  if (input.rightsConfirmed !== true)
    throw new ContentError(
      "RIGHTS_CONFIRMATION_REQUIRED",
      "Confirm that you have rights to upload this material.",
      422,
    );
  if (input.mimeType.startsWith("video/"))
    throw new ContentError(
      "UPLOAD_NOT_ALLOWED",
      "Video uploads are not allowed; add a YouTube link instead.",
      422,
    );
  const tutorProfileId = await database.findTutorProfileIdByUserId(actor.userId);
  if (!tutorProfileId) throw new ContentError("FORBIDDEN", "A tutor profile is required.", 403);
  let checked: ReturnType<typeof validateSubmissionUpload>;
  try {
    checked = validateSubmissionUpload(input, bytes);
  } catch (error) {
    const code =
      error instanceof Error && /large/i.test(error.message)
        ? "UPLOAD_TOO_LARGE"
        : "UPLOAD_SIGNATURE_INVALID";
    throw new ContentError(code, "The uploaded material failed security validation.", 422);
  }
  if (checked.mimeType.startsWith("video/"))
    throw new ContentError(
      "UPLOAD_NOT_ALLOWED",
      "Video uploads are not allowed; add a YouTube link instead.",
      422,
    );
  const now = new Date();
  const fileKey = `content/tutor/${tutorProfileId}/${ulid()}.${checked.extension}`;
  const upload: TutorUploadRecord = {
    id: ulid(),
    tutorProfileId,
    resourceId: input.resourceId,
    fileKey,
    fileName: input.fileName.trim(),
    mimeType: checked.mimeType,
    sizeBytes: checked.safeBytes.byteLength,
    rightsConfirmedAt: now,
    status: "pending_review",
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await storage.putPrivate({
    key: fileKey,
    body: checked.safeBytes,
    mimeType: checked.mimeType,
    metadata: {
      contentUploadId: upload.id,
      quarantine: "pending",
      originalName: input.fileName.trim(),
    },
  });
  await database.saveTutorUpload(upload);
  return upload;
}
export async function listModerationContentReports(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  limit = 100,
) {
  actorRequired(actor);
  if (!staff(actor))
    throw new ContentError("FORBIDDEN", "Only administrators can view moderation reports.", 403);
  return database.listOpenReports(Math.min(Math.max(limit, 1), 500));
}
/** Uploads stay quarantined until an administrator reviews them — a resource's file never surfaces to viewers before then. */
export async function listPendingTutorUploads(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  limit = 100,
) {
  actorRequired(actor);
  if (!staff(actor))
    throw new ContentError("FORBIDDEN", "Only administrators can review uploads.", 403);
  return database.listPendingTutorUploads(Math.min(Math.max(limit, 1), 500));
}
export async function reviewTutorUpload(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  uploadId: string,
  status: "approved" | "rejected",
) {
  actorRequired(actor);
  if (!staff(actor))
    throw new ContentError("FORBIDDEN", "Only administrators can review uploads.", 403);
  const upload = await database.getTutorUpload(uploadId);
  if (!upload) throw new ContentError("UPLOAD_NOT_FOUND", "Upload not found.", 404);
  if (upload.status !== "pending_review")
    throw new ContentError("UPLOAD_ALREADY_REVIEWED", "This upload was already reviewed.", 409);
  await database.reviewTutorUpload(uploadId, {
    status,
    reviewedByUserId: actor.userId,
    reviewedAt: new Date(),
  });
}
/** Streams only after: signed-URL ownership check (route layer), approval, and the same visibility rule the library list uses. */
export async function getDownloadableResourceUpload(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  uploadId: string,
): Promise<TutorUploadRecord> {
  actorRequired(actor);
  const upload = await database.getTutorUpload(uploadId);
  if (!upload || !upload.fileKey)
    throw new ContentError("UPLOAD_NOT_FOUND", "Upload not found.", 404);
  if (upload.status !== "approved")
    throw new ContentError("UPLOAD_NOT_READY", "This file is still under review.", 409);
  if (staff(actor) || roles(actor, "tutor")) return upload;
  if (
    !upload.resourceId ||
    !(await database.isResourceVisibleToViewer(upload.resourceId, resolveViewer(actor)))
  )
    throw new ContentError("UPLOAD_NOT_FOUND", "Upload not found.", 404);
  return upload;
}
/** Removes unavailable external references; it never fetches or mirrors media. */
export async function removeDeadLinks(
  database: ContentDatabase,
  isAlive: (url: string) => Promise<boolean>,
  limit = 100,
) {
  const links = await database.listLinksForHealthCheck(limit);
  const removed: string[] = [];
  for (const link of links)
    if (!(await isAlive(link.url))) {
      await database.deleteLink(link.id);
      removed.push(link.id);
    }
  return removed;
}
