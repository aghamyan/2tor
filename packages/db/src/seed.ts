import process from "node:process";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import { withTransaction, type Transaction } from "./client";

/** packages/db/src -> packages/db -> packages -> repo root, where `.env` lives (see docs/INFRA.md). */
const REPO_ROOT_ENV_PATH = path.join(import.meta.dirname, "..", "..", "..", ".env");

/**
 * Idempotent dev seed: a coherent golden-path dataset (parent, student, tutor, a tutor↔student
 * assignment, a lesson with attendance/feedback, a homework assignment, and a paid invoice).
 * Every row uses a fixed id and every insert uses `onConflictDoNothing()`, so re-running this
 * script never duplicates data — it's safe to run on every `pnpm --filter @app/db seed`.
 *
 * Demo credentials are development-only and use a real Argon2id hash so the local login UI can
 * exercise the same verification path as production. They must never be reused outside a
 * disposable development environment.
 */

const DEMO_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$brv9j53ahB8eYk+Zje/zLA$iFsVCFrdKyCLI2U6IkEb9TOZDX7xwX0hbSc6BtYVr/g";

const ids = {
  roleParent: "role_parent",
  roleStudent: "role_student",
  roleTutor: "role_tutor",
  roleFinance: "role_finance",
  roleAdmin: "role_admin",
  roleSuperAdmin: "role_super_admin",
  roleAcademicManager: "role_academic_manager",

  userParent: "usr_demo_parent",
  userStudent: "usr_demo_student",
  userTutor: "usr_demo_tutor",
  userAdmin: "usr_demo_admin",

  userRoleParent: "urole_demo_parent",
  userRoleStudent: "urole_demo_student",
  userRoleTutor: "urole_demo_tutor",
  userRoleAdmin: "urole_demo_admin",

  parentProfile: "pprof_demo_1",
  studentProfile: "sprof_demo_1",
  parentStudentLink: "psl_demo_1",
  consentRecord: "consent_demo_1",

  tutorProfile: "tprof_demo_1",

  subjectMath: "subj_math",
  subjectProgramming: "subj_programming",
  subjectArmenianHeritage: "subj_armenian_heritage",
  tutorSubject: "tsub_demo_1",

  tutorStudentAssignment: "tsa_demo_1",

  lessonSeries: "lseries_demo_1",
  lesson: "lesson_demo_1",
  zoomMeeting: "zoom_demo_1",
  attendance: "att_demo_1",
  lessonFeedback: "fb_demo_1",

  learningPlan: "lp_demo_1",
  learningPlanVersion: "lpv_demo_1",

  assignment: "asg_demo_1",
  assignmentSubmission: "asub_demo_1",
  gradingRecord: "grade_demo_1",

  price: "price_demo_standard_usd",
  lessonCharge: "lcharge_demo_1",
  paymentCustomer: "pcust_demo_1",
  paymentTransaction: "ptxn_demo_1",
  invoice: "inv_demo_1",
  invoiceItem: "iitem_demo_1",
  tutorEarningEntry: "earn_demo_1",

  auditEvent: "audit_demo_1",
} as const;

async function seed(tx: Transaction) {
  await tx
    .insert(schema.roles)
    .values([
      { id: ids.roleParent, key: "parent", name: "Parent" },
      { id: ids.roleStudent, key: "student", name: "Student" },
      { id: ids.roleTutor, key: "tutor", name: "Tutor" },
      { id: ids.roleFinance, key: "finance", name: "Finance" },
      { id: ids.roleAdmin, key: "admin", name: "Administrator" },
      { id: ids.roleSuperAdmin, key: "super_admin", name: "Super Administrator" },
      { id: ids.roleAcademicManager, key: "academic_manager", name: "Academic Manager (Phase 2)" },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.users)
    .values([
      {
        id: ids.userParent,
        email: "parent@example.com",
        passwordHash: DEMO_PASSWORD_HASH,
        status: "active",
        primaryTimezone: "America/Los_Angeles",
        locale: "en",
        emailVerifiedAt: new Date(),
      },
      {
        id: ids.userStudent,
        username: "areg.student",
        passwordHash: DEMO_PASSWORD_HASH,
        status: "active",
        primaryTimezone: "America/Los_Angeles",
        locale: "en",
      },
      {
        id: ids.userTutor,
        email: "tutor@example.com",
        passwordHash: DEMO_PASSWORD_HASH,
        status: "active",
        primaryTimezone: "Asia/Yerevan",
        locale: "hy",
        emailVerifiedAt: new Date(),
      },
      {
        id: ids.userAdmin,
        email: "admin@example.com",
        passwordHash: DEMO_PASSWORD_HASH,
        status: "active",
        primaryTimezone: "America/New_York",
        locale: "en",
        emailVerifiedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  // Upgrade databases seeded by earlier revisions without changing any non-placeholder hash.
  await tx
    .update(schema.users)
    .set({ passwordHash: DEMO_PASSWORD_HASH })
    .where(eq(schema.users.passwordHash, "seed-placeholder-not-a-real-hash"));

  await tx
    .insert(schema.userRoles)
    .values([
      { id: ids.userRoleParent, userId: ids.userParent, roleId: ids.roleParent },
      { id: ids.userRoleStudent, userId: ids.userStudent, roleId: ids.roleStudent },
      { id: ids.userRoleTutor, userId: ids.userTutor, roleId: ids.roleTutor },
      { id: ids.userRoleAdmin, userId: ids.userAdmin, roleId: ids.roleAdmin },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.parentProfiles)
    .values({
      id: ids.parentProfile,
      userId: ids.userParent,
      fullName: "Anahit Petrosyan",
      phone: "+1-555-0100",
      contentLanguagePreference: "en",
      billingEmail: "parent@example.com",
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.studentProfiles)
    .values({
      id: ids.studentProfile,
      userId: ids.userStudent,
      preferredName: "Areg",
      gradeLevel: "6",
      usState: "CA",
      /** Minimization default per spec §11.2 — month/year, not exact DOB. */
      dobYearMonth: "2014-05",
      status: "active",
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.parentStudentLinks)
    .values({
      id: ids.parentStudentLink,
      parentProfileId: ids.parentProfile,
      studentProfileId: ids.studentProfile,
      relationship: "parent",
      isPrimary: true,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.consentRecords)
    .values({
      id: ids.consentRecord,
      parentProfileId: ids.parentProfile,
      studentProfileId: ids.studentProfile,
      consentVersion: "2026-01-v1",
      method: "signed_form",
      dataCategories: ["academic_records", "contact_info", "communications"],
      grantedAt: new Date(),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.tutorProfiles)
    .values({
      id: ids.tutorProfile,
      userId: ids.userTutor,
      publicDisplayName: "Davit Grigoryan",
      bio: "Math and programming tutor with 5 years of experience teaching grades 4-9.",
      country: "Armenia",
      yearsExperience: 5,
      status: "active",
      publicProfileApprovedAt: new Date(),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.subjects)
    .values([
      { id: ids.subjectMath, key: "math", name: "Mathematics" },
      { id: ids.subjectProgramming, key: "programming", name: "Programming" },
      {
        id: ids.subjectArmenianHeritage,
        key: "armenian_heritage",
        name: "Armenian Language and Heritage",
      },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.tutorSubjects)
    .values({
      id: ids.tutorSubject,
      tutorProfileId: ids.tutorProfile,
      subjectId: ids.subjectMath,
      isPrimary: true,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.tutorStudentAssignments)
    .values({
      id: ids.tutorStudentAssignment,
      tutorProfileId: ids.tutorProfile,
      studentProfileId: ids.studentProfile,
      subjectId: ids.subjectMath,
      status: "active",
      startAt: new Date("2026-01-15T00:00:00Z"),
      createdByUserId: ids.userAdmin,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.lessonSeries)
    .values({
      id: ids.lessonSeries,
      tutorStudentAssignmentId: ids.tutorStudentAssignment,
      subjectId: ids.subjectMath,
      recurrenceRule: "FREQ=WEEKLY;BYDAY=TU",
      startDate: "2026-01-20",
      status: "active",
    })
    .onConflictDoNothing();

  const lessonStart = new Date("2026-01-20T18:00:00Z");
  const lessonEnd = new Date("2026-01-20T18:45:00Z");
  await tx
    .insert(schema.lessons)
    .values({
      id: ids.lesson,
      lessonSeriesId: ids.lessonSeries,
      tutorStudentAssignmentId: ids.tutorStudentAssignment,
      subjectId: ids.subjectMath,
      scheduledStartAt: lessonStart,
      scheduledEndAt: lessonEnd,
      status: "completed",
      timezoneAtBooking: "America/Los_Angeles",
      isTrial: false,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.zoomMeetings)
    .values({
      id: ids.zoomMeeting,
      lessonId: ids.lesson,
      zoomMeetingId: "000-000-0001",
      joinUrl: "https://zoom.us/j/0000000001",
      passcode: "demo123",
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.attendance)
    .values({
      id: ids.attendance,
      lessonId: ids.lesson,
      studentProfileId: ids.studentProfile,
      status: "present",
      recordedByUserId: ids.userTutor,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.lessonFeedback)
    .values({
      id: ids.lessonFeedback,
      lessonId: ids.lesson,
      studentProfileId: ids.studentProfile,
      topicsCovered: "Fraction addition and subtraction with unlike denominators.",
      objectiveMet: "yes",
      assignmentCompletionStatus: "not_applicable",
      effortEngagementNote:
        "Areg stayed focused for the full lesson and asked clarifying questions.",
      strengthsDemonstrated: "Quickly found common denominators once shown the method.",
      skillsToImprove: "Double-checking work before moving to the next problem.",
      nextLessonFocus: "Multiplying and dividing fractions.",
      assignedHomework: "Fractions Practice Set (see assignments).",
      tutorConfidence: "high",
      version: 1,
      status: "published",
      createdByUserId: ids.userTutor,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.learningPlans)
    .values({
      id: ids.learningPlan,
      studentProfileId: ids.studentProfile,
      subjectId: ids.subjectMath,
      title: "Grade 6 Math Foundations",
      startDate: "2026-01-20",
      parentGoal: "Build confidence with fractions before the spring semester.",
      studentGoal: "Get faster at homework so there's more time for soccer.",
      tutorGoal: "Master fraction operations, then move to ratios.",
      currentBaseline: "Comfortable with whole-number arithmetic; fractions are inconsistent.",
      expectedLessonFrequency: "Weekly, 45 minutes",
      status: "active",
      authorUserId: ids.userTutor,
      parentApprovalStatus: "approved",
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.learningPlanVersions)
    .values({
      id: ids.learningPlanVersion,
      learningPlanId: ids.learningPlan,
      versionNumber: 1,
      snapshot: {
        title: "Grade 6 Math Foundations",
        status: "active",
        focusAreas: ["fractions", "ratios"],
      },
      changeSummary: "Initial plan created after the first lesson.",
      createdByUserId: ids.userTutor,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.assignments)
    .values({
      id: ids.assignment,
      createdByUserId: ids.userTutor,
      studentProfileId: ids.studentProfile,
      subjectId: ids.subjectMath,
      lessonId: ids.lesson,
      title: "Fractions Practice Set",
      instructions:
        "Complete problems 1-10 on adding and subtracting fractions with unlike denominators.",
      dueAt: new Date("2026-01-27T18:00:00Z"),
      status: "published",
      maxScore: "100",
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.assignmentSubmissions)
    .values({
      id: ids.assignmentSubmission,
      assignmentId: ids.assignment,
      studentProfileId: ids.studentProfile,
      status: "graded",
      attemptNumber: 1,
      submittedAt: new Date("2026-01-26T20:00:00Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.gradingRecords)
    .values({
      id: ids.gradingRecord,
      submissionId: ids.assignmentSubmission,
      gradedByUserId: ids.userTutor,
      score: "92",
      maxScore: "100",
      feedback: "Great work overall — watch your denominators on problems 7 and 9.",
      gradedAt: new Date("2026-01-27T09:00:00Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.prices)
    .values({
      id: ids.price,
      key: "standard_lesson_usd",
      lessonType: "standard",
      amountMinor: 1800,
      currency: "USD",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      createdByUserId: ids.userAdmin,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.lessonCharges)
    .values({
      id: ids.lessonCharge,
      lessonId: ids.lesson,
      parentProfileId: ids.parentProfile,
      priceId: ids.price,
      /** Copied from `prices` at charge time — the historical-copy rule from spec §15. */
      amountMinor: 1800,
      currency: "USD",
      status: "captured",
      capturedAt: new Date("2026-01-20T19:00:00Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.paymentCustomers)
    .values({
      id: ids.paymentCustomer,
      parentProfileId: ids.parentProfile,
      stripeCustomerId: "cus_demo_placeholder",
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.invoices)
    .values({
      id: ids.invoice,
      parentProfileId: ids.parentProfile,
      status: "paid",
      currency: "USD",
      subtotalMinor: 1800,
      discountMinor: 0,
      totalMinor: 1800,
      issuedAt: new Date("2026-01-20T19:00:00Z"),
      paidAt: new Date("2026-01-20T19:00:05Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.invoiceItems)
    .values({
      id: ids.invoiceItem,
      invoiceId: ids.invoice,
      lessonChargeId: ids.lessonCharge,
      description: "Standard lesson — Mathematics — Jan 20, 2026",
      quantity: 1,
      unitAmountMinor: 1800,
      amountMinor: 1800,
      currency: "USD",
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.paymentTransactions)
    .values({
      id: ids.paymentTransaction,
      lessonChargeId: ids.lessonCharge,
      invoiceId: ids.invoice,
      parentProfileId: ids.parentProfile,
      stripePaymentIntentId: "pi_demo_placeholder",
      type: "charge",
      amountMinor: 1800,
      currency: "USD",
      status: "succeeded",
      processedAt: new Date("2026-01-20T19:00:05Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.tutorEarningEntries)
    .values({
      id: ids.tutorEarningEntry,
      tutorProfileId: ids.tutorProfile,
      lessonId: ids.lesson,
      /** Tutor compensation in AMD luma (spec §15: "Tutor AMD payouts use integer luma"). */
      amountMinor: 468000,
      currency: "AMD",
      status: "approved",
      earnedAt: new Date("2026-01-20T19:00:00Z"),
      approvedByUserId: ids.userAdmin,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.auditEvents)
    .values({
      id: ids.auditEvent,
      actorUserId: ids.userAdmin,
      action: "lesson_charge.captured",
      resourceType: "lesson_charges",
      resourceId: ids.lessonCharge,
      reason: "Seed data demo.",
    })
    .onConflictDoNothing();
}

async function main() {
  try {
    process.loadEnvFile(REPO_ROOT_ENV_PATH);
  } catch {
    // No root .env file (e.g. containers get DATABASE_URL from docker-compose's env_file instead).
  }

  const connectionString =
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/app";
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    await withTransaction(db, seed);
    console.log("Seed complete.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
