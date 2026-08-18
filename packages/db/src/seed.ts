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

/**
 * Dev-only TOTP secret for the seeded admin account (`administrator` requires MFA per
 * `MFA_REQUIREMENT` in packages/auth/src/rbac.ts). A fixed literal, not generated via
 * `@app/auth`'s `generateTotpSecret`, matching `DEMO_PASSWORD_HASH` above: `@app/db` has no
 * dependency on `@app/auth` (workspace isolation — see packages/auth/README.md), so this package
 * inlines pre-computed dev secrets instead of importing the primitives that produce them. Must
 * never be reused outside a disposable development environment.
 */
const DEMO_ADMIN_TOTP_SECRET = "GUSZSKEGAIAU64HEKAE65JTJVOZWX2MU";

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

  mfaAdminTotp: "mfa_demo_admin_totp",

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

  // MathOverflow (discussions) — second student/tutor pair + a small group course.
  userStudent2: "usr_demo_student2",
  userTutor2: "usr_demo_tutor2",
  userRoleStudent2: "urole_demo_student2",
  userRoleTutor2: "urole_demo_tutor2",
  studentProfile2: "sprof_demo_2",
  parentStudentLink2: "psl_demo_2",
  tutorProfile2: "tprof_demo_2",
  tutorSubject2: "tsub_demo_2",
  tutorStudentAssignment2: "tsa_demo_2",
  discussionGroupCourse: "course_demo_group_algebra",
  discussionEnrollmentAreg: "enr_demo_areg_group",
  discussionEnrollmentSona: "enr_demo_sona_group",

  // MathOverflow — tags.
  discussionTagFractions: "dtag_demo_fractions",
  discussionTagAlgebra: "dtag_demo_algebra",
  discussionTagNumberTheory: "dtag_demo_number_theory",

  // MathOverflow — questions.
  discussionQuestion1: "dq_demo_1",
  discussionQuestion2: "dq_demo_2",
  discussionQuestion3: "dq_demo_3",
  discussionQuestion4: "dq_demo_4",
  discussionQuestion5: "dq_demo_5",
  discussionQuestion6: "dq_demo_6",

  // MathOverflow — answers.
  discussionAnswer3a: "da_demo_3a",
  discussionAnswer3b: "da_demo_3b",
  discussionAnswer4a: "da_demo_4a",
  discussionAnswer5a: "da_demo_5a",

  // MathOverflow — votes, ratings, comments, corrections, follows, bookmarks, reports, notifications.
  discussionHelpfulVote1: "dhv_demo_1",
  discussionRating3a: "drat_demo_3a",
  discussionRating4a: "drat_demo_4a",
  discussionRating5a: "drat_demo_5a",
  discussionComment1: "dcm_demo_1",
  discussionComment2: "dcm_demo_2",
  discussionComment3: "dcm_demo_3",
  discussionCorrection1: "dcorr_demo_1",
  discussionFollow1: "dfol_demo_1",
  discussionBookmark1: "dbmk_demo_1",
  discussionQuestionTag1: "dqtag_demo_1",
  discussionQuestionTag2: "dqtag_demo_2",
  discussionQuestionTag3: "dqtag_demo_3",
  discussionQuestionTag4: "dqtag_demo_4",
  discussionQuestionTag5: "dqtag_demo_5",
  discussionQuestionTag6: "dqtag_demo_6",
  discussionReport1: "drpt_demo_1",
  discussionNotification1: "dnotif_demo_1",
  discussionNotification2: "dnotif_demo_2",
  discussionNotification3: "dnotif_demo_3",
  discussionNotification4: "dnotif_demo_4",
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

  // The admin role requires MFA at login (packages/auth/src/rbac.ts's MFA_REQUIREMENT), so the
  // seeded admin needs an active method or every login attempt is rejected before a session
  // is ever created.
  await tx
    .insert(schema.mfaMethods)
    .values({
      id: ids.mfaAdminTotp,
      userId: ids.userAdmin,
      type: "totp",
      status: "active",
      secretReference: DEMO_ADMIN_TOTP_SECRET,
      verifiedAt: new Date(),
    })
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

  await seedMathOverflow(tx);
}

/**
 * MathOverflow (discussions): a second student (Sona, same parent as Areg — a two-child family
 * for the parent-activity view) and a second tutor (Nvard) so cross-student/cross-tutor scenarios
 * are real, plus a small internally-consistent set of questions/answers/ratings/comments/
 * corrections/a report covering all four visibility tiers, several question statuses, and the
 * accepted/verified/rated distinction the UI must render separately. Every derived field
 * (`tutor_rating_average`, `is_accepted`, `last_activity_at`, tag `usage_count`, ...) is set by
 * hand here to match what the real service calls would have produced — nothing re-derives them.
 */
async function seedMathOverflow(tx: Transaction) {
  await tx
    .insert(schema.users)
    .values([
      {
        id: ids.userStudent2,
        username: "sona.student",
        passwordHash: DEMO_PASSWORD_HASH,
        status: "active",
        primaryTimezone: "America/Los_Angeles",
        locale: "en",
      },
      {
        id: ids.userTutor2,
        email: "tutor2@example.com",
        passwordHash: DEMO_PASSWORD_HASH,
        status: "active",
        primaryTimezone: "Asia/Yerevan",
        locale: "hy",
        emailVerifiedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.userRoles)
    .values([
      { id: ids.userRoleStudent2, userId: ids.userStudent2, roleId: ids.roleStudent },
      { id: ids.userRoleTutor2, userId: ids.userTutor2, roleId: ids.roleTutor },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.studentProfiles)
    .values({
      id: ids.studentProfile2,
      userId: ids.userStudent2,
      preferredName: "Sona",
      gradeLevel: "8",
      usState: "CA",
      dobYearMonth: "2012-09",
      status: "active",
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.parentStudentLinks)
    .values({
      id: ids.parentStudentLink2,
      parentProfileId: ids.parentProfile,
      studentProfileId: ids.studentProfile2,
      relationship: "parent",
      isPrimary: true,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.tutorProfiles)
    .values({
      id: ids.tutorProfile2,
      userId: ids.userTutor2,
      publicDisplayName: "Nvard Sargsyan",
      bio: "Algebra and geometry tutor focused on building confidence with middle-school math.",
      country: "Armenia",
      yearsExperience: 7,
      status: "active",
      publicProfileApprovedAt: new Date(),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.tutorSubjects)
    .values({
      id: ids.tutorSubject2,
      tutorProfileId: ids.tutorProfile2,
      subjectId: ids.subjectMath,
      isPrimary: true,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.tutorStudentAssignments)
    .values({
      id: ids.tutorStudentAssignment2,
      tutorProfileId: ids.tutorProfile2,
      studentProfileId: ids.studentProfile2,
      subjectId: ids.subjectMath,
      status: "active",
      startAt: new Date("2026-02-03T00:00:00Z"),
      createdByUserId: ids.userAdmin,
    })
    .onConflictDoNothing();

  // Backs the "group_shared" visibility tier — a tutor gets group access by being assigned to any
  // student enrolled in the course, so Davit (assigned only to Areg) reaches Q5 via Areg's enrollment.
  await tx
    .insert(schema.courses)
    .values({
      id: ids.discussionGroupCourse,
      subjectId: ids.subjectMath,
      title: "Group Algebra Club",
      description: "A small weekly group session covering algebra fundamentals.",
      level: "middle_school",
      isGroup: true,
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.enrollments)
    .values([
      { id: ids.discussionEnrollmentAreg, courseId: ids.discussionGroupCourse, studentProfileId: ids.studentProfile, status: "active" },
      { id: ids.discussionEnrollmentSona, courseId: ids.discussionGroupCourse, studentProfileId: ids.studentProfile2, status: "active" },
    ])
    .onConflictDoNothing();

  // Matches `services.ts:displayName()`'s "firstName · controlledIdentifier" format exactly, given
  // these fixed profile ids (`shortCode` = last 4 chars of the profile id, uppercased).
  const aregDisplay = "Areg · Student MO_1";
  const sonaDisplay = "Sona · Student MO_2";
  const davitDisplay = "Davit · Tutor MO_1";
  const nvardDisplay = "Nvard · Tutor MO_2";

  await tx
    .insert(schema.discussionTags)
    .values([
      {
        id: ids.discussionTagFractions,
        name: "Fractions",
        slug: "fractions",
        description: "Adding, subtracting, and simplifying fractions.",
        colorToken: "teal",
        usageCount: 2,
      },
      {
        id: ids.discussionTagAlgebra,
        name: "Algebra",
        slug: "algebra",
        description: "Solving and simplifying algebraic expressions and equations.",
        colorToken: "teal",
        usageCount: 3,
      },
      {
        id: ids.discussionTagNumberTheory,
        name: "Number Theory",
        slug: "number-theory",
        description: "Properties of numbers, signs, and operations.",
        colorToken: "teal",
        usageCount: 1,
      },
    ])
    .onConflictDoNothing();

  const dq3CreatedAt = new Date("2026-08-03T10:00:00Z");
  const da3aCreatedAt = new Date("2026-08-03T12:00:00Z");
  const da3aRatedAt = new Date("2026-08-03T17:00:00Z");
  const da3bCreatedAt = new Date("2026-08-03T14:00:00Z");
  const dq3AcceptedAt = new Date("2026-08-03T18:00:00Z");

  const dq4CreatedAt = new Date("2026-08-04T09:00:00Z");
  const da4aCreatedAt = new Date("2026-08-04T10:00:00Z");
  const dq4VerifiedAt = new Date("2026-08-04T11:00:00Z");
  const dq4RatedAt = new Date("2026-08-04T11:05:00Z");
  const dq4AcceptedAt = new Date("2026-08-04T11:10:00Z");

  const dq5CreatedAt = new Date("2026-08-02T09:00:00Z");
  const da5aCreatedAt = new Date("2026-08-02T13:00:00Z");
  const dq5RatedAt = new Date("2026-08-02T14:00:00Z");

  // `acceptedAnswerId`/`duplicateOfQuestionId` are soft references (see discussions.ts) — safe to
  // set here even though the referenced answer rows are inserted in a later statement below.
  await tx
    .insert(schema.discussionQuestions)
    .values([
      {
        id: ids.discussionQuestion1,
        authorUserId: ids.userStudent,
        studentProfileId: ids.studentProfile,
        authorDisplayName: aregDisplay,
        title: "How do I add fractions that have different denominators?",
        slug: "how-do-i-add-fractions-that-have-different-denominators-dq01",
        body: "I have 1/3 + 1/4 and I don't understand how to get a common denominator. Can someone show me the steps?",
        subjectId: ids.subjectMath,
        gradeLevel: "6",
        questionType: "homework_help",
        whatTried: "I tried just adding the top and bottom numbers together, but I don't think that's right.",
        visibility: "private_support",
        status: "open",
        viewCount: 2,
        lastActivityAt: new Date("2026-08-05T14:00:00Z"),
        createdAt: new Date("2026-08-05T14:00:00Z"),
      },
      {
        id: ids.discussionQuestion2,
        authorUserId: ids.userStudent,
        studentProfileId: ids.studentProfile,
        authorDisplayName: aregDisplay,
        title: "Is my work correct for converting 5/8 to a decimal?",
        slug: "is-my-work-correct-for-converting-5-8-to-a-decimal-dq02",
        body: "I got 0.625 by dividing 5 by 8 using long division. Can a tutor check this and let me know if my steps were right?",
        subjectId: ids.subjectMath,
        gradeLevel: "6",
        questionType: "homework_help",
        whatTried: "Long division: 5.000 divided by 8 = 0.625.",
        visibility: "tutors_only",
        status: "needs_tutor_review",
        viewCount: 1,
        lastActivityAt: new Date("2026-08-05T15:30:00Z"),
        createdAt: new Date("2026-08-05T15:30:00Z"),
      },
      {
        id: ids.discussionQuestion3,
        authorUserId: ids.userStudent2,
        studentProfileId: ids.studentProfile2,
        authorDisplayName: sonaDisplay,
        title: "Why does a negative number times a negative number equal a positive number?",
        slug: "why-does-negative-times-negative-equal-positive-dq03",
        body: "My teacher said negative times negative is positive, but I don't understand why. Is there a simple way to think about it?",
        subjectId: ids.subjectMath,
        gradeLevel: "8",
        questionType: "concept_explanation",
        visibility: "community",
        status: "accepted",
        acceptedAnswerId: ids.discussionAnswer3b,
        viewCount: 14,
        lastActivityAt: dq3AcceptedAt,
        createdAt: dq3CreatedAt,
      },
      {
        id: ids.discussionQuestion4,
        authorUserId: ids.userStudent2,
        studentProfileId: ids.studentProfile2,
        authorDisplayName: sonaDisplay,
        title: "Can someone check my work on solving 2x + 5 = 17?",
        slug: "can-someone-check-my-work-solving-2x-plus-5-eq-17-dq04",
        body: "I solved it and got x = 6. Here's my work: 2x + 5 = 17, so 2x = 12, so x = 6. Is this right?",
        subjectId: ids.subjectMath,
        gradeLevel: "8",
        questionType: "check_my_solution",
        visibility: "community",
        status: "tutor_verified",
        acceptedAnswerId: ids.discussionAnswer4a,
        viewCount: 9,
        lastActivityAt: dq4AcceptedAt,
        createdAt: dq4CreatedAt,
      },
      {
        id: ids.discussionQuestion5,
        authorUserId: ids.userStudent2,
        studentProfileId: ids.studentProfile2,
        authorDisplayName: sonaDisplay,
        title: "Group practice: simplify (x^2 - 9) / (x - 3)",
        slug: "group-practice-simplify-x2-9-over-x-3-dq05",
        body: "This is one of our group's practice problems. I factored the top as (x-3)(x+3) but I'm not sure what to do next.",
        subjectId: ids.subjectMath,
        gradeLevel: "8",
        questionType: "homework_help",
        whatTried: "Factored the numerator to (x - 3)(x + 3).",
        visibility: "group_shared",
        relatedClassId: ids.discussionGroupCourse,
        status: "answered",
        viewCount: 6,
        lastActivityAt: dq5RatedAt,
        createdAt: dq5CreatedAt,
      },
      {
        id: ids.discussionQuestion6,
        authorUserId: ids.userStudent,
        studentProfileId: ids.studentProfile,
        authorDisplayName: aregDisplay,
        title: "How to add 1/3 and 1/4?",
        slug: "how-to-add-1-3-and-1-4-dq06",
        body: "I have 1/3 + 1/4 and I'm stuck on the common denominator step.",
        subjectId: ids.subjectMath,
        gradeLevel: "6",
        questionType: "homework_help",
        whatTried: "Not sure where to start.",
        visibility: "private_support",
        status: "duplicate",
        duplicateOfQuestionId: ids.discussionQuestion1,
        viewCount: 1,
        lastActivityAt: new Date("2026-08-06T09:00:00Z"),
        createdAt: new Date("2026-08-06T09:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.discussionAnswers)
    .values([
      {
        id: ids.discussionAnswer3a,
        discussionQuestionId: ids.discussionQuestion3,
        authorUserId: ids.userStudent,
        authorDisplayName: aregDisplay,
        body: "One way I think about it: multiplying by a negative flips direction on the number line. So negative times negative flips twice, which brings you back to the positive direction.",
        isTutorAnswer: false,
        tutorRatingAverage: "4.00",
        tutorRatingCount: 1,
        createdAt: da3aCreatedAt,
        updatedAt: da3aRatedAt,
      },
      {
        id: ids.discussionAnswer3b,
        discussionQuestionId: ids.discussionQuestion3,
        authorUserId: ids.userTutor2,
        authorDisplayName: nvardDisplay,
        body: "Here's a more formal way to see it: multiplication by -1 reflects a number across zero on the number line. Reflecting twice returns every point to where it started, which is the same as leaving it unchanged — and an unchanged positive number stays positive. That's why (-a) x (-b) = a x b.",
        isTutorAnswer: true,
        isAccepted: true,
        createdAt: da3bCreatedAt,
        updatedAt: dq3AcceptedAt,
      },
      {
        id: ids.discussionAnswer4a,
        discussionQuestionId: ids.discussionQuestion4,
        authorUserId: ids.userStudent,
        authorDisplayName: aregDisplay,
        body: "Yes, that's correct! You subtracted 5 from both sides to get 2x = 12, then divided both sides by 2 to isolate x = 6. Great work!",
        isTutorAnswer: false,
        isAccepted: true,
        verificationStatus: "correct",
        verificationNote: "Correct and clearly explained — nice step-by-step breakdown.",
        verifiedByUserId: ids.userTutor,
        verifiedAt: dq4VerifiedAt,
        tutorRatingAverage: "5.00",
        tutorRatingCount: 1,
        createdAt: da4aCreatedAt,
        updatedAt: dq4AcceptedAt,
      },
      {
        id: ids.discussionAnswer5a,
        discussionQuestionId: ids.discussionQuestion5,
        authorUserId: ids.userStudent,
        authorDisplayName: aregDisplay,
        body: "After factoring the top to (x-3)(x+3), you can cancel the (x-3) from the top and bottom, leaving x + 3.",
        isTutorAnswer: false,
        tutorRatingAverage: "2.00",
        tutorRatingCount: 1,
        createdAt: da5aCreatedAt,
        updatedAt: dq5RatedAt,
      },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.discussionHelpfulVotes)
    .values({
      id: ids.discussionHelpfulVote1,
      answerId: ids.discussionAnswer3a,
      voterUserId: ids.userStudent2,
      createdAt: new Date("2026-08-03T12:30:00Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.discussionAnswerTutorRatings)
    .values([
      {
        id: ids.discussionRating3a,
        answerId: ids.discussionAnswer3a,
        tutorId: ids.userTutor,
        tutorDisplayName: davitDisplay,
        rating: 4,
        publicFeedback: "Good intuition using the number line — nice explanation of why the sign flips!",
        createdAt: da3aRatedAt,
        updatedAt: da3aRatedAt,
      },
      {
        id: ids.discussionRating4a,
        answerId: ids.discussionAnswer4a,
        tutorId: ids.userTutor,
        tutorDisplayName: davitDisplay,
        rating: 5,
        publicFeedback: "Clear, step-by-step, and matches the correct answer. Great explanation for a peer!",
        createdAt: dq4RatedAt,
        updatedAt: dq4RatedAt,
      },
      {
        id: ids.discussionRating5a,
        answerId: ids.discussionAnswer5a,
        tutorId: ids.userTutor,
        tutorDisplayName: davitDisplay,
        rating: 2,
        // >= 20 chars and non-vague — required by `rateAnswerSchema` for ratings <= 2.
        publicFeedback: "The algebra step is correct, but explain why canceling (x - 3) is only valid when x is not 3 — that restriction was missing.",
        createdAt: dq5RatedAt,
        updatedAt: dq5RatedAt,
      },
    ])
    .onConflictDoNothing();

  const dc2CreatedAt = new Date("2026-08-04T10:20:00Z");

  await tx
    .insert(schema.discussionComments)
    .values([
      {
        id: ids.discussionComment1,
        authorUserId: ids.userStudent2,
        authorDisplayName: sonaDisplay,
        questionId: ids.discussionQuestion4,
        body: "Thanks for checking — I wasn't sure about the sign when subtracting.",
        createdAt: new Date("2026-08-04T10:15:00Z"),
        updatedAt: new Date("2026-08-04T10:15:00Z"),
      },
      {
        id: ids.discussionComment2,
        authorUserId: ids.userStudent2,
        authorDisplayName: sonaDisplay,
        answerId: ids.discussionAnswer4a,
        body: "This really helped, thank you!",
        createdAt: dc2CreatedAt,
        updatedAt: dc2CreatedAt,
      },
      {
        id: ids.discussionComment3,
        authorUserId: ids.userStudent,
        authorDisplayName: aregDisplay,
        answerId: ids.discussionAnswer4a,
        parentCommentId: ids.discussionComment2,
        body: "Happy to help!",
        createdAt: new Date("2026-08-04T10:30:00Z"),
        updatedAt: new Date("2026-08-04T10:30:00Z"),
      },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.discussionCorrections)
    .values({
      id: ids.discussionCorrection1,
      answerId: ids.discussionAnswer3a,
      proposedById: ids.userTutor2,
      proposedByDisplayName: nvardDisplay,
      issueDescription:
        "The explanation is correct but could be clearer about why 'flipping twice' returns to the original direction.",
      proposedCorrection:
        "Multiplying by -1 reflects a number across zero on the number line. Doing that twice returns every point to its original position — which is the same as not moving it at all — so the result stays positive.",
      explanation: "Adding the geometric 'why' makes the rule stick better than just stating it.",
      status: "accepted",
      authorResponse: "Thanks, that's a much clearer way to put it — I'll think about it that way from now on!",
      createdAt: new Date("2026-08-03T15:00:00Z"),
      updatedAt: new Date("2026-08-03T16:00:00Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.discussionFollows)
    .values({
      id: ids.discussionFollow1,
      userId: ids.userStudent,
      questionId: ids.discussionQuestion3,
      createdAt: new Date("2026-08-03T12:05:00Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.discussionBookmarks)
    .values({
      id: ids.discussionBookmark1,
      userId: ids.userStudent2,
      questionId: ids.discussionQuestion4,
      createdAt: new Date("2026-08-04T11:15:00Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.discussionQuestionTags)
    .values([
      { id: ids.discussionQuestionTag1, questionId: ids.discussionQuestion1, tagId: ids.discussionTagFractions },
      { id: ids.discussionQuestionTag2, questionId: ids.discussionQuestion3, tagId: ids.discussionTagAlgebra },
      { id: ids.discussionQuestionTag3, questionId: ids.discussionQuestion3, tagId: ids.discussionTagNumberTheory },
      { id: ids.discussionQuestionTag4, questionId: ids.discussionQuestion4, tagId: ids.discussionTagAlgebra },
      { id: ids.discussionQuestionTag5, questionId: ids.discussionQuestion5, tagId: ids.discussionTagAlgebra },
      { id: ids.discussionQuestionTag6, questionId: ids.discussionQuestion6, tagId: ids.discussionTagFractions },
    ])
    .onConflictDoNothing();

  await tx
    .insert(schema.abuseReports)
    .values({
      id: ids.discussionReport1,
      reportedByUserId: ids.userTutor,
      targetType: "discussion_question",
      targetId: ids.discussionQuestion6,
      reason: "duplicate",
      details: "Looks identical to an earlier question from the same student.",
      severity: "low",
      status: "open",
      createdAt: new Date("2026-08-06T09:30:00Z"),
      updatedAt: new Date("2026-08-06T09:30:00Z"),
    })
    .onConflictDoNothing();

  await tx
    .insert(schema.discussionNotifications)
    .values([
      {
        id: ids.discussionNotification1,
        recipientId: ids.userStudent,
        actorId: ids.userTutor2,
        type: "answer_correction_suggested",
        questionId: ids.discussionQuestion3,
        answerId: ids.discussionAnswer3a,
        createdAt: new Date("2026-08-03T15:00:00Z"),
      },
      {
        id: ids.discussionNotification2,
        recipientId: ids.userStudent,
        actorId: ids.userStudent2,
        type: "answer_accepted",
        questionId: ids.discussionQuestion4,
        answerId: ids.discussionAnswer4a,
        createdAt: dq4AcceptedAt,
      },
      {
        id: ids.discussionNotification3,
        recipientId: ids.userStudent,
        actorId: ids.userTutor,
        type: "answer_tutor_rated",
        questionId: ids.discussionQuestion4,
        answerId: ids.discussionAnswer4a,
        ratingId: ids.discussionRating4a,
        createdAt: dq4RatedAt,
      },
      {
        id: ids.discussionNotification4,
        recipientId: ids.userStudent,
        actorId: ids.userTutor,
        type: "answer_tutor_rated",
        questionId: ids.discussionQuestion5,
        answerId: ids.discussionAnswer5a,
        ratingId: ids.discussionRating5a,
        createdAt: dq5RatedAt,
        readAt: new Date("2026-08-02T15:00:00Z"),
      },
    ])
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
    console.log("\nadmin@example.com requires MFA to sign in. Add it to an authenticator app:");
    console.log(`  Secret (manual entry): ${DEMO_ADMIN_TOTP_SECRET}`);
    console.log(
      `  otpauth URI: otpauth://totp/2tor:admin@example.com?secret=${DEMO_ADMIN_TOTP_SECRET}&issuer=2tor&algorithm=SHA1&digits=6&period=30`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
