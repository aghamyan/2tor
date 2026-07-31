import type {
  PortfolioItemRecord,
  PortfolioSharingConsentRecord,
  ProjectDatabase,
  ProjectFileRecord,
  ProjectMemberRecord,
  ProjectRecord,
  ProjectRubricRecord,
  ProjectUpdateRecord,
} from "../../../../../packages/domain/projects/models";

export class InMemoryProjectDatabase implements ProjectDatabase {
  readonly projects = new Map<string, ProjectRecord>();
  readonly files = new Map<string, ProjectFileRecord>();
  readonly rubrics = new Map<string, ProjectRubricRecord>();
  readonly portfolioItems = new Map<string, PortfolioItemRecord>();
  readonly consents = new Map<string, PortfolioSharingConsentRecord>();
  readonly tutorAssignments = new Set<string>();
  readonly parentLinks = new Set<string>();
  readonly parentProfiles = new Map<string, string>();
  async transaction<T>(operation: (database: ProjectDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async saveProject(project: ProjectRecord) {
    this.projects.set(project.id, project);
  }
  async getProject(projectId: string) {
    return this.projects.get(projectId) ?? null;
  }
  async addProjectMember(member: ProjectMemberRecord) {
    const project = this.projects.get(member.projectId);
    if (project)
      this.projects.set(project.id, { ...project, members: [...project.members, member] });
  }
  async addProjectUpdate(update: ProjectUpdateRecord) {
    const project = this.projects.get(update.projectId);
    if (project)
      this.projects.set(project.id, { ...project, updates: [...project.updates, update] });
  }
  async saveProjectFile(file: ProjectFileRecord) {
    this.files.set(file.id, file);
    const project = this.projects.get(file.projectId);
    if (project) this.projects.set(project.id, { ...project, files: [...project.files, file] });
  }
  async getProjectFile(fileId: string) {
    return this.files.get(fileId) ?? null;
  }
  async updateProjectFileScanStatus(fileId: string, status: ProjectFileRecord["virusScanStatus"]) {
    const file = this.files.get(fileId);
    if (file) this.files.set(fileId, { ...file, virusScanStatus: status });
  }
  async saveProjectRubric(rubric: ProjectRubricRecord) {
    this.rubrics.set(rubric.id, rubric);
  }
  async getProjectRubric(rubricId: string) {
    return this.rubrics.get(rubricId) ?? null;
  }
  async attachRubric(projectId: string, rubricId: string) {
    const project = this.projects.get(projectId);
    const rubric = this.rubrics.get(rubricId);
    if (project && rubric)
      this.projects.set(project.id, { ...project, rubrics: [...project.rubrics, rubric] });
  }
  async savePortfolioItem(item: PortfolioItemRecord) {
    this.portfolioItems.set(item.id, item);
  }
  async getPortfolioItem(portfolioItemId: string) {
    return this.portfolioItems.get(portfolioItemId) ?? null;
  }
  async updatePortfolioVisibility(
    portfolioItemId: string,
    visibility: PortfolioItemRecord["visibility"],
  ) {
    const item = this.portfolioItems.get(portfolioItemId);
    if (item) this.portfolioItems.set(item.id, { ...item, visibility, updatedAt: new Date() });
  }
  async savePortfolioSharingConsent(consent: PortfolioSharingConsentRecord) {
    this.consents.set(consent.id, consent);
  }
  async hasActivePortfolioSharingConsent(portfolioItemId: string) {
    return [...this.consents.values()].some(
      (consent) => consent.portfolioItemId === portfolioItemId && consent.revokedAt === null,
    );
  }
  async findStudentProfileIdByUserId() {
    return null;
  }
  async isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string) {
    return this.tutorAssignments.has(`${tutorUserId}:${studentProfileId}`);
  }
  async isParentLinkedToStudent(parentUserId: string, studentProfileId: string) {
    return this.parentLinks.has(`${parentUserId}:${studentProfileId}`);
  }
  async findParentProfileIdByUserId(userId: string) {
    return this.parentProfiles.get(userId) ?? null;
  }
}
