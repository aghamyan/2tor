/**
 * Deliberately duplicates `@app/auth`'s `Role` union rather than importing it, mirroring
 * `packages/domain/families/models.ts`'s `FamilyRole` — keeps this module's public surface
 * import-free of `@app/auth` so it stays trivially unit-testable with plain object literals.
 * `runtime.ts` (the composition seam) is what bridges a real `@app/auth` `Actor` into this shape.
 */
export type ConsentRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface ConsentActor {
  userId: string;
  roles: readonly ConsentRole[];
}

/** Mirrors `packages/db/src/schema/families.ts`'s `consentMethodEnum` — kept in sync manually. */
export type ConsentMethodKey =
  "signed_form" | "identity_verification" | "video_call" | "payment_card_verification" | "other";

/** Mirrors `packages/db/src/schema/families.ts`'s `studentAccountStatusEnum`. */
export type StudentAccountStatus = "active" | "inactive" | "suspended";

export interface StudentConsentProfile {
  id: string;
  userId: string;
  preferredName: string;
  isAdultLearner: boolean;
  status: StudentAccountStatus;
}

export interface ParentVerificationStatus {
  parentProfileId: string;
  userId: string;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
}

export interface ConsentRecord {
  id: string;
  parentProfileId: string;
  studentProfileId: string | null;
  consentVersion: string;
  method: ConsentMethodKey;
  dataCategories: string[];
  identityEvidenceRef: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface NewConsentRecordValues {
  id: string;
  parentProfileId: string;
  studentProfileId: string;
  consentVersion: string;
  method: ConsentMethodKey;
  dataCategories: readonly string[];
  identityEvidenceRef: string | null;
  grantedAt: Date;
}

/**
 * Structurally compatible with `@app/notifications`'s `NotifyInput`/`notify()`, but declared
 * locally rather than imported. `packages/domain/package.json` does not (yet) declare
 * `@app/notifications` as a dependency — under this workspace's strict pnpm linking, a bare
 * `import ... from "@app/notifications"` inside `packages/domain/**` fails to resolve at runtime
 * (confirmed: `packages/domain/families/runtime.ts`'s pre-existing `@app/auth` import has the
 * identical failure — this is a repo-wide gap, not specific to this module). Editing any
 * `package.json` is outside this module's file scope, so `services.ts` takes a `ConsentNotifier`
 * as an explicit dependency instead of importing the real client. The composition root
 * (`apps/web`, which *does* declare `@app/notifications`) passes the real `notify` function
 * directly — it satisfies this interface as-is, no adapter needed.
 */
export interface ConsentNotification {
  userId: string;
  type: "consent_status";
  data: { status: string };
  relatedEntity?: { type: string; id: string; enduring?: boolean };
}

export interface ConsentNotifier {
  notify(notification: ConsentNotification): Promise<unknown>;
}

export interface AuditValues {
  id: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  previousValue?: unknown;
  newValue?: unknown;
}

export interface ConsentDatabase {
  transaction<T>(operation: (database: ConsentDatabase) => Promise<T>): Promise<T>;

  findParentVerificationStatus(userId: string): Promise<ParentVerificationStatus | null>;

  findStudentConsentProfile(studentProfileId: string): Promise<StudentConsentProfile | null>;
  /** Sets `status` to `"active"`. Throws if the student row no longer exists. */
  activateStudentStatus(studentProfileId: string): Promise<StudentConsentProfile>;

  /** "Valid consent" = at least one record for this student with `revokedAt IS NULL`. */
  hasNonRevokedConsentRecord(studentProfileId: string): Promise<boolean>;
  listConsentRecords(studentProfileId: string): Promise<ConsentRecord[]>;
  insertConsentRecord(values: NewConsentRecordValues): Promise<ConsentRecord>;

  /** The primary linked parent's `users.id`, for the activation notification. `null` if none. */
  findPrimaryParentUserId(studentProfileId: string): Promise<string | null>;

  appendAudit(values: AuditValues): Promise<void>;
}
