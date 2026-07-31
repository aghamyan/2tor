import type {
  BadgeRecord,
  ChallengeProgressRecord,
  ChallengeRecord,
  GamificationDatabase,
  LevelRecord,
  PointEventRecord,
  StreakRecord,
  StreakType,
  StudentBadgeRecord,
  StudentPointBalanceRecord,
} from "../../../../../packages/domain/gamification/models";

export class InMemoryGamificationDatabase implements GamificationDatabase {
  readonly pointEvents: PointEventRecord[] = [];
  readonly balances = new Map<string, StudentPointBalanceRecord>();
  readonly levels = new Map<number, LevelRecord>();
  readonly badges = new Map<string, BadgeRecord>();
  readonly awards: StudentBadgeRecord[] = [];
  readonly streaks = new Map<string, StreakRecord>();
  readonly challenges = new Map<string, ChallengeRecord>();
  readonly progress = new Map<string, ChallengeProgressRecord>();
  readonly parentLinks = new Set<string>();
  readonly tutorLinks = new Set<string>();
  readonly studentByUser = new Map<string, string>();
  readonly competitionPreferences = new Map<string, boolean>();

  async transaction<T>(operation: (database: GamificationDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async findPointEventByReference(studentProfileId: string, referenceId: string) {
    return (
      this.pointEvents.find(
        (event) => event.studentProfileId === studentProfileId && event.referenceId === referenceId,
      ) ?? null
    );
  }
  async listPointEvents(studentProfileId: string) {
    return this.pointEvents.filter((event) => event.studentProfileId === studentProfileId);
  }
  async appendPointEvent(event: PointEventRecord) {
    this.pointEvents.push(event);
  }
  async getPointBalance(studentProfileId: string) {
    return this.balances.get(studentProfileId) ?? null;
  }
  async savePointBalance(balance: StudentPointBalanceRecord) {
    this.balances.set(balance.studentProfileId, balance);
  }
  async listLevels() {
    return [...this.levels.values()];
  }
  async upsertLevel(level: LevelRecord) {
    this.levels.set(level.levelNumber, level);
  }
  async listBadges() {
    return [...this.badges.values()];
  }
  async upsertBadge(badge: BadgeRecord) {
    this.badges.set(badge.key, badge);
  }
  async listStudentBadges(studentProfileId: string) {
    return this.awards.filter((award) => award.studentProfileId === studentProfileId);
  }
  async awardBadge(award: StudentBadgeRecord) {
    if (
      !this.awards.some(
        (item) =>
          item.studentProfileId === award.studentProfileId && item.badgeId === award.badgeId,
      )
    )
      this.awards.push(award);
  }
  async getStreak(studentProfileId: string, type: StreakType) {
    return this.streaks.get(`${studentProfileId}:${type}`) ?? null;
  }
  async saveStreak(streak: StreakRecord) {
    this.streaks.set(`${streak.studentProfileId}:${streak.type}`, streak);
  }
  async getChallenge(challengeId: string) {
    return this.challenges.get(challengeId) ?? null;
  }
  async listChallenges() {
    return [...this.challenges.values()];
  }
  async saveChallenge(challenge: ChallengeRecord) {
    this.challenges.set(challenge.id, challenge);
  }
  async getChallengeProgress(challengeId: string, studentProfileId: string) {
    return this.progress.get(`${challengeId}:${studentProfileId}`) ?? null;
  }
  async saveChallengeProgress(progress: ChallengeProgressRecord) {
    this.progress.set(`${progress.challengeId}:${progress.studentProfileId}`, progress);
  }
  async isParentLinkedToStudent(parentUserId: string, studentProfileId: string) {
    return this.parentLinks.has(`${parentUserId}:${studentProfileId}`);
  }
  async isTutorAssignedToStudent(tutorUserId: string, studentProfileId: string) {
    return this.tutorLinks.has(`${tutorUserId}:${studentProfileId}`);
  }
  async isCompetitionEnabled(studentProfileId: string) {
    const parents = [...this.parentLinks]
      .filter((link) => link.endsWith(`:${studentProfileId}`))
      .map((link) => link.slice(0, link.indexOf(":")));
    return (
      parents.length > 0 &&
      parents.every(
        (parent) => this.competitionPreferences.get(`${parent}:${studentProfileId}`) === true,
      )
    );
  }
  async setParentCompetitionPreference(
    parentUserId: string,
    studentProfileId: string,
    enabled: boolean,
  ) {
    this.competitionPreferences.set(`${parentUserId}:${studentProfileId}`, enabled);
  }
  async findStudentProfileIdByUserId(userId: string) {
    return this.studentByUser.get(userId) ?? null;
  }
}
