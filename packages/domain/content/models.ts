export type ContentRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";
export type ResourceType = "document" | "video" | "link" | "worksheet" | "interactive";
export type ResourceStatus = "draft" | "published" | "archived";
export type ResourceOwnership = "company" | "tutor_created" | "third_party_licensed";
export type ContentReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface ContentActor {
  userId: string;
  roles: readonly ContentRole[];
  studentProfileId?: string;
}
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
  links: ResourceLinkRecord[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
export interface TutorUploadRecord {
  id: string;
  tutorProfileId: string;
  resourceId: string | null;
  fileKey: string | null;
  rightsConfirmedAt: Date | null;
  status: "pending_review" | "approved" | "rejected";
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

export interface ContentDatabase {
  transaction<T>(operation: (database: ContentDatabase) => Promise<T>): Promise<T>;
  saveResource(resource: ResourceRecord): Promise<void>;
  getResource(resourceId: string): Promise<ResourceRecord | null>;
  listPublishedResources(filters?: {
    tag?: string;
    subjectId?: string | null;
  }): Promise<ResourceRecord[]>;
  addBookmark(studentProfileId: string, resourceId: string): Promise<void>;
  removeBookmark(studentProfileId: string, resourceId: string): Promise<void>;
  hasBookmark(studentProfileId: string, resourceId: string): Promise<boolean>;
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
  findTutorProfileIdByUserId(userId: string): Promise<string | null>;
  findStudentProfileIdByUserId(userId: string): Promise<string | null>;
  saveReport(report: ContentReportRecord): Promise<void>;
  listOpenReports(limit: number): Promise<ContentReportRecord[]>;
  deleteLink(linkId: string): Promise<void>;
  listLinksForHealthCheck(limit: number): Promise<ResourceLinkRecord[]>;
}
