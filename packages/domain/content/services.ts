import { ulid } from "ulid";
import { validateSubmissionUpload } from "../assignments/services";
import { ContentError } from "./errors";
import type {
  ContentActor,
  ContentDatabase,
  ContentReportRecord,
  ResourceLinkRecord,
  ResourceRecord,
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

/** Creates metadata and an embed reference only. This service intentionally has no fetch/download capability. */
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
  });
  const resource: ResourceRecord = {
    id: ulid(),
    title: values.title,
    description: values.description,
    subjectId: values.subjectId,
    type: values.type,
    createdByUserId: actor.userId,
    ownership: values.ownership,
    status: values.status,
    links: [],
    tags: [...new Set(values.tags.map((tag) => tag.toLocaleLowerCase()))],
    createdAt: now,
    updatedAt: now,
  };
  resource.links = links.map((link) => ({ ...link, resourceId: resource.id }));
  await database.saveResource(resource);
  return resource;
}
export async function listResources(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  filters?: { tag?: string; subjectId?: string | null },
) {
  actorRequired(actor);
  return database.listPublishedResources(filters);
}
export async function bookmarkResource(
  database: ContentDatabase,
  actor: ContentActor | null | undefined,
  resourceId: string,
) {
  actorRequired(actor);
  if (!actor.studentProfileId || !roles(actor, "student"))
    throw new ContentError("FORBIDDEN", "Only students can bookmark resources.", 403);
  if (!(await database.getResource(resourceId)))
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
    rightsConfirmedAt: now,
    status: "pending_review",
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
