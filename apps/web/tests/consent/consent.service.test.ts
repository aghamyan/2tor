import { describe, expect, it } from "vitest";

import {
  createParentProfile,
  createStudentUnderParent,
} from "../../../../packages/domain/families/services";
import {
  SIGNED_FORM_ATTESTATION_PHRASE,
  type ConsentMethod,
} from "../../../../packages/domain/consent/consent-method";
import { ConsentError } from "../../../../packages/domain/consent/errors";
import {
  CURRENT_CONSENT_DATA_CATEGORIES,
  CURRENT_CONSENT_VERSION,
  type RecordConsentInput,
} from "../../../../packages/domain/consent/schemas";
import {
  activateStudent,
  hasValidConsent,
  recordConsent,
} from "../../../../packages/domain/consent/services";
import { InMemoryFamilyDatabase } from "../families/support/in-memory-family-database";
import { FakeConsentNotifier } from "./support/fake-notifier";
import { InMemoryConsentDatabase } from "./support/in-memory-consent-database";

const parentActor = { userId: "parent-user-1", roles: ["parent"] as const };
const otherParentActor = { userId: "parent-user-2", roles: ["parent"] as const };
const staffActor = { userId: "admin-user-1", roles: ["administrator"] as const };

function validEvidence(): Record<string, unknown> {
  return { typedFullName: "Anahit Petrosyan", attestationPhrase: SIGNED_FORM_ATTESTATION_PHRASE };
}

async function setupFamily(options: { isAdultLearner?: boolean; verifiedContact?: boolean } = {}) {
  const familyDatabase = new InMemoryFamilyDatabase();
  const consentDatabase = new InMemoryConsentDatabase();
  const notifier = new FakeConsentNotifier();

  const parent = await createParentProfile(familyDatabase, parentActor, {
    fullName: "Anahit Petrosyan",
    phone: "+1 555 0100",
    contentLanguagePreference: "en",
  });

  const student = await createStudentUnderParent(familyDatabase, parentActor, {
    username: "learner.one",
    preferredName: "Mina",
    gradeLevel: "6",
    isAdultLearner: options.isAdultLearner ?? false,
    usState: "CA",
    dobYearMonth: null,
    ageBand: options.isAdultLearner ? null : "11-12",
    primaryTimezone: "America/Los_Angeles",
    locale: "en",
    relationship: "parent",
  });

  consentDatabase.students.set(student.id, {
    id: student.id,
    userId: student.userId,
    preferredName: student.preferredName,
    isAdultLearner: student.isAdultLearner,
    status: student.status,
  });
  consentDatabase.primaryParentUserIds.set(student.id, parentActor.userId);
  const verifiedContact = options.verifiedContact ?? true;
  consentDatabase.parentVerification.set(parentActor.userId, {
    parentProfileId: parent.id,
    userId: parentActor.userId,
    emailVerifiedAt: verifiedContact ? new Date("2026-01-01T00:00:00Z") : null,
    phoneVerifiedAt: verifiedContact ? new Date("2026-01-01T00:00:00Z") : null,
  });

  return { familyDatabase, consentDatabase, notifier, parent, student };
}

function recordInput(studentProfileId: string, overrides: Partial<RecordConsentInput> = {}) {
  return {
    studentProfileId,
    noticeAcknowledged: true as const,
    method: "signed_form" as const,
    evidence: validEvidence(),
    ...overrides,
  };
}

describe("consent services", () => {
  it("keeps covered features disabled until a valid consent record exists", async () => {
    const { familyDatabase, consentDatabase, notifier, student } = await setupFamily();

    await expect(hasValidConsent(consentDatabase, student.id)).resolves.toBe(false);
    await expect(
      activateStudent(consentDatabase, familyDatabase, notifier, parentActor, student.id),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED", status: 409 });
    expect((await consentDatabase.findStudentConsentProfile(student.id))?.status).toBe("inactive");
  });

  it("does not activate a child from Terms/notice acknowledgement alone — a verified record is required", async () => {
    const { familyDatabase, consentDatabase, notifier, student } = await setupFamily();

    // Simulates a parent who only ever ticked a Terms-of-Service-style checkbox: recordConsent is
    // never called at all, so no consent_records row can exist.
    await expect(
      activateStudent(consentDatabase, familyDatabase, notifier, parentActor, student.id),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });

    // Simulates a parent who reached this flow's notice screen (noticeAcknowledged: true) but
    // whose verifiable step itself was not actually completed (wrong attestation phrase, as if
    // they just clicked through). This must still fail to produce a record.
    await expect(
      recordConsent(consentDatabase, familyDatabase, notifier, parentActor, {
        studentProfileId: student.id,
        noticeAcknowledged: true,
        method: "signed_form",
        evidence: { typedFullName: "Anahit Petrosyan", attestationPhrase: "I agree to the Terms" },
      }),
    ).rejects.toMatchObject({ code: "CONSENT_VERIFICATION_FAILED" });

    expect(consentDatabase.consentRecords.size).toBe(0);
    await expect(
      activateStudent(consentDatabase, familyDatabase, notifier, parentActor, student.id),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    expect((await consentDatabase.findStudentConsentProfile(student.id))?.status).toBe("inactive");
  });

  it("records all required consent attributes and then activates the student", async () => {
    const { familyDatabase, consentDatabase, notifier, parent, student } = await setupFamily();

    const record = await recordConsent(
      consentDatabase,
      familyDatabase,
      notifier,
      parentActor,
      recordInput(student.id),
    );

    expect(record).toMatchObject({
      parentProfileId: parent.id,
      studentProfileId: student.id,
      consentVersion: CURRENT_CONSENT_VERSION,
      method: "signed_form",
      dataCategories: [...CURRENT_CONSENT_DATA_CATEGORIES],
      revokedAt: null,
    });
    expect(record.identityEvidenceRef).toMatch(/^signed_form:/);
    expect(record.grantedAt).toBeInstanceOf(Date);
    expect(consentDatabase.audits.some((audit) => audit.action === "consent.recorded")).toBe(true);
    expect(notifier.calls).toContainEqual(
      expect.objectContaining({ type: "consent_status", data: { status: "granted" } }),
    );

    await expect(hasValidConsent(consentDatabase, student.id)).resolves.toBe(true);

    const activated = await activateStudent(
      consentDatabase,
      familyDatabase,
      notifier,
      parentActor,
      student.id,
    );
    expect(activated.status).toBe("active");
    expect(
      consentDatabase.audits.some((audit) => audit.action === "consent.student_activated"),
    ).toBe(true);
    expect(notifier.calls).toContainEqual(
      expect.objectContaining({ type: "consent_status", data: { status: "activated" } }),
    );
  });

  it("does not require parental consent for an adult learner but does require the family link", async () => {
    const { familyDatabase, consentDatabase, notifier, student } = await setupFamily({
      isAdultLearner: true,
    });

    expect(await hasValidConsent(consentDatabase, student.id)).toBe(false);
    const activated = await activateStudent(
      consentDatabase,
      familyDatabase,
      notifier,
      parentActor,
      student.id,
    );
    expect(activated.status).toBe("active");
    expect(consentDatabase.consentRecords.size).toBe(0);
  });

  it("rejects recording or activating consent for a student outside the actor's family", async () => {
    const { familyDatabase, consentDatabase, notifier, student } = await setupFamily();
    await createParentProfile(familyDatabase, otherParentActor, {
      fullName: "Someone Else",
      phone: null,
      contentLanguagePreference: "en",
    });

    await expect(
      recordConsent(
        consentDatabase,
        familyDatabase,
        notifier,
        otherParentActor,
        recordInput(student.id),
      ),
    ).rejects.toMatchObject({ code: "STUDENT_NOT_FOUND", status: 404 });
    await expect(
      activateStudent(consentDatabase, familyDatabase, notifier, otherParentActor, student.id),
    ).rejects.toMatchObject({ code: "STUDENT_NOT_FOUND", status: 404 });
  });

  it("requires the parent's email and phone to be verified before recording consent", async () => {
    const { familyDatabase, consentDatabase, notifier, student } = await setupFamily({
      verifiedContact: false,
    });

    await expect(
      recordConsent(
        consentDatabase,
        familyDatabase,
        notifier,
        parentActor,
        recordInput(student.id),
      ),
    ).rejects.toMatchObject({ code: "CONTACT_VERIFICATION_REQUIRED", status: 409 });
  });

  it("rejects a consent method key that has no registered implementation", async () => {
    const { familyDatabase, consentDatabase, notifier, student } = await setupFamily();

    await expect(
      recordConsent(
        consentDatabase,
        familyDatabase,
        notifier,
        parentActor,
        recordInput(student.id, { method: "video_call", evidence: {} }),
      ),
    ).rejects.toMatchObject({ code: "CONSENT_METHOD_NOT_SUPPORTED" });
  });

  it("accepts a custom ConsentMethod plugged in through the registry", async () => {
    const { familyDatabase, consentDatabase, notifier, student } = await setupFamily();
    const customMethod: ConsentMethod = {
      key: "video_call",
      async verify() {
        return { verified: true, identityEvidenceRef: "video_call:call-123" };
      },
    };

    const record = await recordConsent(
      consentDatabase,
      familyDatabase,
      notifier,
      parentActor,
      recordInput(student.id, { method: "video_call", evidence: {} }),
      { video_call: customMethod },
    );
    expect(record.method).toBe("video_call");
    expect(record.identityEvidenceRef).toBe("video_call:call-123");
  });

  it("treats consent as valid when any record is non-revoked, not only the most recent one", async () => {
    const { consentDatabase, parent, student } = await setupFamily();

    const older = await consentDatabase.insertConsentRecord({
      id: "consent_older",
      parentProfileId: parent.id,
      studentProfileId: student.id,
      consentVersion: CURRENT_CONSENT_VERSION,
      method: "signed_form",
      dataCategories: CURRENT_CONSENT_DATA_CATEGORIES,
      identityEvidenceRef: "signed_form:older",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
    });
    await consentDatabase.insertConsentRecord({
      id: "consent_newer",
      parentProfileId: parent.id,
      studentProfileId: student.id,
      consentVersion: CURRENT_CONSENT_VERSION,
      method: "signed_form",
      dataCategories: CURRENT_CONSENT_DATA_CATEGORIES,
      identityEvidenceRef: "signed_form:newer",
      grantedAt: new Date("2026-02-01T00:00:00Z"),
    });
    // Revoke only the newer record; the older one is still valid.
    const newer = consentDatabase.consentRecords.get("consent_newer");
    if (newer) {
      consentDatabase.consentRecords.set("consent_newer", { ...newer, revokedAt: new Date() });
    }

    expect(older.revokedAt).toBeNull();
    await expect(hasValidConsent(consentDatabase, student.id)).resolves.toBe(true);
  });

  it("lets staff activate on the family's behalf but not record consent for them", async () => {
    const { familyDatabase, consentDatabase, notifier, student } = await setupFamily();
    await recordConsent(
      consentDatabase,
      familyDatabase,
      notifier,
      parentActor,
      recordInput(student.id),
    );

    const activated = await activateStudent(
      consentDatabase,
      familyDatabase,
      notifier,
      staffActor,
      student.id,
    );
    expect(activated.status).toBe("active");
  });

  it("uses typed consent errors", () => {
    const error = new ConsentError("CONSENT_REQUIRED", "denied", 409);
    expect(error).toMatchObject({ code: "CONSENT_REQUIRED", status: 409 });
  });
});
