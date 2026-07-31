export type TutorRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface TutorActor {
  userId: string;
  roles: readonly TutorRole[];
  mfaVerifiedAt?: Date | null;
}

export type TutorProfileStatus = "pending" | "active" | "suspended" | "offboarded";
export type TutorLanguageProficiency = "native" | "fluent" | "conversational";
export type TutorDocumentType =
  "identity" | "education" | "certification" | "background_check" | "other";
export type TutorDocumentStatus = "pending" | "approved" | "rejected";
export type TutorVerificationType =
  "identity" | "education" | "background_check" | "reference" | "safeguarding_training";
export type TutorVerificationStatus = "pending" | "passed" | "failed" | "waived";
export type TutorTrainingType =
  "safeguarding" | "platform_onboarding" | "subject_specific" | "other";
export type TutorTrainingStatus = "assigned" | "in_progress" | "completed" | "expired";

export interface TutorProfileRecord {
  id: string;
  userId: string;
  timeZone: string;
  publicDisplayName: string;
  bio: string | null;
  headline: string | null;
  country: string | null;
  yearsExperience: number | null;
  educationSummary: string | null;
  status: TutorProfileStatus;
  publicProfileApprovedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TutorSubjectRecord {
  subjectId: string;
  key: string;
  name: string;
  isPrimary: boolean;
}

export interface TutorGradeRangeRecord {
  minGrade: number | null;
  maxGrade: number | null;
  includesAdult: boolean;
}

export interface TutorLanguageRecord {
  languageCode: string;
  proficiency: TutorLanguageProficiency;
}

/** A weekly wall-clock rule. The IANA zone is snapshotted from the tutor account on each read. */
export interface TutorAvailabilityRule {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  timeZone: string;
}

/** Exact UTC interval produced for Scheduling; this is read-only and never a reservation. */
export interface TutorAvailabilityUtcWindow {
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  source: "recurring" | "one_time";
  ruleId?: string;
}

export interface TutorDocumentRecord {
  id: string;
  tutorProfileId: string;
  type: TutorDocumentType;
  fileKey: string;
  status: TutorDocumentStatus;
  uploadedAt: Date;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  notes: string | null;
}

/** Structured truth about a check. A `background_check` is only asserted when this type is present. */
export interface TutorVerificationRecord {
  id: string;
  tutorProfileId: string;
  type: TutorVerificationType;
  status: TutorVerificationStatus;
  evidenceRef: string | null;
  verifiedByUserId: string | null;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  notes: string | null;
}

export interface TutorEvaluationRecord {
  id: string;
  evaluatorUserId: string;
  evaluationDate: string;
  score: string | null;
  category: string | null;
  comments: string | null;
}

export interface TutorTrainingRecord {
  id: string;
  trainingType: TutorTrainingType;
  status: TutorTrainingStatus;
  completedAt: Date | null;
  expiresAt: Date | null;
}

export interface TutorSuspensionRecord {
  id: string;
  reason: string;
  startAt: Date;
  endAt: Date | null;
  issuedByUserId: string;
  liftedAt: Date | null;
  liftedByUserId: string | null;
}

export interface TutorProfileInput {
  publicDisplayName: string;
  bio: string | null;
  headline: string | null;
  country: string | null;
  yearsExperience: number | null;
  educationSummary: string | null;
}

export interface TutorCapabilitiesInput {
  subjects: Array<{ subjectId: string; isPrimary: boolean }>;
  gradeRanges: Array<{ minGrade: number | null; maxGrade: number | null; includesAdult: boolean }>;
  languages: Array<{ languageCode: string; proficiency: TutorLanguageProficiency }>;
}

export interface PublicTutorProfile {
  id: string;
  displayName: string;
  bio: string | null;
  headline: string | null;
  country: string | null;
  yearsExperience: number | null;
  educationSummary: string | null;
  subjects: TutorSubjectRecord[];
  gradeRanges: TutorGradeRangeRecord[];
  languages: TutorLanguageRecord[];
}

export interface TutorDatabase {
  transaction<T>(operation: (database: TutorDatabase) => Promise<T>): Promise<T>;
  findTutorProfileByUserId(userId: string): Promise<TutorProfileRecord | null>;
  findTutorProfileById(profileId: string): Promise<TutorProfileRecord | null>;
  createTutorProfile(
    id: string,
    userId: string,
    values: TutorProfileInput,
  ): Promise<TutorProfileRecord>;
  updateTutorProfile(profileId: string, values: TutorProfileInput): Promise<TutorProfileRecord>;
  listSubjects(profileId: string): Promise<TutorSubjectRecord[]>;
  replaceSubjects(profileId: string, values: TutorCapabilitiesInput["subjects"]): Promise<void>;
  listGradeRanges(profileId: string): Promise<TutorGradeRangeRecord[]>;
  replaceGradeRanges(
    profileId: string,
    values: TutorCapabilitiesInput["gradeRanges"],
  ): Promise<void>;
  listLanguages(profileId: string): Promise<TutorLanguageRecord[]>;
  replaceLanguages(profileId: string, values: TutorCapabilitiesInput["languages"]): Promise<void>;
  listAvailability(profileId: string, timeZone: string): Promise<TutorAvailabilityRule[]>;
  replaceAvailability(
    profileId: string,
    values: Omit<TutorAvailabilityRule, "id" | "timeZone">[],
  ): Promise<void>;
  createDocument(
    values: Omit<TutorDocumentRecord, "uploadedAt" | "reviewedByUserId" | "reviewedAt" | "notes">,
  ): Promise<TutorDocumentRecord>;
  findDocument(documentId: string): Promise<TutorDocumentRecord | null>;
  listDocuments(profileId: string): Promise<TutorDocumentRecord[]>;
  listVerifications(profileId: string): Promise<TutorVerificationRecord[]>;
  findVerification(verificationId: string): Promise<TutorVerificationRecord | null>;
  createVerification(
    values: Omit<TutorVerificationRecord, "id" | "verifiedByUserId" | "verifiedAt">,
  ): Promise<TutorVerificationRecord>;
  reviewVerification(
    documentId: string,
    values: Pick<TutorVerificationRecord, "status" | "evidenceRef" | "expiresAt" | "notes"> & {
      verifiedByUserId: string;
      verifiedAt: Date;
    },
  ): Promise<TutorVerificationRecord>;
  listEvaluations(profileId: string): Promise<TutorEvaluationRecord[]>;
  listTraining(profileId: string): Promise<TutorTrainingRecord[]>;
  listSuspensions(profileId: string): Promise<TutorSuspensionRecord[]>;
}
