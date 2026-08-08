export type ContentRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";
export type ResourceType = "document" | "video" | "link" | "worksheet" | "interactive";
export type ResourceStatus = "draft" | "published" | "archived";
export type ResourceOwnership = "company" | "tutor_created" | "third_party_licensed";
export type ResourceVisibility = "everyone" | "grades" | "students";
export type ContentReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type TutorUploadStatus = "pending_review" | "approved" | "rejected";

/** A parent's linked child, as far as content visibility cares. */
export interface GuardianStudentContext {
  studentProfileId: string;
  gradeLevel: string | null;
}

export interface ContentActor {
  userId: string;
  roles: readonly ContentRole[];
  studentProfileId?: string;
  /** Only set when the actor is a student — drives `visibility: 'grades'` matching. */
  gradeLevel?: string | null;
  /** Only set when the actor is a parent — drives `visibility: 'grades'`/`'students'` matching across all linked children. */
  guardianStudents?: readonly GuardianStudentContext[];
}

/** Resolved once per list/lookup so viewer-aware filtering has one shape to reason about.
 *  `scope: "all"` is for tutors/admins/staff who manage the library and must see every
 *  published resource regardless of who it's targeted at. */
export type ResourceViewer =
  | { scope: "all" }
  | { scope: "student"; studentProfileId: string; gradeLevel: string | null }
  | { scope: "parent"; students: readonly GuardianStudentContext[] };
export interface ResourceLinkRecord {
  id: string;
  resourceId: string;
  url: string;
  provider: "youtube" | "other";
  title: string | null;
  createdAt: Date;
}
export interface ResourceRecord {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  type: ResourceType;
  createdByUserId: string;
  ownership: ResourceOwnership;
  status: ResourceStatus;
  visibility: ResourceVisibility;
  /** Only meaningful when `visibility === "grades"`. */
  gradeLevels: string[];
  links: ResourceLinkRecord[];
  tags: string[];
  /** The approved attachment for this resource, if a tutor uploaded one — never a `pending_review`/`rejected` file. */
  file: { id: string; fileName: string; mimeType: string; sizeBytes: number } | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface TutorUploadRecord {
  id: string;
  tutorProfileId: string;
  resourceId: string | null;
  fileKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  rightsConfirmedAt: Date | null;
  status: TutorUploadStatus;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface ContentReportRecord {
  id: string;
  resourceId: string | null;
  reportedByUserId: string;
  reason: string;
  status: ContentReportStatus;
  createdAt: Date;
  updatedAt: Date;
}
export interface ResourceSubjectOption {
  id: string;
  name: string;
}

/** Canonical grade-level codes, matched by exact text equality against `student_profiles.grade_level`
 *  (same free-text convention `discussion_questions.grade_level` already uses — see seed data). */
export const GRADE_LEVEL_OPTIONS = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

export interface ContentDatabase {
  transaction<T>(operation: (database: ContentDatabase) => Promise<T>): Promise<T>;
  saveResource(resource: ResourceRecord): Promise<void>;
  getResource(resourceId: string): Promise<ResourceRecord | null>;
  /** True if a published resource's `visibility` rule admits this viewer — used wherever a single resource is acted on (bookmark, download) outside the list query. */
  isResourceVisibleToViewer(resourceId: string, viewer: ResourceViewer): Promise<boolean>;
  /** Always includes published resources visible to `viewer`; additionally includes `includeDraftsByUserId`'s own drafts so an author can preview unpublished work. */
  listPublishedResources(filters: {
    tag?: string;
    subjectId?: string | null;
    viewer: ResourceViewer;
    includeDraftsByUserId?: string;
  }): Promise<ResourceRecord[]>;
  addBookmark(studentProfileId: string, resourceId: string): Promise<void>;
  removeBookmark(studentProfileId: string, resourceId: string): Promise<void>;
  hasBookmark(studentProfileId: string, resourceId: string): Promise<boolean>;
  listBookmarkedResourceIds(studentProfileId: string): Promise<string[]>;
  saveAssignment(input: {
    id: string;
    resourceId: string;
    studentProfileId: string | null;
    courseId: string | null;
    assignedByUserId: string;
    assignedAt: Date;
    createdAt: Date;
  }): Promise<void>;
  saveTutorUpload(upload: TutorUploadRecord): Promise<void>;
  getTutorUpload(uploadId: string): Promise<TutorUploadRecord | null>;
  listPendingTutorUploads(limit: number): Promise<TutorUploadRecord[]>;
  reviewTutorUpload(
    uploadId: string,
    decision: { status: "approved" | "rejected"; reviewedByUserId: string; reviewedAt: Date },
  ): Promise<void>;
  findTutorProfileIdByUserId(userId: string): Promise<string | null>;
  findStudentProfileIdByUserId(userId: string): Promise<string | null>;
  /** Grade level of the given student, for `visibility: 'grades'` matching — `null` if unset or not a student. */
  getStudentGradeLevel(studentProfileId: string): Promise<string | null>;
  /** All children linked to this parent user, with their grade levels, for `visibility` matching. */
  findGuardianStudentContexts(userId: string): Promise<GuardianStudentContext[]>;
  saveReport(report: ContentReportRecord): Promise<void>;
  listOpenReports(limit: number): Promise<ContentReportRecord[]>;
  deleteLink(linkId: string): Promise<void>;
  listLinksForHealthCheck(limit: number): Promise<ResourceLinkRecord[]>;
  listActiveSubjects(): Promise<ResourceSubjectOption[]>;
}
