import type {
  AuditValues,
  FamilyDatabase,
  NewParentStudentLinkValues,
  NewStudentProfileValues,
  ParentProfileRecord,
  ParentProfileValues,
  ParentStudentLinkRecord,
  StudentAccountValues,
  StudentFamilySummary,
  StudentPreferencesRecord,
  StudentProfileRecord,
  StudentProfileValues,
} from "../../../../../packages/domain/families/models";

function now(): Date {
  return new Date("2026-07-29T12:00:00.000Z");
}

export class InMemoryFamilyDatabase implements FamilyDatabase {
  readonly audits: AuditValues[] = [];
  readonly parents = new Map<string, ParentProfileRecord>();
  readonly students = new Map<string, StudentProfileRecord>();
  readonly links = new Map<string, ParentStudentLinkRecord>();
  readonly interests = new Map<string, string[]>();
  readonly preferences = new Map<string, StudentPreferencesRecord>();
  private readonly accounts = new Map<string, StudentAccountValues>();

  async transaction<T>(operation: (database: FamilyDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findParentProfileByUserId(userId: string) {
    return [...this.parents.values()].find((parent) => parent.userId === userId) ?? null;
  }

  async findParentProfileById(parentProfileId: string) {
    return this.parents.get(parentProfileId) ?? null;
  }

  async createParentProfile(id: string, userId: string, values: ParentProfileValues) {
    const record: ParentProfileRecord = {
      id,
      userId,
      ...values,
      createdAt: now(),
      updatedAt: now(),
    };
    this.parents.set(id, record);
    return record;
  }

  async updateParentProfile(parentProfileId: string, values: ParentProfileValues) {
    const current = this.parents.get(parentProfileId);
    if (!current) throw new Error("parent missing");
    const updated = { ...current, ...values, updatedAt: now() };
    this.parents.set(parentProfileId, updated);
    return updated;
  }

  async findStudentById(studentProfileId: string) {
    return this.students.get(studentProfileId) ?? null;
  }

  async findStudentByUsername(username: string) {
    return [...this.students.values()].find((student) => student.username === username) ?? null;
  }

  async createStudentAccount(values: StudentAccountValues) {
    this.accounts.set(values.id, values);
  }

  async createStudentProfile(values: NewStudentProfileValues) {
    const account = this.accounts.get(values.userId);
    if (!account) throw new Error("account missing");
    const student: StudentProfileRecord = {
      ...values,
      username: account.username,
      primaryTimezone: account.primaryTimezone,
      locale: account.locale,
      createdAt: now(),
      updatedAt: now(),
    };
    this.students.set(values.id, student);
    return student;
  }

  async updateStudentProfile(studentProfileId: string, values: StudentProfileValues) {
    const current = this.students.get(studentProfileId);
    if (!current) throw new Error("student missing");
    const updated = { ...current, ...values, updatedAt: now() };
    this.students.set(studentProfileId, updated);
    return updated;
  }

  async findLink(parentProfileId: string, studentProfileId: string) {
    return (
      [...this.links.values()].find(
        (link) =>
          link.parentProfileId === parentProfileId && link.studentProfileId === studentProfileId,
      ) ?? null
    );
  }

  async listLinksForStudent(studentProfileId: string) {
    return [...this.links.values()].filter((link) => link.studentProfileId === studentProfileId);
  }

  async createLink(values: NewParentStudentLinkValues) {
    const link = { ...values, createdAt: now() };
    this.links.set(link.id, link);
    return link;
  }

  async deleteLink(linkId: string) {
    this.links.delete(linkId);
  }

  async listInterests(studentProfileId: string) {
    return [...(this.interests.get(studentProfileId) ?? [])];
  }

  async replaceInterests(studentProfileId: string, interests: readonly string[]) {
    this.interests.set(studentProfileId, [...interests]);
  }

  async getPreferences(studentProfileId: string) {
    return this.preferences.get(studentProfileId) ?? null;
  }

  async savePreferences(
    studentProfileId: string,
    values: Omit<StudentPreferencesRecord, "studentProfileId" | "updatedAt">,
  ) {
    const record: StudentPreferencesRecord = {
      studentProfileId,
      ...values,
      updatedAt: now(),
    };
    this.preferences.set(studentProfileId, record);
    return record;
  }

  async listStudentsForParent(parentProfileId: string, cursor: string | null, limit: number) {
    return [...this.links.values()]
      .filter((link) => link.parentProfileId === parentProfileId)
      .map((link) => {
        const student = this.students.get(link.studentProfileId);
        if (!student) return null;
        return {
          id: student.id,
          parentProfileId,
          preferredName: student.preferredName,
          username: student.username,
          gradeLevel: student.gradeLevel,
          ageBand: student.ageBand,
          dobYearMonth: student.dobYearMonth,
          status: student.status,
          relationship: link.relationship,
          isPrimary: link.isPrimary,
        } satisfies StudentFamilySummary;
      })
      .filter((student): student is StudentFamilySummary => student !== null)
      .filter((student) => cursor === null || student.id > cursor)
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  async getStudentForParent(parentProfileId: string, studentProfileId: string) {
    const rows = await this.listStudentsForParent(parentProfileId, null, 1000);
    return rows.find((student) => student.id === studentProfileId) ?? null;
  }

  async appendAudit(values: AuditValues) {
    this.audits.push(values);
  }
}
