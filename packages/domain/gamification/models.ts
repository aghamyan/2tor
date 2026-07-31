export type GamificationRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface GamificationActor {
  userId: string;
  roles: readonly GamificationRole[];
  studentProfileId?: string;
}

/** Only these trusted learning events can create points. Callers never supply a point amount. */
export type PointEventType =
  | "on_time_assignment"
  | "improvement_over_prior_attempt"
  | "thoughtful_question"
  | "milestone_completed"
  | "approved_peer_help"
  | "project_completed"
  | "attendance";

export type PointEventReason =
  | "assignment_completed"
  | "milestone_achieved"
  | "streak"
  | "challenge"
  | "manual_adjustment"
  | "other";
export type StreakType = "attendance" | "assignment_completion";
export type ChallengeStatus = "upcoming" | "active" | "completed" | "cancelled";

export interface PointEventRecord {
  id: string;
  studentProfileId: string;
  type: PointEventType | "streak_grace";
  points: number;
  reason: PointEventReason;
  referenceId: string;
  createdByUserId: string | null;
  occurredAt: Date;
}

export interface StudentPointBalanceRecord {
  id: string;
  studentProfileId: string;
  totalPoints: number;
  currentLevelId: string | null;
  updatedAt: Date;
}

export interface LevelRecord {
  id: string;
  levelNumber: number;
  name: string;
  minPoints: number;
  createdAt: Date;
}

export interface BadgeRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  createdAt: Date;
}

export interface StudentBadgeRecord {
  id: string;
  studentProfileId: string;
  badgeId: string;
  awardedAt: Date;
  awardedByUserId: string | null;
  createdAt: Date;
}

export interface StreakRecord {
  id: string;
  studentProfileId: string;
  type: StreakType;
  currentCount: number;
  longestCount: number;
  lastIncrementedAt: Date | null;
  updatedAt: Date;
}

export interface ChallengeRecord {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  startAt: Date;
  endAt: Date;
  status: ChallengeStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Deliberately rank-free projection. Challenge progress is personal, never a child leaderboard. */
export interface ChallengeProgressRecord {
  id: string;
  challengeId: string;
  studentProfileId: string;
  score: number;
  joinedAt: Date;
  createdAt: Date;
}

export interface GamificationSummary {
  totalPoints: number;
  level: LevelRecord | null;
  badges: BadgeRecord[];
  streaks: StreakRecord[];
  competitionEnabled: boolean;
  challenges: Array<{ challenge: ChallengeRecord; progress: ChallengeProgressRecord | null }>;
}

export interface GamificationDatabase {
  transaction<T>(operation: (database: GamificationDatabase) => Promise<T>): Promise<T>;
  findPointEventByReference(
    studentProfileId: string,
    referenceId: string,
  ): Promise<PointEventRecord | null>;
  listPointEvents(studentProfileId: string): Promise<PointEventRecord[]>;
  appendPointEvent(event: PointEventRecord): Promise<void>;
  getPointBalance(studentProfileId: string): Promise<StudentPointBalanceRecord | null>;
  savePointBalance(balance: StudentPointBalanceRecord): Promise<void>;
  listLevels(): Promise<LevelRecord[]>;
  upsertLevel(level: LevelRecord): Promise<void>;
  listBadges(): Promise<BadgeRecord[]>;
  upsertBadge(badge: BadgeRecord): Promise<void>;
  listStudentBadges(studentProfileId: string): Promise<StudentBadgeRecord[]>;
  awardBadge(award: StudentBadgeRecord): Promise<void>;
  getStreak(studentProfileId: string, type: StreakType): Promise<StreakRecord | null>;
  saveStreak(streak: StreakRecord): Promise<void>;
  getChallenge(challengeId: string): Promise<ChallengeRecord | null>;
  listChallenges(now: Date): Promise<ChallengeRecord[]>;
  saveChallenge(challenge: ChallengeRecord): Promise<void>;
  getChallengeProgress(
    challengeId: string,
    studentProfileId: string,
  ): Promise<ChallengeProgressRecord | null>;
  saveChallengeProgress(progress: ChallengeProgressRecord): Promise<void>;
  isParentLinkedToStudent(parentUserId: string, studentProfileId: string): Promise<boolean>;
  isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string): Promise<boolean>;
  isCompetitionEnabled(studentProfileId: string): Promise<boolean>;
  setParentCompetitionPreference(
    parentUserId: string,
    studentProfileId: string,
    enabled: boolean,
  ): Promise<void>;
  findStudentProfileIdByUserId(userId: string): Promise<string | null>;
}
