import type {
  ContentDatabase,
  ContentReportRecord,
  ResourceLinkRecord,
  ResourceRecord,
  ResourceSubjectOption,
  TutorUploadRecord,
} from "../../../../../packages/domain/content/models";
export class InMemoryContentDatabase implements ContentDatabase {
  readonly resources = new Map<string, ResourceRecord>();
  readonly bookmarks = new Set<string>();
  readonly assignments: { resourceId: string }[] = [];
  readonly uploads = new Map<string, TutorUploadRecord>();
  readonly reports = new Map<string, ContentReportRecord>();
  readonly tutorProfiles = new Map<string, string>();
  readonly subjects: ResourceSubjectOption[] = [];
  async transaction<T>(operation: (database: ContentDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async saveResource(resource: ResourceRecord) {
    this.resources.set(resource.id, resource);
  }
  async getResource(resourceId: string) {
    return this.resources.get(resourceId) ?? null;
  }
  async listPublishedResources(filters?: { tag?: string; subjectId?: string | null }) {
    return [...this.resources.values()].filter(
      (resource) =>
        resource.status === "published" &&
        (!filters?.tag || resource.tags.includes(filters.tag)) &&
        (!filters?.subjectId || resource.subjectId === filters.subjectId),
    );
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
  async saveAssignment(input: { resourceId: string }) {
    this.assignments.push(input);
  }
  async saveTutorUpload(upload: TutorUploadRecord) {
    this.uploads.set(upload.id, upload);
  }
  async findTutorProfileIdByUserId(userId: string) {
    return this.tutorProfiles.get(userId) ?? null;
  }
  async findStudentProfileIdByUserId() {
    return null;
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
