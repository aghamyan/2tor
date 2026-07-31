import { ulid } from "ulid";

import type { FamilyDatabase } from "../families/models";
import { familyReadyForActivation, parentLinkedToStudent } from "../families/services";
import {
  defaultConsentMethodRegistry,
  resolveConsentMethod,
  type ConsentMethodRegistry,
} from "./consent-method";
import { ConsentError } from "./errors";
import type {
  ConsentActor,
  ConsentDatabase,
  ConsentNotifier,
  ConsentRecord,
  StudentConsentProfile,
} from "./models";
import {
  CURRENT_CONSENT_DATA_CATEGORIES,
  CURRENT_CONSENT_VERSION,
  recordConsentInputSchema,
  type RecordConsentInput,
} from "./schemas";

function requireParentActor(actor: ConsentActor | null | undefined): asserts actor is ConsentActor {
  if (!actor) throw new ConsentError("UNAUTHENTICATED", "A signed-in parent is required.", 401);
  if (!actor.roles.includes("parent")) {
    throw new ConsentError("FORBIDDEN", "Only a parent can complete this step.", 403);
  }
}

function isStaff(actor: ConsentActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

/**
 * Defense in depth, same rationale as `packages/domain/families/README.md`'s "Services repeat
 * the parent/link checks": the web layer authorizes first, but this must not be the only gate.
 * Returns `STUDENT_NOT_FOUND` (not `FORBIDDEN`) on a missing link so callers can't probe whether
 * an unrelated student id exists.
 */
async function requireLinkedStudent(
  familyDatabase: FamilyDatabase,
  parentUserId: string,
  studentProfileId: string,
): Promise<void> {
  const linked = await parentLinkedToStudent(familyDatabase, parentUserId, studentProfileId);
  if (!linked) throw new ConsentError("STUDENT_NOT_FOUND", "Student was not found.", 404);
}

/**
 * Records one verifiable-parental-consent event. This is the only path that can create a
 * `consent_records` row — there is no way to reach a valid consent state by accepting Terms of
 * Service alone, because this function is never invoked by that flow and `activateStudent` below
 * only trusts a real row here, not any other flag.
 *
 * Order of checks: parent actor -> input shape -> family link -> student exists & is a minor ->
 * parent's email+phone are verified (D1's "verify email + phone" step) -> the chosen
 * `ConsentMethod` actually verifies the submitted evidence. Only after all of that does a record
 * get written, inside one transaction with its audit event.
 */
export async function recordConsent(
  consentDatabase: ConsentDatabase,
  familyDatabase: FamilyDatabase,
  notifier: ConsentNotifier,
  actor: ConsentActor | null | undefined,
  input: RecordConsentInput,
  methods: ConsentMethodRegistry = defaultConsentMethodRegistry,
): Promise<ConsentRecord> {
  requireParentActor(actor);
  const values = recordConsentInputSchema.parse(input);
  await requireLinkedStudent(familyDatabase, actor.userId, values.studentProfileId);

  const student = await consentDatabase.findStudentConsentProfile(values.studentProfileId);
  if (!student) throw new ConsentError("STUDENT_NOT_FOUND", "Student was not found.", 404);
  if (student.isAdultLearner) {
    throw new ConsentError(
      "CONSENT_NOT_APPLICABLE",
      "Adult learners do not require parental consent.",
      409,
    );
  }

  const verification = await consentDatabase.findParentVerificationStatus(actor.userId);
  if (!verification) {
    throw new ConsentError("PARENT_PROFILE_REQUIRED", "Create the parent profile first.", 409);
  }
  if (!verification.emailVerifiedAt || !verification.phoneVerifiedAt) {
    throw new ConsentError(
      "CONTACT_VERIFICATION_REQUIRED",
      "Verify the parent's email and phone before requesting consent.",
      409,
    );
  }

  const method = resolveConsentMethod(methods, values.method);
  const now = new Date();
  const outcome = await method.verify(
    {
      parentUserId: actor.userId,
      parentProfileId: verification.parentProfileId,
      studentProfileId: values.studentProfileId,
      consentVersion: CURRENT_CONSENT_VERSION,
      dataCategories: CURRENT_CONSENT_DATA_CATEGORIES,
      now,
    },
    values.evidence,
  );
  if (!outcome.verified) {
    throw new ConsentError(
      "CONSENT_VERIFICATION_FAILED",
      outcome.failureReason ?? "Consent could not be verified.",
      422,
    );
  }

  const record = await consentDatabase.transaction(async (transaction) => {
    const inserted = await transaction.insertConsentRecord({
      id: ulid(),
      parentProfileId: verification.parentProfileId,
      studentProfileId: values.studentProfileId,
      consentVersion: CURRENT_CONSENT_VERSION,
      method: values.method,
      dataCategories: CURRENT_CONSENT_DATA_CATEGORIES,
      identityEvidenceRef: outcome.identityEvidenceRef,
      grantedAt: now,
    });
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "consent.recorded",
      resourceType: "consent_records",
      resourceId: inserted.id,
      reason: "Parent completed the verifiable parental consent step.",
      newValue: {
        studentProfileId: values.studentProfileId,
        method: values.method,
        consentVersion: CURRENT_CONSENT_VERSION,
        dataCategories: CURRENT_CONSENT_DATA_CATEGORIES,
      },
    });
    return inserted;
  });

  await notifier.notify({
    userId: actor.userId,
    type: "consent_status",
    data: { status: "granted" },
    relatedEntity: { type: "consent_records", id: record.id, enduring: true },
  });

  return record;
}

/**
 * Used by other modules before exposing covered child data or activating covered features.
 * "Valid" means at least one non-revoked record exists for this student — not merely that one
 * was ever granted, and not "the latest record happens to be non-revoked" (an earlier record can
 * still be valid after a later, unrelated one is revoked).
 */
export async function hasValidConsent(
  consentDatabase: ConsentDatabase,
  studentProfileId: string,
): Promise<boolean> {
  return consentDatabase.hasNonRevokedConsentRecord(studentProfileId);
}

/**
 * The only path that flips a student's covered features on. Requires: actor is the linked parent
 * or staff; the family is structurally ready (`familyReadyForActivation`, D1's hand-off); and —
 * unless the student is an adult learner, who needs no parental consent — `hasValidConsent` is
 * true. There is no other way to reach `status: "active"` through this module: accepting Terms of
 * Service elsewhere in the app does not touch this function or its checks at all.
 */
export async function activateStudent(
  consentDatabase: ConsentDatabase,
  familyDatabase: FamilyDatabase,
  notifier: ConsentNotifier,
  actor: ConsentActor | null | undefined,
  studentProfileId: string,
): Promise<StudentConsentProfile> {
  if (!actor) throw new ConsentError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
  if (!actor.roles.includes("parent") && !isStaff(actor)) {
    throw new ConsentError("FORBIDDEN", "Only a parent or staff can activate a student.", 403);
  }
  if (!isStaff(actor)) {
    await requireLinkedStudent(familyDatabase, actor.userId, studentProfileId);
  }

  const readiness = await familyReadyForActivation(familyDatabase, studentProfileId);
  if (!readiness.ready) {
    throw new ConsentError(
      readiness.blockers.includes("student_not_found") ? "STUDENT_NOT_FOUND" : "FAMILY_NOT_READY",
      `Family is not ready for activation: ${readiness.blockers.join(", ")}.`,
      409,
    );
  }

  const student = await consentDatabase.findStudentConsentProfile(studentProfileId);
  if (!student) throw new ConsentError("STUDENT_NOT_FOUND", "Student was not found.", 404);

  if (!student.isAdultLearner) {
    const valid = await hasValidConsent(consentDatabase, studentProfileId);
    if (!valid) {
      throw new ConsentError(
        "CONSENT_REQUIRED",
        "A valid parental consent record is required before activation.",
        409,
      );
    }
  }

  if (student.status === "active") return student;
  if (student.status === "suspended") {
    throw new ConsentError(
      "ACCOUNT_SUSPENDED",
      "A suspended account cannot be activated here.",
      409,
    );
  }

  const activated = await consentDatabase.transaction(async (transaction) => {
    const updated = await transaction.activateStudentStatus(studentProfileId);
    await transaction.appendAudit({
      id: ulid(),
      actorUserId: actor.userId,
      action: "consent.student_activated",
      resourceType: "student_profiles",
      resourceId: studentProfileId,
      reason: student.isAdultLearner
        ? "Adult learner activated; parental consent is not applicable."
        : "Activated after a valid parental consent record was confirmed.",
      previousValue: { status: student.status },
      newValue: { status: "active" },
    });
    return updated;
  });

  const parentUserId = await consentDatabase.findPrimaryParentUserId(studentProfileId);
  if (parentUserId) {
    await notifier.notify({
      userId: parentUserId,
      type: "consent_status",
      data: { status: "activated" },
      relatedEntity: { type: "student_profiles", id: studentProfileId, enduring: true },
    });
  }

  return activated;
}
