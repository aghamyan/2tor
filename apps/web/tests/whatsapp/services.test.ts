import { describe, expect, it } from "vitest";

import { createParentProfile, createStudentUnderParent } from "../../../../packages/domain/families/services";
import {
  CURRENT_CONSENT_DATA_CATEGORIES,
  CURRENT_CONSENT_VERSION,
} from "../../../../packages/domain/consent/schemas";
import {
  authorizeWhatsAppGroupAccess,
  syncGroupMembership,
  updateGroupPreferences,
} from "../../../../packages/domain/whatsapp/services";
import { InMemoryFamilyDatabase } from "../families/support/in-memory-family-database";
import { InMemoryConsentDatabase } from "../consent/support/in-memory-consent-database";
import { FakeWhatsAppSender } from "./support/fake-sender";
import { InMemoryWhatsAppDatabase } from "./support/in-memory-whatsapp-database";

const parentActor = { userId: "parent-user-1", roles: ["parent"] as const };
const otherParentActor = { userId: "parent-user-2", roles: ["parent"] as const };
const staffActor = { userId: "admin-user-1", roles: ["administrator"] as const };
const noRoleActor = { userId: "rando-user-1", roles: [] as const };

async function setupFamily() {
  const familyDatabase = new InMemoryFamilyDatabase();
  const consentDatabase = new InMemoryConsentDatabase();
  const whatsappDatabase = new InMemoryWhatsAppDatabase();
  const sender = new FakeWhatsAppSender();

  const parent = await createParentProfile(familyDatabase, parentActor, {
    fullName: "Anahit Petrosyan",
    phone: "+15550000001",
    contentLanguagePreference: "en",
  });

  const student = await createStudentUnderParent(familyDatabase, parentActor, {
    username: "learner.one",
    preferredName: "Mina",
    gradeLevel: "6",
    isAdultLearner: false,
    usState: "CA",
    dobYearMonth: null,
    ageBand: "11-12",
    primaryTimezone: "America/Los_Angeles",
    locale: "en",
    relationship: "parent",
  });

  return { familyDatabase, consentDatabase, whatsappDatabase, sender, parent, student };
}

function grantConsent(consentDatabase: InMemoryConsentDatabase, parentProfileId: string, studentProfileId: string) {
  return consentDatabase.insertConsentRecord({
    id: `consent_${studentProfileId}`,
    parentProfileId,
    studentProfileId,
    consentVersion: CURRENT_CONSENT_VERSION,
    method: "signed_form",
    dataCategories: CURRENT_CONSENT_DATA_CATEGORIES,
    identityEvidenceRef: "signed_form:test",
    grantedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

describe("authorizeWhatsAppGroupAccess", () => {
  it("rejects an unauthenticated actor", async () => {
    const { familyDatabase, student } = await setupFamily();
    await expect(
      authorizeWhatsAppGroupAccess(familyDatabase, null, student.id),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });

  it("rejects an actor with no parent or staff role", async () => {
    const { familyDatabase, student } = await setupFamily();
    await expect(
      authorizeWhatsAppGroupAccess(familyDatabase, noRoleActor, student.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects a parent who isn't linked to this student", async () => {
    const { familyDatabase, student } = await setupFamily();
    await expect(
      authorizeWhatsAppGroupAccess(familyDatabase, otherParentActor, student.id),
    ).rejects.toMatchObject({ code: "STUDENT_NOT_FOUND", status: 404 });
  });

  it("allows staff regardless of family link", async () => {
    const { familyDatabase, student } = await setupFamily();
    await expect(
      authorizeWhatsAppGroupAccess(familyDatabase, staffActor, student.id),
    ).resolves.toMatchObject({ userId: staffActor.userId });
  });
});

describe("updateGroupPreferences", () => {
  it("creates the group preference row with defaults on first save", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, student } = await setupFamily();

    const group = await updateGroupPreferences(
      whatsappDatabase,
      familyDatabase,
      consentDatabase,
      parentActor,
      { studentProfileId: student.id, isEnabled: true, reminderLeadMinutes: 60, includeChild: false },
    );

    expect(group).toMatchObject({
      studentProfileId: student.id,
      status: "not_provisioned",
      isEnabled: true,
      reminderLeadMinutes: 60,
      includeChild: false,
    });
  });

  it("blocks includeChild without a valid parental consent record", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, student } = await setupFamily();

    await expect(
      updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, parentActor, {
        studentProfileId: student.id,
        isEnabled: true,
        reminderLeadMinutes: 60,
        includeChild: true,
      }),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED", status: 409 });
    expect(whatsappDatabase.audits).toHaveLength(0);
  });

  it("allows includeChild once consent exists, and audits the transition", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, parent, student } = await setupFamily();
    await grantConsent(consentDatabase, parent.id, student.id);

    const group = await updateGroupPreferences(
      whatsappDatabase,
      familyDatabase,
      consentDatabase,
      parentActor,
      { studentProfileId: student.id, isEnabled: true, reminderLeadMinutes: 30, includeChild: true },
    );

    expect(group.includeChild).toBe(true);
    expect(
      whatsappDatabase.audits.some((audit) => audit.action === "whatsapp.include_child_enabled"),
    ).toBe(true);

    // Saving again with includeChild already true must not re-audit the same transition.
    await updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, parentActor, {
      studentProfileId: student.id,
      isEnabled: true,
      reminderLeadMinutes: 30,
      includeChild: true,
    });
    expect(
      whatsappDatabase.audits.filter((audit) => audit.action === "whatsapp.include_child_enabled"),
    ).toHaveLength(1);
  });

  it("rejects a family the actor isn't linked to", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, student } = await setupFamily();
    await expect(
      updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, otherParentActor, {
        studentProfileId: student.id,
        isEnabled: true,
        reminderLeadMinutes: 60,
        includeChild: false,
      }),
    ).rejects.toMatchObject({ code: "STUDENT_NOT_FOUND" });
  });
});

describe("syncGroupMembership", () => {
  it("requires the group to be enabled first", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, sender, student } = await setupFamily();
    await expect(
      syncGroupMembership(whatsappDatabase, familyDatabase, consentDatabase, sender, parentActor, student.id),
    ).rejects.toMatchObject({ code: "GROUP_NOT_ENABLED", status: 409 });
  });

  it("requires at least one linked parent with a phone number", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, sender, student } = await setupFamily();
    await updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, parentActor, {
      studentProfileId: student.id,
      isEnabled: true,
      reminderLeadMinutes: 60,
      includeChild: false,
    });
    whatsappDatabase.candidatesByStudentId.set(student.id, {
      student: null,
      parents: [],
      tutors: [{ userId: "tutor-1", phone: "+15550000002", locale: "en" }],
    });

    await expect(
      syncGroupMembership(whatsappDatabase, familyDatabase, consentDatabase, sender, parentActor, student.id),
    ).rejects.toMatchObject({ code: "NO_PARENT_LINKED", status: 409 });
    expect(sender.groupsCreated).toHaveLength(0);
  });

  it("requires at least one active tutor assignment before first provisioning", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, sender, student } = await setupFamily();
    await updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, parentActor, {
      studentProfileId: student.id,
      isEnabled: true,
      reminderLeadMinutes: 60,
      includeChild: false,
    });
    whatsappDatabase.candidatesByStudentId.set(student.id, {
      student: null,
      parents: [{ userId: parentActor.userId, phone: "+15550000001", locale: "en" }],
      tutors: [],
    });

    await expect(
      syncGroupMembership(whatsappDatabase, familyDatabase, consentDatabase, sender, parentActor, student.id),
    ).rejects.toMatchObject({ code: "NO_TUTOR_ASSIGNED", status: 409 });
  });

  it("creates the group, invites the tutor and parent, and never invites the student without includeChild", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, sender, student } = await setupFamily();
    await updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, parentActor, {
      studentProfileId: student.id,
      isEnabled: true,
      reminderLeadMinutes: 60,
      includeChild: false,
    });
    whatsappDatabase.candidatesByStudentId.set(student.id, {
      student: { userId: student.userId, phone: "+15550000003", locale: "en", displayName: "Mina" },
      parents: [{ userId: parentActor.userId, phone: "+15550000001", locale: "en" }],
      tutors: [{ userId: "tutor-1", phone: "+15550000002", locale: "en" }],
    });

    const group = await syncGroupMembership(
      whatsappDatabase,
      familyDatabase,
      consentDatabase,
      sender,
      parentActor,
      student.id,
    );

    expect(group.status).toBe("active");
    expect(sender.groupsCreated).toHaveLength(1);
    const members = await whatsappDatabase.listGroupMembers(group.id);
    expect(members.map((m) => m.role).sort()).toEqual(["parent", "tutor"]);
    expect(sender.invitesSent).toHaveLength(2);
  });

  it("adds the student only once includeChild is on and consent is valid", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, sender, parent, student } = await setupFamily();
    await grantConsent(consentDatabase, parent.id, student.id);
    await updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, parentActor, {
      studentProfileId: student.id,
      isEnabled: true,
      reminderLeadMinutes: 60,
      includeChild: true,
    });
    whatsappDatabase.candidatesByStudentId.set(student.id, {
      student: { userId: student.userId, phone: "+15550000003", locale: "en", displayName: "Mina" },
      parents: [{ userId: parentActor.userId, phone: "+15550000001", locale: "en" }],
      tutors: [{ userId: "tutor-1", phone: "+15550000002", locale: "en" }],
    });

    const group = await syncGroupMembership(
      whatsappDatabase,
      familyDatabase,
      consentDatabase,
      sender,
      parentActor,
      student.id,
    );

    const members = await whatsappDatabase.listGroupMembers(group.id);
    expect(members.map((m) => m.role).sort()).toEqual(["parent", "student", "tutor"]);
    expect(
      whatsappDatabase.audits.some((audit) => audit.action === "whatsapp.student_added_to_group"),
    ).toBe(true);
  });

  it("is idempotent — a second sync with the same candidates adds no members and creates no second group", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, sender, student } = await setupFamily();
    await updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, parentActor, {
      studentProfileId: student.id,
      isEnabled: true,
      reminderLeadMinutes: 60,
      includeChild: false,
    });
    whatsappDatabase.candidatesByStudentId.set(student.id, {
      student: null,
      parents: [{ userId: parentActor.userId, phone: "+15550000001", locale: "en" }],
      tutors: [{ userId: "tutor-1", phone: "+15550000002", locale: "en" }],
    });

    await syncGroupMembership(whatsappDatabase, familyDatabase, consentDatabase, sender, parentActor, student.id);
    await syncGroupMembership(whatsappDatabase, familyDatabase, consentDatabase, sender, parentActor, student.id);

    expect(sender.groupsCreated).toHaveLength(1);
    expect(sender.invitesSent).toHaveLength(2);
  });

  it("picks up a newly-assigned tutor on re-sync without touching existing members", async () => {
    const { familyDatabase, consentDatabase, whatsappDatabase, sender, student } = await setupFamily();
    await updateGroupPreferences(whatsappDatabase, familyDatabase, consentDatabase, parentActor, {
      studentProfileId: student.id,
      isEnabled: true,
      reminderLeadMinutes: 60,
      includeChild: false,
    });
    whatsappDatabase.candidatesByStudentId.set(student.id, {
      student: null,
      parents: [{ userId: parentActor.userId, phone: "+15550000001", locale: "en" }],
      tutors: [{ userId: "tutor-1", phone: "+15550000002", locale: "en" }],
    });
    const firstSync = await syncGroupMembership(
      whatsappDatabase,
      familyDatabase,
      consentDatabase,
      sender,
      parentActor,
      student.id,
    );

    whatsappDatabase.candidatesByStudentId.set(student.id, {
      student: null,
      parents: [{ userId: parentActor.userId, phone: "+15550000001", locale: "en" }],
      tutors: [
        { userId: "tutor-1", phone: "+15550000002", locale: "en" },
        { userId: "tutor-2", phone: "+15550000004", locale: "en" },
      ],
    });
    await syncGroupMembership(whatsappDatabase, familyDatabase, consentDatabase, sender, parentActor, student.id);

    const members = await whatsappDatabase.listGroupMembers(firstSync.id);
    expect(members.map((m) => m.userId).sort()).toEqual([parentActor.userId, "tutor-1", "tutor-2"]);
    // Only one group creation across both syncs; the second sync only invited the new tutor.
    expect(sender.groupsCreated).toHaveLength(1);
    expect(sender.invitesSent).toHaveLength(3);
  });
});
