import { ulid } from "ulid";

import { FamilyError } from "./errors";
import type {
  FamilyActor,
  FamilyDatabase,
  FamilyReadiness,
  FamilyStudentPage,
  ParentProfileRecord,
  StudentFamilyDetail,
  StudentProfileRecord,
} from "./models";
import {
  createStudentInputSchema,
  familyListInputSchema,
  interestsInputSchema,
  linkStudentInputSchema,
  parentProfileInputSchema,
  preferencesInputSchema,
  studentProfileInputSchema,
  unlinkStudentInputSchema,
  type CreateStudentInput,
  type InterestsInput,
  type LinkStudentInput,
  type ParentProfileInput,
  type PreferencesInput,
  type StudentProfileInput,
  type UnlinkStudentInput,
} from "./schemas";

function requireParentActor(actor: FamilyActor | null | undefined): asserts actor is FamilyActor {
  if (!actor) throw new FamilyError("UNAUTHENTICATED", "A signed-in parent is required.", 401);
  if (actor.roles.includes("student")) {
    throw new FamilyError(
      "FORBIDDEN",
      "Student actors cannot create or manage family accounts.",
      403,
    );
  }
  if (!actor.roles.includes("parent")) {
    throw new FamilyError("FORBIDDEN", "Only a parent can perform this operation.", 403);
  }
}

function isStaff(actor: FamilyActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

async function requireOwnParentProfile(
  database: FamilyDatabase,
  actor: FamilyActor,
): Promise<ParentProfileRecord> {
  const parent = await database.findParentProfileByUserId(actor.userId);
  if (!parent) {
    throw new FamilyError(
      "PARENT_PROFILE_REQUIRED",
      "Create the parent profile before managing students.",
      409,
    );
  }
  return parent;
}

async function requireManagedStudent(
  database: FamilyDatabase,
  actor: FamilyActor,
  studentProfileId: string,
): Promise<{ parent: ParentProfileRecord; student: StudentProfileRecord }> {
  requireParentActor(actor);
  const parent = await requireOwnParentProfile(database, actor);
  const [link, student] = await Promise.all([
    database.findLink(parent.id, studentProfileId),
    database.findStudentById(studentProfileId),
  ]);
  if (!link || !student) {
    throw new FamilyError("STUDENT_NOT_FOUND", "Student was not found.", 404);
  }
  return { parent, student };
}

export async function createParentProfile(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  input: ParentProfileInput,
): Promise<ParentProfileRecord> {
  requireParentActor(actor);
  const values = parentProfileInputSchema.parse(input);
  if (await database.findParentProfileByUserId(actor.userId)) {
    throw new FamilyError("PARENT_PROFILE_EXISTS", "A parent profile already exists.", 409);
  }
  return database.createParentProfile(ulid(), actor.userId, values);
}

export async function updateParentProfile(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  input: ParentProfileInput,
  reason = "Parent corrected their profile information.",
): Promise<ParentProfileRecord> {
  requireParentActor(actor);
  const values = parentProfileInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const parent = await requireOwnParentProfile(transaction, actor);
    const updated = await transaction.updateParentProfile(parent.id, values);
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "family.parent_profile.corrected",
      resourceType: "parent_profiles",
      resourceId: parent.id,
      reason,
      previousValue: {
        fullName: parent.fullName,
        phone: parent.phone,
        contentLanguagePreference: parent.contentLanguagePreference,
      },
      newValue: values,
    });
    return updated;
  });
}

/**
 * The only public student-creation service. It requires a live parent actor, creates the pending
 * login, inactive student profile, parent link, and append-only audit event atomically.
 */
export async function createStudentUnderParent(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  input: CreateStudentInput,
): Promise<StudentProfileRecord> {
  requireParentActor(actor);
  const values = createStudentInputSchema.parse(input);

  return database.transaction(async (transaction) => {
    const parent = await requireOwnParentProfile(transaction, actor);
    if (await transaction.findStudentByUsername(values.username)) {
      throw new FamilyError("USERNAME_TAKEN", "That student username is unavailable.", 409);
    }

    const userId = ulid();
    const studentProfileId = ulid();
    const linkId = ulid();

    await transaction.createStudentAccount({
      id: userId,
      username: values.username,
      primaryTimezone: values.primaryTimezone,
      locale: values.locale,
    });
    const student = await transaction.createStudentProfile({
      id: studentProfileId,
      userId,
      preferredName: values.preferredName,
      gradeLevel: values.gradeLevel,
      isAdultLearner: values.isAdultLearner,
      usState: values.usState,
      dobYearMonth: values.dobYearMonth,
      ageBand: values.ageBand,
      status: "inactive",
    });
    const link = await transaction.createLink({
      id: linkId,
      parentProfileId: parent.id,
      studentProfileId,
      relationship: values.relationship,
      isPrimary: true,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "family.student.linked",
      resourceType: "parent_student_links",
      resourceId: link.id,
      reason: "Parent created the student profile.",
      newValue: {
        parentProfileId: parent.id,
        studentProfileId,
        relationship: values.relationship,
        isPrimary: true,
      },
    });
    return student;
  });
}

export async function correctStudentInfo(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  studentProfileId: string,
  input: StudentProfileInput,
  reason: string,
): Promise<StudentProfileRecord> {
  requireParentActor(actor);
  const values = studentProfileInputSchema.parse(input);
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3 || normalizedReason.length > 300) {
    throw new FamilyError("INVALID_INPUT", "A correction reason is required.", 400);
  }

  return database.transaction(async (transaction) => {
    const { student } = await requireManagedStudent(transaction, actor, studentProfileId);
    const updated = await transaction.updateStudentProfile(studentProfileId, values);
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "family.student_profile.corrected",
      resourceType: "student_profiles",
      resourceId: studentProfileId,
      reason: normalizedReason,
      previousValue: {
        preferredName: student.preferredName,
        gradeLevel: student.gradeLevel,
        isAdultLearner: student.isAdultLearner,
        usState: student.usState,
        dobYearMonth: student.dobYearMonth,
        ageBand: student.ageBand,
      },
      newValue: values,
    });
    return updated;
  });
}

/**
 * Links an additional parent/guardian to a student. Parents may only do this for a student they
 * already manage; staff may repair links for operational support.
 */
export async function linkStudent(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  input: LinkStudentInput,
): Promise<void> {
  if (!actor) throw new FamilyError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
  const values = linkStudentInputSchema.parse(input);

  await database.transaction(async (transaction) => {
    const [targetParent, student] = await Promise.all([
      transaction.findParentProfileById(values.parentProfileId),
      transaction.findStudentById(values.studentProfileId),
    ]);
    if (!targetParent) throw new FamilyError("PARENT_NOT_FOUND", "Parent was not found.", 404);
    if (!student) throw new FamilyError("STUDENT_NOT_FOUND", "Student was not found.", 404);

    if (!isStaff(actor)) {
      requireParentActor(actor);
      const ownParent = await requireOwnParentProfile(transaction, actor);
      const existingRelationship = await transaction.findLink(
        ownParent.id,
        values.studentProfileId,
      );
      if (!existingRelationship) {
        throw new FamilyError("FORBIDDEN", "The student is not in this family.", 403);
      }
    }

    if (await transaction.findLink(values.parentProfileId, values.studentProfileId)) {
      throw new FamilyError("LINK_EXISTS", "This family link already exists.", 409);
    }
    const link = await transaction.createLink({
      id: ulid(),
      parentProfileId: values.parentProfileId,
      studentProfileId: values.studentProfileId,
      relationship: values.relationship,
      isPrimary: values.isPrimary,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "family.student.linked",
      resourceType: "parent_student_links",
      resourceId: link.id,
      reason: values.reason,
      newValue: {
        parentProfileId: values.parentProfileId,
        studentProfileId: values.studentProfileId,
        relationship: values.relationship,
        isPrimary: values.isPrimary,
      },
    });
  });
}

export async function unlinkStudent(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  input: UnlinkStudentInput,
): Promise<void> {
  if (!actor) throw new FamilyError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
  const values = unlinkStudentInputSchema.parse(input);

  await database.transaction(async (transaction) => {
    const [targetParent, student, link] = await Promise.all([
      transaction.findParentProfileById(values.parentProfileId),
      transaction.findStudentById(values.studentProfileId),
      transaction.findLink(values.parentProfileId, values.studentProfileId),
    ]);
    if (!targetParent) throw new FamilyError("PARENT_NOT_FOUND", "Parent was not found.", 404);
    if (!student) throw new FamilyError("STUDENT_NOT_FOUND", "Student was not found.", 404);
    if (!link) throw new FamilyError("LINK_NOT_FOUND", "Family link was not found.", 404);

    if (!isStaff(actor) && targetParent.userId !== actor.userId) {
      throw new FamilyError("FORBIDDEN", "Parents can only remove their own link.", 403);
    }

    const links = await transaction.listLinksForStudent(values.studentProfileId);
    if (!student.isAdultLearner && links.length <= 1) {
      throw new FamilyError(
        "LAST_PARENT_LINK",
        "A minor student must remain linked to a parent.",
        409,
      );
    }

    await transaction.deleteLink(link.id);
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "family.student.unlinked",
      resourceType: "parent_student_links",
      resourceId: link.id,
      reason: values.reason,
      previousValue: {
        parentProfileId: link.parentProfileId,
        studentProfileId: link.studentProfileId,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
      },
    });
  });
}

export async function replaceStudentInterests(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  studentProfileId: string,
  input: InterestsInput,
): Promise<string[]> {
  requireParentActor(actor);
  const values = interestsInputSchema.parse(input);
  return database.transaction(async (transaction) => {
    await requireManagedStudent(transaction, actor, studentProfileId);
    const previous = await transaction.listInterests(studentProfileId);
    await transaction.replaceInterests(studentProfileId, values.interests);
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "family.student_interests.corrected",
      resourceType: "student_profiles",
      resourceId: studentProfileId,
      reason: values.reason,
      previousValue: { interests: previous },
      newValue: { interests: values.interests },
    });
    return [...values.interests];
  });
}

export async function updateStudentPreferences(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  studentProfileId: string,
  input: PreferencesInput,
): Promise<void> {
  requireParentActor(actor);
  const values = preferencesInputSchema.parse(input);
  await database.transaction(async (transaction) => {
    await requireManagedStudent(transaction, actor, studentProfileId);
    const previous = await transaction.getPreferences(studentProfileId);
    const next = {
      preferredLessonStyle: values.preferredLessonStyle,
      availabilityNotes: values.availabilityNotes,
      notes: values.notes,
    };
    await transaction.savePreferences(studentProfileId, next);
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "family.student_preferences.corrected",
      resourceType: "student_preferences",
      resourceId: studentProfileId,
      reason: values.reason,
      previousValue: previous,
      newValue: next,
    });
  });
}

export async function listFamilyStudents(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<FamilyStudentPage> {
  requireParentActor(actor);
  const page = familyListInputSchema.parse({
    cursor: input.cursor ?? null,
    limit: input.limit ?? 20,
  });
  const parent = await requireOwnParentProfile(database, actor);
  const rows = await database.listStudentsForParent(parent.id, page.cursor, page.limit + 1);
  const hasMore = rows.length > page.limit;
  const items = hasMore ? rows.slice(0, page.limit) : rows;
  return {
    items,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  };
}

export async function getFamilyStudent(
  database: FamilyDatabase,
  actor: FamilyActor | null | undefined,
  studentProfileId: string,
): Promise<StudentFamilyDetail> {
  requireParentActor(actor);
  const parent = await requireOwnParentProfile(database, actor);
  const summary = await database.getStudentForParent(parent.id, studentProfileId);
  if (!summary) throw new FamilyError("STUDENT_NOT_FOUND", "Student was not found.", 404);
  const student = await database.findStudentById(studentProfileId);
  if (!student) throw new FamilyError("STUDENT_NOT_FOUND", "Student was not found.", 404);
  const [interests, preferences] = await Promise.all([
    database.listInterests(studentProfileId),
    database.getPreferences(studentProfileId),
  ]);
  return {
    ...summary,
    userId: student.userId,
    isAdultLearner: student.isAdultLearner,
    usState: student.usState,
    primaryTimezone: student.primaryTimezone,
    locale: student.locale,
    interests,
    preferences,
  };
}

export async function parentLinkedToStudent(
  database: FamilyDatabase,
  parentUserId: string,
  studentProfileId: string,
): Promise<boolean> {
  const parent = await database.findParentProfileByUserId(parentUserId);
  if (!parent) return false;
  return (await database.findLink(parent.id, studentProfileId)) !== null;
}

/**
 * Structural readiness only. D2 owns consent and calls this before its own consent/activation
 * checks; this query intentionally does not read or infer consent state.
 */
export async function familyReadyForActivation(
  database: FamilyDatabase,
  studentProfileId: string,
): Promise<FamilyReadiness> {
  const student = await database.findStudentById(studentProfileId);
  if (!student) {
    return { ready: false, studentId: studentProfileId, blockers: ["student_not_found"] };
  }
  if (student.isAdultLearner) {
    return { ready: true, studentId: studentProfileId, blockers: [] };
  }
  const links = await database.listLinksForStudent(studentProfileId);
  return links.length > 0
    ? { ready: true, studentId: studentProfileId, blockers: [] }
    : { ready: false, studentId: studentProfileId, blockers: ["missing_parent_link"] };
}
