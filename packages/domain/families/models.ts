export type FamilyRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface FamilyActor {
  userId: string;
  roles: readonly FamilyRole[];
}

export type FamilyLocale = "en" | "hy";
export type ParentStudentRelationship = "parent" | "guardian";
export type StudentStatus = "active" | "inactive" | "suspended";

export interface ParentProfileRecord {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  contentLanguagePreference: FamilyLocale | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfileRecord {
  id: string;
  userId: string;
  username: string;
  preferredName: string;
  gradeLevel: string | null;
  isAdultLearner: boolean;
  usState: string | null;
  dobYearMonth: string | null;
  ageBand: string | null;
  status: StudentStatus;
  primaryTimezone: string;
  locale: FamilyLocale;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParentStudentLinkRecord {
  id: string;
  parentProfileId: string;
  studentProfileId: string;
  relationship: ParentStudentRelationship;
  isPrimary: boolean;
  createdAt: Date;
}

export interface StudentPreferencesRecord {
  studentProfileId: string;
  preferredLessonStyle: string | null;
  availabilityNotes: string | null;
  notes: string | null;
  updatedAt: Date;
}

export interface StudentFamilySummary {
  id: string;
  parentProfileId: string;
  preferredName: string;
  username: string;
  gradeLevel: string | null;
  ageBand: string | null;
  dobYearMonth: string | null;
  status: StudentStatus;
  relationship: ParentStudentRelationship;
  isPrimary: boolean;
}

export interface StudentFamilyDetail extends StudentFamilySummary {
  userId: string;
  isAdultLearner: boolean;
  usState: string | null;
  primaryTimezone: string;
  locale: FamilyLocale;
  interests: string[];
  preferences: StudentPreferencesRecord | null;
}

export interface FamilyStudentPage {
  items: StudentFamilySummary[];
  nextCursor: string | null;
}

export interface ParentProfileValues {
  fullName: string;
  phone: string | null;
  contentLanguagePreference: FamilyLocale | null;
}

export interface StudentProfileValues {
  preferredName: string;
  gradeLevel: string | null;
  isAdultLearner: boolean;
  usState: string | null;
  dobYearMonth: string | null;
  ageBand: string | null;
}

export interface StudentAccountValues {
  id: string;
  username: string;
  primaryTimezone: string;
  locale: FamilyLocale;
}

export interface NewStudentProfileValues extends StudentProfileValues {
  id: string;
  userId: string;
  status: "inactive";
}

export interface NewParentStudentLinkValues {
  id: string;
  parentProfileId: string;
  studentProfileId: string;
  relationship: ParentStudentRelationship;
  isPrimary: boolean;
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

export interface FamilyDatabase {
  transaction<T>(operation: (database: FamilyDatabase) => Promise<T>): Promise<T>;

  findParentProfileByUserId(userId: string): Promise<ParentProfileRecord | null>;
  findParentProfileById(parentProfileId: string): Promise<ParentProfileRecord | null>;
  createParentProfile(
    id: string,
    userId: string,
    values: ParentProfileValues,
  ): Promise<ParentProfileRecord>;
  updateParentProfile(
    parentProfileId: string,
    values: ParentProfileValues,
  ): Promise<ParentProfileRecord>;

  findStudentById(studentProfileId: string): Promise<StudentProfileRecord | null>;
  findStudentByUsername(username: string): Promise<StudentProfileRecord | null>;
  createStudentAccount(values: StudentAccountValues): Promise<void>;
  createStudentProfile(values: NewStudentProfileValues): Promise<StudentProfileRecord>;
  updateStudentProfile(
    studentProfileId: string,
    values: StudentProfileValues,
  ): Promise<StudentProfileRecord>;

  findLink(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<ParentStudentLinkRecord | null>;
  listLinksForStudent(studentProfileId: string): Promise<ParentStudentLinkRecord[]>;
  createLink(values: NewParentStudentLinkValues): Promise<ParentStudentLinkRecord>;
  deleteLink(linkId: string): Promise<void>;

  listInterests(studentProfileId: string): Promise<string[]>;
  replaceInterests(studentProfileId: string, interests: readonly string[]): Promise<void>;
  getPreferences(studentProfileId: string): Promise<StudentPreferencesRecord | null>;
  savePreferences(
    studentProfileId: string,
    values: Omit<StudentPreferencesRecord, "studentProfileId" | "updatedAt">,
  ): Promise<StudentPreferencesRecord>;

  listStudentsForParent(
    parentProfileId: string,
    cursor: string | null,
    limit: number,
  ): Promise<StudentFamilySummary[]>;
  getStudentForParent(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<StudentFamilySummary | null>;

  appendAudit(values: AuditValues): Promise<void>;
}

export interface FamilyReadiness {
  ready: boolean;
  studentId: string;
  blockers: readonly ("student_not_found" | "missing_parent_link")[];
}
