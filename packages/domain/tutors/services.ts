// `@app/domain` does not declare @app/auth as a workspace dependency yet; use the same source
// implementation without widening this slice's package manifest.
import { authorize } from "../../auth/src/authorize";
import { ulid } from "ulid";

import { projectAvailabilityUtc } from "./availability";
import { TutorError } from "./errors";
import type {
  AvailabilityQueryInput,
  DocumentUploadInput,
  ReplaceAvailabilityInput,
  TutorCapabilitiesInput,
  TutorProfileInput,
  TutorZoomDefaultsInput,
  VerificationReviewInput,
} from "./schemas";
import {
  availabilityQuerySchema,
  documentUploadInputSchema,
  replaceAvailabilityInputSchema,
  tutorCapabilitiesInputSchema,
  tutorProfileInputSchema,
  tutorZoomDefaultsInputSchema,
  verificationReviewInputSchema,
} from "./schemas";
import type {
  PublicTutorProfile,
  TutorActor,
  TutorAvailabilityUtcWindow,
  TutorDatabase,
  TutorDocumentRecord,
  TutorProfileRecord,
  TutorVerificationRecord,
} from "./models";

export interface TutorDocumentStorage {
  putPrivate(input: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    metadata: Record<string, string>;
  }): Promise<void>;
}

function requireTutor(actor: TutorActor | null | undefined): asserts actor is TutorActor {
  if (!actor) throw new TutorError("UNAUTHENTICATED", "A signed-in tutor is required.", 401);
  if (!actor.roles.includes("tutor"))
    throw new TutorError("FORBIDDEN", "Only a tutor can perform this operation.", 403);
}

function requireStaff(actor: TutorActor | null | undefined): asserts actor is TutorActor {
  if (!actor) throw new TutorError("UNAUTHENTICATED", "A signed-in staff member is required.", 401);
  if (!actor.roles.includes("administrator") && !actor.roles.includes("super_administrator")) {
    throw new TutorError("FORBIDDEN", "Only staff can perform this operation.", 403);
  }
}

async function requireOwnProfile(
  database: TutorDatabase,
  actor: TutorActor,
): Promise<TutorProfileRecord> {
  const profile = await database.findTutorProfileByUserId(actor.userId);
  if (!profile)
    throw new TutorError("TUTOR_PROFILE_REQUIRED", "Create a tutor profile first.", 409);
  return profile;
}

function publicProfile(
  profile: TutorProfileRecord,
  subjects: PublicTutorProfile["subjects"],
  gradeRanges: PublicTutorProfile["gradeRanges"],
  languages: PublicTutorProfile["languages"],
): PublicTutorProfile {
  return {
    id: profile.id,
    displayName: profile.publicDisplayName,
    bio: profile.bio,
    headline: profile.headline,
    country: profile.country,
    yearsExperience: profile.yearsExperience,
    educationSummary: profile.educationSummary,
    subjects,
    gradeRanges,
    languages,
  };
}

export async function createTutorProfile(
  database: TutorDatabase,
  actor: TutorActor | null | undefined,
  input: TutorProfileInput,
): Promise<TutorProfileRecord> {
  requireTutor(actor);
  const values = tutorProfileInputSchema.parse(input);
  if (await database.findTutorProfileByUserId(actor.userId))
    throw new TutorError("TUTOR_PROFILE_EXISTS", "A tutor profile already exists.", 409);
  return database.createTutorProfile(ulid(), actor.userId, values);
}

export async function updateTutorProfile(
  database: TutorDatabase,
  actor: TutorActor | null | undefined,
  input: TutorProfileInput,
): Promise<TutorProfileRecord> {
  requireTutor(actor);
  const values = tutorProfileInputSchema.parse(input);
  const profile = await requireOwnProfile(database, actor);
  return database.updateTutorProfile(profile.id, values);
}

/** The default a lesson is auto-provisioned with at creation time — see `packages/domain/scheduling/services.ts`'s auto-assign path. Saving here also backfills any of the tutor's already-scheduled lessons that have no Zoom row yet (see the web layer's `/api/tutors/me/zoom` route, which calls into the scheduling domain right after this resolves). */
export async function updateTutorZoomDefaults(
  database: TutorDatabase,
  actor: TutorActor | null | undefined,
  input: TutorZoomDefaultsInput,
): Promise<TutorProfileRecord> {
  requireTutor(actor);
  const values = tutorZoomDefaultsInputSchema.parse(input);
  const profile = await requireOwnProfile(database, actor);
  return database.updateZoomDefaults(profile.id, values);
}

export async function updateTutorCapabilities(
  database: TutorDatabase,
  actor: TutorActor | null | undefined,
  input: TutorCapabilitiesInput,
): Promise<void> {
  requireTutor(actor);
  const values = tutorCapabilitiesInputSchema.parse(input);
  await database.transaction(async (transaction) => {
    const profile = await requireOwnProfile(transaction, actor);
    await transaction.replaceSubjects(profile.id, values.subjects);
    await transaction.replaceGradeRanges(profile.id, values.gradeRanges);
    await transaction.replaceLanguages(profile.id, values.languages);
  });
}

/** The zone is the profile/account IANA zone; changing it belongs to account settings, not a rule write. */
export async function replaceTutorAvailability(
  database: TutorDatabase,
  actor: TutorActor | null | undefined,
  input: ReplaceAvailabilityInput,
): Promise<void> {
  requireTutor(actor);
  const values = replaceAvailabilityInputSchema.parse(input);
  const profile = await requireOwnProfile(database, actor);
  if (values.timeZone !== profile.timeZone) {
    throw new TutorError(
      "INVALID_INPUT",
      "Availability must use the tutor account's IANA time zone.",
      400,
    );
  }
  await database.replaceAvailability(profile.id, values.recurring);
}

export async function tutorAvailabilityForScheduling(
  database: TutorDatabase,
  tutorProfileId: string,
  input: AvailabilityQueryInput,
): Promise<TutorAvailabilityUtcWindow[]> {
  const range = availabilityQuerySchema.parse(input);
  const profile = await database.findTutorProfileById(tutorProfileId);
  if (!profile) throw new TutorError("TUTOR_NOT_FOUND", "Tutor profile was not found.", 404);
  const rules = await database.listAvailability(profile.id, profile.timeZone);
  return projectAvailabilityUtc(rules, range.startAt, range.endAt);
}

export async function getPublicTutorProfile(
  database: TutorDatabase,
  tutorProfileId: string,
): Promise<PublicTutorProfile> {
  const profile = await database.findTutorProfileById(tutorProfileId);
  if (!profile || profile.status !== "active" || !profile.publicProfileApprovedAt) {
    throw new TutorError("PUBLIC_PROFILE_NOT_FOUND", "Tutor profile was not found.", 404);
  }
  const [subjects, gradeRanges, languages] = await Promise.all([
    database.listSubjects(profile.id),
    database.listGradeRanges(profile.id),
    database.listLanguages(profile.id),
  ]);
  return publicProfile(profile, subjects, gradeRanges, languages);
}

function isAllowedSignature(mimeType: DocumentUploadInput["mimeType"], bytes: Uint8Array): boolean {
  if (mimeType === "application/pdf")
    return bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (mimeType === "image/jpeg")
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  );
}

function safeExtension(mimeType: DocumentUploadInput["mimeType"]): string {
  return mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : "png";
}

/** Uploads to a non-public object key. The DB document remains `pending` (quarantined) until review. */
export async function uploadTutorDocument(
  database: TutorDatabase,
  storage: TutorDocumentStorage,
  actor: TutorActor | null | undefined,
  input: DocumentUploadInput,
  bytes: Uint8Array,
): Promise<TutorDocumentRecord> {
  requireTutor(actor);
  const values = documentUploadInputSchema.parse(input);
  if (bytes.byteLength !== values.sizeBytes || !isAllowedSignature(values.mimeType, bytes)) {
    throw new TutorError("INVALID_UPLOAD", "The file type or file signature is not allowed.", 400);
  }
  const profile = await requireOwnProfile(database, actor);
  const documentId = ulid();
  const key = `private/tutors/${profile.id}/verification/${documentId}.${safeExtension(values.mimeType)}`;
  await storage.putPrivate({
    key,
    body: bytes,
    mimeType: values.mimeType,
    metadata: { scan_status: "pending", document_type: values.type },
  });
  return database.createDocument({
    id: documentId,
    tutorProfileId: profile.id,
    type: values.type,
    fileKey: key,
    status: "pending",
  });
}

/**
 * Uses @app/auth's hard self-approval denial. Even a tutor holding an administrator role cannot
 * approve verification attached to their own user account.
 */
export async function reviewTutorVerification(
  database: TutorDatabase,
  actor: TutorActor | null | undefined,
  verificationId: string,
  input: VerificationReviewInput,
): Promise<TutorVerificationRecord> {
  requireStaff(actor);
  const values = verificationReviewInputSchema.parse(input);
  const record = await database.findVerification(verificationId);
  if (!record) throw new TutorError("TUTOR_NOT_FOUND", "Verification record was not found.", 404);
  const profile = await database.findTutorProfileById(record.tutorProfileId);
  if (!profile) throw new TutorError("TUTOR_NOT_FOUND", "Tutor profile was not found.", 404);
  const decision = authorize(actor, "admin.approve_user", {
    kind: "admin_action",
    targetUserId: profile.userId,
  });
  if (!decision.allowed) {
    const code =
      decision.reason === "cannot_self_approve" ? "SELF_VERIFICATION_FORBIDDEN" : "FORBIDDEN";
    throw new TutorError(code, "A tutor cannot approve their own verification.", 403);
  }
  return database.reviewVerification(verificationId, {
    ...values,
    verifiedByUserId: actor.userId,
    verifiedAt: new Date(),
  });
}
