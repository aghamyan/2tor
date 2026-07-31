import {
  badges,
  challengeParticipants,
  challenges,
  levels,
  notificationPreferences,
  parentProfiles,
  parentStudentLinks,
  pointEvents,
  studentBadges,
  studentPointBalances,
  studentProfiles,
  streaks,
  tutorProfiles,
  tutorStudentAssignments,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, eq } from "drizzle-orm";
import { ulid } from "ulid";
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
} from "./models";

type Executor = Database | Transaction;

const COMPETITION_CATEGORY_PREFIX = "gamification_competition:";
const COMPETITION_CHANNEL = "in_app" as const;

function pointFromRow(row: typeof pointEvents.$inferSelect): PointEventRecord {
  const type = row.referenceId?.match(/^gamification:point:([^:]+):/)?.[1];
  const grace = row.referenceId?.startsWith("gamification:grace:");
  return {
    id: row.id,
    studentProfileId: row.studentProfileId,
    type: grace ? "streak_grace" : (type as Exclude<PointEventRecord["type"], "streak_grace">),
    points: row.points,
    reason: row.reason,
    referenceId: row.referenceId ?? "",
    createdByUserId: row.createdByUserId,
    occurredAt: row.createdAt,
  };
}

function balanceFromRow(row: typeof studentPointBalances.$inferSelect): StudentPointBalanceRecord {
  return {
    id: row.id,
    studentProfileId: row.studentProfileId,
    totalPoints: row.totalPoints,
    currentLevelId: row.currentLevelId,
    updatedAt: row.updatedAt,
  };
}

function levelFromRow(row: typeof levels.$inferSelect): LevelRecord {
  return {
    id: row.id,
    levelNumber: row.levelNumber,
    name: row.name,
    minPoints: row.minPoints,
    createdAt: row.createdAt,
  };
}

function badgeFromRow(row: typeof badges.$inferSelect): BadgeRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    iconKey: row.iconKey,
    createdAt: row.createdAt,
  };
}

function awardFromRow(row: typeof studentBadges.$inferSelect): StudentBadgeRecord {
  return {
    id: row.id,
    studentProfileId: row.studentProfileId,
    badgeId: row.badgeId,
    awardedAt: row.awardedAt,
    awardedByUserId: row.awardedByUserId,
    createdAt: row.createdAt,
  };
}

function streakFromRow(row: typeof streaks.$inferSelect): StreakRecord {
  return {
    id: row.id,
    studentProfileId: row.studentProfileId,
    type: row.type as StreakType,
    currentCount: row.currentCount,
    longestCount: row.longestCount,
    lastIncrementedAt: row.lastIncrementedAt,
    updatedAt: row.updatedAt,
  };
}

function challengeFromRow(row: typeof challenges.$inferSelect): ChallengeRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subjectId: row.subjectId,
    startAt: row.startAt,
    endAt: row.endAt,
    status: row.status,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function progressFromRow(row: typeof challengeParticipants.$inferSelect): ChallengeProgressRecord {
  return {
    id: row.id,
    challengeId: row.challengeId,
    studentProfileId: row.studentProfileId,
    score: row.score,
    joinedAt: row.joinedAt,
    createdAt: row.createdAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): GamificationDatabase {
  return {
    async transaction<T>(operation: (database: GamificationDatabase) => Promise<T>) {
      return insideTransaction
        ? operation(repository(executor, root, true))
        : root.transaction((tx) => operation(repository(tx, root, true)));
    },
    async findPointEventByReference(studentProfileId, referenceId) {
      const [row] = await executor
        .select()
        .from(pointEvents)
        .where(
          and(
            eq(pointEvents.studentProfileId, studentProfileId),
            eq(pointEvents.referenceId, referenceId),
          ),
        )
        .limit(1);
      return row ? pointFromRow(row) : null;
    },
    async listPointEvents(studentProfileId) {
      const rows = await executor
        .select()
        .from(pointEvents)
        .where(eq(pointEvents.studentProfileId, studentProfileId))
        .orderBy(asc(pointEvents.createdAt));
      return rows.map(pointFromRow);
    },
    async appendPointEvent(event) {
      await executor.insert(pointEvents).values({
        id: event.id,
        studentProfileId: event.studentProfileId,
        points: event.points,
        reason: event.reason,
        referenceId: event.referenceId,
        createdByUserId: event.createdByUserId,
        createdAt: event.occurredAt,
      });
    },
    async getPointBalance(studentProfileId) {
      const [row] = await executor
        .select()
        .from(studentPointBalances)
        .where(eq(studentPointBalances.studentProfileId, studentProfileId))
        .limit(1);
      return row ? balanceFromRow(row) : null;
    },
    async savePointBalance(balance) {
      await executor
        .insert(studentPointBalances)
        .values(balance)
        .onConflictDoUpdate({
          target: studentPointBalances.studentProfileId,
          set: {
            totalPoints: balance.totalPoints,
            currentLevelId: balance.currentLevelId,
            updatedAt: balance.updatedAt,
          },
        });
    },
    async listLevels() {
      return (await executor.select().from(levels).orderBy(asc(levels.minPoints))).map(
        levelFromRow,
      );
    },
    async upsertLevel(level) {
      await executor
        .insert(levels)
        .values(level)
        .onConflictDoUpdate({
          target: levels.levelNumber,
          set: { name: level.name, minPoints: level.minPoints },
        });
    },
    async listBadges() {
      return (await executor.select().from(badges).orderBy(asc(badges.key))).map(badgeFromRow);
    },
    async upsertBadge(badge) {
      await executor
        .insert(badges)
        .values(badge)
        .onConflictDoUpdate({
          target: badges.key,
          set: { name: badge.name, description: badge.description, iconKey: badge.iconKey },
        });
    },
    async listStudentBadges(studentProfileId) {
      return (
        await executor
          .select()
          .from(studentBadges)
          .where(eq(studentBadges.studentProfileId, studentProfileId))
      ).map(awardFromRow);
    },
    async awardBadge(award) {
      await executor
        .insert(studentBadges)
        .values(award)
        .onConflictDoNothing({ target: [studentBadges.studentProfileId, studentBadges.badgeId] });
    },
    async getStreak(studentProfileId, type) {
      const [row] = await executor
        .select()
        .from(streaks)
        .where(and(eq(streaks.studentProfileId, studentProfileId), eq(streaks.type, type)))
        .limit(1);
      return row ? streakFromRow(row) : null;
    },
    async saveStreak(streak) {
      await executor
        .insert(streaks)
        .values(streak)
        .onConflictDoUpdate({
          target: [streaks.studentProfileId, streaks.type],
          set: {
            currentCount: streak.currentCount,
            longestCount: streak.longestCount,
            lastIncrementedAt: streak.lastIncrementedAt,
            updatedAt: streak.updatedAt,
          },
        });
    },
    async getChallenge(challengeId) {
      const [row] = await executor
        .select()
        .from(challenges)
        .where(eq(challenges.id, challengeId))
        .limit(1);
      return row ? challengeFromRow(row) : null;
    },
    async listChallenges() {
      return (await executor.select().from(challenges).orderBy(asc(challenges.startAt))).map(
        challengeFromRow,
      );
    },
    async saveChallenge(challenge) {
      await executor
        .insert(challenges)
        .values(challenge)
        .onConflictDoUpdate({
          target: challenges.id,
          set: {
            title: challenge.title,
            description: challenge.description,
            subjectId: challenge.subjectId,
            startAt: challenge.startAt,
            endAt: challenge.endAt,
            status: challenge.status,
            updatedAt: challenge.updatedAt,
          },
        });
    },
    async getChallengeProgress(challengeId, studentProfileId) {
      const [row] = await executor
        .select()
        .from(challengeParticipants)
        .where(
          and(
            eq(challengeParticipants.challengeId, challengeId),
            eq(challengeParticipants.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return row ? progressFromRow(row) : null;
    },
    async saveChallengeProgress(progress) {
      await executor
        .insert(challengeParticipants)
        .values({ ...progress, rank: null })
        .onConflictDoNothing({
          target: [challengeParticipants.challengeId, challengeParticipants.studentProfileId],
        });
    },
    async isParentLinkedToStudent(parentUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: parentStudentLinks.id })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(
          and(
            eq(parentProfiles.userId, parentUserId),
            eq(parentStudentLinks.studentProfileId, studentProfileId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async isTutorAssignedToStudent(tutorUserId, studentProfileId) {
      const [row] = await executor
        .select({ id: tutorStudentAssignments.id })
        .from(tutorStudentAssignments)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorStudentAssignments.tutorProfileId))
        .where(
          and(
            eq(tutorProfiles.userId, tutorUserId),
            eq(tutorStudentAssignments.studentProfileId, studentProfileId),
            eq(tutorStudentAssignments.status, "active"),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async isCompetitionEnabled(studentProfileId) {
      const linkedParents = await executor
        .select({ userId: parentProfiles.userId })
        .from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(eq(parentStudentLinks.studentProfileId, studentProfileId));
      if (linkedParents.length === 0) return false;
      const preferences = await executor
        .select({
          userId: notificationPreferences.userId,
          isEnabled: notificationPreferences.isEnabled,
        })
        .from(notificationPreferences)
        .where(
          and(
            eq(
              notificationPreferences.category,
              `${COMPETITION_CATEGORY_PREFIX}${studentProfileId}`,
            ),
            eq(notificationPreferences.channel, COMPETITION_CHANNEL),
          ),
        );
      return linkedParents.every((parent) =>
        preferences.some(
          (preference) => preference.userId === parent.userId && preference.isEnabled,
        ),
      );
    },
    async setParentCompetitionPreference(parentUserId, studentProfileId, enabled) {
      await executor
        .insert(notificationPreferences)
        .values({
          id: ulid(),
          userId: parentUserId,
          category: `${COMPETITION_CATEGORY_PREFIX}${studentProfileId}`,
          channel: COMPETITION_CHANNEL,
          isEnabled: enabled,
        })
        .onConflictDoUpdate({
          target: [
            notificationPreferences.userId,
            notificationPreferences.category,
            notificationPreferences.channel,
          ],
          set: { isEnabled: enabled, updatedAt: new Date() },
        });
    },
    async findStudentProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },
  };
}

export function createDrizzleGamificationDatabase(database: Database): GamificationDatabase {
  return repository(database, database, false);
}
