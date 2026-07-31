export type ProjectRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";
export type ProjectStatus = "planned" | "in_progress" | "submitted" | "reviewed" | "completed";
export type ProjectFileScanStatus = "pending" | "clean" | "infected" | "error";
export type PortfolioVisibility = "private" | "parent_only" | "public";

export interface ProjectActor {
  userId: string;
  roles: readonly ProjectRole[];
  studentProfileId?: string;
}

export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  studentProfileId: string;
  roleLabel: string | null;
  joinedAt: Date;
  createdAt: Date;
}

export interface ProjectUpdateRecord {
  id: string;
  projectId: string;
  authorUserId: string;
  note: string;
  progressPercentage: number | null;
  createdAt: Date;
}

export interface ProjectFileRecord {
  id: string;
  projectId: string;
  uploadedByUserId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  virusScanStatus: ProjectFileScanStatus;
  createdAt: Date;
}

export interface ProjectRubricRecord {
  id: string;
  title: string;
  description: string | null;
  createdByUserId: string;
  subjectId: string | null;
  scope: "project";
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectRecord {
  id: string;
  courseId: string | null;
  subjectId: string;
  title: string;
  description: string | null;
  isGroup: boolean;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  createdByUserId: string;
  members: ProjectMemberRecord[];
  updates: ProjectUpdateRecord[];
  files: ProjectFileRecord[];
  rubrics: ProjectRubricRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioItemRecord {
  id: string;
  studentProfileId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  fileKey: string | null;
  linkUrl: string | null;
  visibility: PortfolioVisibility;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioSharingConsentRecord {
  id: string;
  portfolioItemId: string;
  parentProfileId: string;
  consentGivenAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

/** This is deliberately identity-free: public portfolios never include a child's name or photo. */
export interface PublicPortfolioItem {
  id: string;
  title: string;
  description: string | null;
  linkUrl: string | null;
}

export interface ProjectDatabase {
  transaction<T>(operation: (database: ProjectDatabase) => Promise<T>): Promise<T>;
  saveProject(project: ProjectRecord): Promise<void>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  addProjectMember(member: ProjectMemberRecord): Promise<void>;
  addProjectUpdate(update: ProjectUpdateRecord): Promise<void>;
  saveProjectFile(file: ProjectFileRecord): Promise<void>;
  getProjectFile(fileId: string): Promise<ProjectFileRecord | null>;
  updateProjectFileScanStatus(fileId: string, status: ProjectFileScanStatus): Promise<void>;
  saveProjectRubric(rubric: ProjectRubricRecord): Promise<void>;
  getProjectRubric(rubricId: string): Promise<ProjectRubricRecord | null>;
  attachRubric(projectId: string, rubricId: string): Promise<void>;
  savePortfolioItem(item: PortfolioItemRecord): Promise<void>;
  getPortfolioItem(portfolioItemId: string): Promise<PortfolioItemRecord | null>;
  updatePortfolioVisibility(
    portfolioItemId: string,
    visibility: PortfolioVisibility,
  ): Promise<void>;
  savePortfolioSharingConsent(consent: PortfolioSharingConsentRecord): Promise<void>;
  hasActivePortfolioSharingConsent(portfolioItemId: string): Promise<boolean>;
  findStudentProfileIdByUserId(userId: string): Promise<string | null>;
  isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string): Promise<boolean>;
  isParentLinkedToStudent(parentUserId: string, studentProfileId: string): Promise<boolean>;
  findParentProfileIdByUserId(userId: string): Promise<string | null>;
}
