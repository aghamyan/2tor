import type {
  ContentDatabase,
  ContentReportRecord,
  GuardianStudentContext,
  ResourceLinkRecord,
  ResourceRecord,
  ResourceSubjectOption,
  ResourceViewer,
  TutorUploadRecord,
} from "../../../../../packages/domain/content/models";

function viewerGradeLevels(viewer: ResourceViewer): string[] {
  if (viewer.scope === "student") return viewer.gradeLevel ? [viewer.gradeLevel] : [];
  if (viewer.scope === "parent")
    return [...new Set(viewer.students.map((s) => s.gradeLevel).filter((g): g is string => g !== null))];
  return [];
}
function viewerStudentProfileIds(viewer: ResourceViewer): string[] {
  if (viewer.scope === "student") return viewer.studentProfileId ? [viewer.studentProfileId] : [];
  if (viewer.scope === "parent") return viewer.students.map((s) => s.studentProfileId);
  return [];
}

export class InMemoryContentDatabase implements ContentDatabase {
  readonly resources = new Map<string, ResourceRecord>();
  readonly bookmarks = new Set<string>();
  readonly assignments: {
    resourceId: string;
    studentProfileId: string | null;
    courseId: string | null;
  }[] = [];
  readonly uploads = new Map<string, TutorUploadRecord>();
  readonly reports = new Map<string, ContentReportRecord>();
  readonly tutorProfiles = new Map<string, string>();
  readonly subjects: ResourceSubjectOption[] = [];
  readonly studentGradeLevels = new Map<string, string | null>();
  readonly guardianStudents = new Map<string, GuardianStudentContext[]>();
  async transaction<T>(operation: (database: ContentDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async saveResource(resource: ResourceRecord) {
    this.resources.set(resource.id, resource);
  }
  async getResource(resourceId: string) {
    return this.resources.get(resourceId) ?? null;
  }
  async isResourceVisibleToViewer(resourceId: string, viewer: ResourceViewer) {
    const resource = this.resources.get(resourceId);
    if (!resource || resource.status !== "published") return false;
    if (viewer.scope === "all" || resource.visibility === "everyone") return true;
    if (resource.visibility === "grades") {
      const gradeLevels = viewerGradeLevels(viewer);
      return resource.gradeLevels.some((grade) => gradeLevels.includes(grade));
    }
    const studentProfileIds = viewerStudentProfileIds(viewer);
    return this.assignments.some(
      (assignment) =>
        assignment.resourceId === resourceId &&
        assignment.studentProfileId !== null &&
        studentProfileIds.includes(assignment.studentProfileId),
    );
  }
  async listPublishedResources(filters: {
    tag?: string;
    subjectId?: string | null;
    viewer: ResourceViewer;
    includeDraftsByUserId?: string;
  }) {
    const gradeLevels = viewerGradeLevels(filters.viewer);
    const studentProfileIds = viewerStudentProfileIds(filters.viewer);
    return [...this.resources.values()].filter((resource) => {
      const statusOk =
        resource.status === "published" ||
        (filters.includeDraftsByUserId !== undefined &&
          resource.status === "draft" &&
          resource.createdByUserId === filters.includeDraftsByUserId);
      if (!statusOk) return false;
      if (filters.tag && !resource.tags.includes(filters.tag)) return false;
      if (filters.subjectId && resource.subjectId !== filters.subjectId) return false;
      if (filters.viewer.scope === "all") return true;
      if (resource.visibility === "everyone") return true;
      if (resource.visibility === "grades")
        return resource.gradeLevels.some((grade) => gradeLevels.includes(grade));
      return this.assignments.some(
        (assignment) =>
          assignment.resourceId === resource.id &&
          assignment.studentProfileId !== null &&
          studentProfileIds.includes(assignment.studentProfileId),
      );
    });
  }
  async addBookmark(studentProfileId: string, resourceId: string) {
    this.bookmarks.add(`${studentProfileId}:${resourceId}`);
  }
  async removeBookmark(studentProfileId: string, resourceId: string) {
    this.bookmarks.delete(`${studentProfileId}:${resourceId}`);
  }
  async hasBookmark(studentProfileId: string, resourceId: string) {
    return this.bookmarks.has(`${studentProfileId}:${resourceId}`);
  }
  async listBookmarkedResourceIds(studentProfileId: string) {
    return [...this.bookmarks]
      .filter((key) => key.startsWith(`${studentProfileId}:`))
      .map((key) => key.slice(studentProfileId.length + 1));
  }
  async saveAssignment(input: {
    resourceId: string;
    studentProfileId: string | null;
    courseId: string | null;
  }) {
    this.assignments.push(input);
  }
  async saveTutorUpload(upload: TutorUploadRecord) {
    this.uploads.set(upload.id, upload);
  }
  async getTutorUpload(uploadId: string) {
    return this.uploads.get(uploadId) ?? null;
  }
  async listPendingTutorUploads(limit: number) {
    return [...this.uploads.values()].filter((upload) => upload.status === "pending_review").slice(0, limit);
  }
  async reviewTutorUpload(
    uploadId: string,
    decision: { status: "approved" | "rejected"; reviewedByUserId: string; reviewedAt: Date },
  ) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;
    this.uploads.set(uploadId, {
      ...upload,
      status: decision.status,
      reviewedByUserId: decision.reviewedByUserId,
      reviewedAt: decision.reviewedAt,
      updatedAt: decision.reviewedAt,
    });
  }
  async findTutorProfileIdByUserId(userId: string) {
    return this.tutorProfiles.get(userId) ?? null;
  }
  async findStudentProfileIdByUserId() {
    return null;
  }
  async getStudentGradeLevel(studentProfileId: string) {
    return this.studentGradeLevels.get(studentProfileId) ?? null;
  }
  async findGuardianStudentContexts(userId: string) {
    return this.guardianStudents.get(userId) ?? [];
  }
  async saveReport(report: ContentReportRecord) {
    this.reports.set(report.id, report);
  }
  async listOpenReports(limit: number) {
    return [...this.reports.values()]
      .filter((report) => report.status === "open" || report.status === "reviewing")
      .slice(0, limit);
  }
  async deleteLink(linkId: string) {
    for (const resource of this.resources.values())
      this.resources.set(resource.id, {
        ...resource,
        links: resource.links.filter((link) => link.id !== linkId),
      });
  }
  async listLinksForHealthCheck(limit: number): Promise<ResourceLinkRecord[]> {
    return [...this.resources.values()].flatMap((resource) => resource.links).slice(0, limit);
  }
  async listActiveSubjects() {
    return this.subjects;
  }
}
