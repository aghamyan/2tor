import { ulid } from "ulid";
import { GamificationError } from "./errors";
import type {
  BadgeRecord,
  ChallengeProgressRecord,
  ChallengeRecord,
  GamificationActor,
  GamificationDatabase,
  GamificationSummary,
  LevelRecord,
  PointEventRecord,
  PointEventType,
  StreakRecord,
  StreakType,
} from "./models";
import {
  challengeSchema,
  competitionPreferenceSchema,
  pointEventSchema,
  streakGracePeriodSchema,
  type ChallengeInput,
  type CompetitionPreferenceInput,
  type PointEventInput,
  type StreakGracePeriodInput,
} from "./schemas";

/** Fixed policy: sources select an event type, never an amount. Points have no cash value. */
export const POINTS_FOR_EVENT: Readonly<Record<PointEventType, number>> = {
  on_time_assignment: 10,
  improvement_over_prior_attempt: 12,
  thoughtful_question: 6,
  milestone_completed: 20,
  approved_peer_help: 10,
  project_completed: 25,
  attendance: 5,
};

const DEFAULT_LEVELS = [
  { levelNumber: 1, name: "Getting started", minPoints: 0 },
  { levelNumber: 2, name: "Building momentum", minPoints: 50 },
  { levelNumber: 3, name: "Steady learner", minPoints: 150 },
  { levelNumber: 4, name: "Thoughtful builder", minPoints: 300 },
] as const;

const DEFAULT_BADGES = [
  {
    key: "effort_starter",
    name: "Effort starter",
    description: "Kept showing up for meaningful learning work.",
    iconKey: "spark",
  },
  {
    key: "curious_mind",
    name: "Curious mind",
    description: "Asked a thoughtful question.",
    iconKey: "question",
  },
  {
    key: "growth_mindset",
    name: "Growth mindset",
    description: "Improved from an earlier attempt.",
    iconKey: "growth",
  },
  {
    key: "milestone_maker",
    name: "Milestone maker",
    description: "Completed a learning milestone.",
    iconKey: "flag",
  },
  {
    key: "project_finisher",
    name: "Project finisher",
    description: "Brought a project to completion.",
    iconKey: "project",
  },
  {
    key: "steady_steps",
    name: "Steady steps",
    description: "Built a five-day learning streak.",
    iconKey: "path",
  },
] as const;

function hasRole(actor: GamificationActor, ...roles: GamificationActor["roles"][number][]) {
  return roles.some((role) => actor.roles.includes(role));
}

function requireActor(
  actor: GamificationActor | null | undefined,
): asserts actor is GamificationActor {
  if (!actor) throw new GamificationError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}

function isStaff(actor: GamificationActor) {
  return hasRole(actor, "administrator", "super_administrator");
}

async function requireStudentView(
  database: GamificationDatabase,
  actor: GamificationActor,
  studentProfileId: string,
): Promise<void> {
  if (isStaff(actor)) return;
  if (hasRole(actor, "student") && actor.studentProfileId === studentProfileId) return;
  if (
    hasRole(actor, "parent") &&
    (await database.isParentLinkedToStudent(actor.userId, studentProfileId))
  )
    return;
  if (
    hasRole(actor, "tutor") &&
    (await database.isTutorAssignedToStudent(actor.userId, studentProfileId))
  )
    return;
  throw new GamificationError("FORBIDDEN", "You cannot view this learner's progress.", 403);
}

function reasonFor(type: PointEventType): PointEventRecord["reason"] {
  if (type === "on_time_assignment") return "assignment_completed";
  if (type === "milestone_completed") return "milestone_achieved";
  return "other";
}

function sourceReference(type: PointEventType, referenceId: string): string {
  return `gamification:point:${type}:${referenceId}`;
}

function graceReference(type: StreakType, date: string, referenceId: string): string {
  return `gamification:grace:${type}:${date}:${referenceId}`;
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const target = new Date(`${end}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor < target) {
    result.push(utcDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function graceDays(events: PointEventRecord[], type: StreakType): Set<string> {
  const prefix = `gamification:grace:${type}:`;
  return new Set(
    events.flatMap((event) => {
      if (event.type !== "streak_grace" || !event.referenceId.startsWith(prefix)) return [];
      const date = event.referenceId.slice(prefix.length, prefix.length + 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(date) ? [date] : [];
    }),
  );
}

async function ensureDefaultCatalog(database: GamificationDatabase): Promise<void> {
  const now = new Date();
  await Promise.all(
    DEFAULT_LEVELS.map((level) =>
      database.upsertLevel({
        id: `gamification-level-${level.levelNumber}`,
        ...level,
        createdAt: now,
      }),
    ),
  );
  await Promise.all(
    DEFAULT_BADGES.map((badge) =>
      database.upsertBadge({ id: `gamification-badge-${badge.key}`, ...badge, createdAt: now }),
    ),
  );
}

function currentLevel(levels: LevelRecord[], totalPoints: number): LevelRecord | null {
  return (
    [...levels]
      .filter((level) => level.minPoints <= totalPoints)
      .sort((left, right) => right.minPoints - left.minPoints)[0] ?? null
  );
}

async function incrementStreak(
  database: GamificationDatabase,
  studentProfileId: string,
  type: StreakType,
  occurredAt: Date,
): Promise<StreakRecord> {
  const prior = await database.getStreak(studentProfileId, type);
  const currentDay = utcDate(occurredAt);
  if (prior?.lastIncrementedAt && utcDate(prior.lastIncrementedAt) >= currentDay) return prior;

  const now = new Date();
  const beforeDay = prior?.lastIncrementedAt ? utcDate(prior.lastIncrementedAt) : null;
  const markedGraceDays = graceDays(await database.listPointEvents(studentProfileId), type);
  const uninterrupted = beforeDay
    ? daysBetween(beforeDay, currentDay).every((date) => markedGraceDays.has(date))
    : true;
  const currentCount = prior ? (uninterrupted ? prior.currentCount + 1 : 1) : 1;
  const streak: StreakRecord = {
    id: prior?.id ?? ulid(),
    studentProfileId,
    type,
    currentCount,
    longestCount: Math.max(prior?.longestCount ?? 0, currentCount),
    lastIncrementedAt: occurredAt,
    updatedAt: now,
  };
  await database.saveStreak(streak);
  return streak;
}

async function awardEligibleBadges(
  database: GamificationDatabase,
  event: PointEventRecord,
  totalPoints: number,
  streak: StreakRecord | null,
): Promise<BadgeRecord[]> {
  const [catalog, earned] = await Promise.all([
    database.listBadges(),
    database.listStudentBadges(event.studentProfileId),
  ]);
  const earnedIds = new Set(earned.map((award) => award.badgeId));
  const wantedKeys = new Set<string>();
  if (totalPoints >= 50) wantedKeys.add("effort_starter");
  if (event.type === "thoughtful_question") wantedKeys.add("curious_mind");
  if (event.type === "improvement_over_prior_attempt") wantedKeys.add("growth_mindset");
  if (event.type === "milestone_completed") wantedKeys.add("milestone_maker");
  if (event.type === "project_completed") wantedKeys.add("project_finisher");
  if (streak && streak.currentCount >= 5) wantedKeys.add("steady_steps");
  const awarded: BadgeRecord[] = [];
  for (const badge of catalog.filter(
    (candidate) => wantedKeys.has(candidate.key) && !earnedIds.has(candidate.id),
  )) {
    await database.awardBadge({
      id: ulid(),
      studentProfileId: event.studentProfileId,
      badgeId: badge.id,
      awardedAt: event.occurredAt,
      awardedByUserId: event.createdByUserId,
      createdAt: new Date(),
    });
    awarded.push(badge);
  }
  return awarded;
}

export interface RecordPointEventResult {
  event: PointEventRecord;
  balance: number;
  level: LevelRecord | null;
  awardedBadges: BadgeRecord[];
  streak: StreakRecord | null;
  duplicate: boolean;
}

/**
 * The trusted entry point other domains call after they have validated their own source event.
 * It is idempotent by `(studentProfileId, type, referenceId)` and owns both the ledger and its
 * derived balance/streak state. It intentionally accepts no caller-supplied point amount.
 */
export async function recordPointEvent(
  database: GamificationDatabase,
  input: PointEventInput,
): Promise<RecordPointEventResult> {
  const values = pointEventSchema.parse(input);
  const reference = sourceReference(values.type, values.referenceId);
  return database.transaction(async (transaction) => {
    await ensureDefaultCatalog(transaction);
    const existing = await transaction.findPointEventByReference(
      values.studentProfileId,
      reference,
    );
    const levels = await transaction.listLevels();
    const currentBalance = await transaction.getPointBalance(values.studentProfileId);
    if (existing)
      return {
        event: existing,
        balance: currentBalance?.totalPoints ?? 0,
        level: currentLevel(levels, currentBalance?.totalPoints ?? 0),
        awardedBadges: [],
        streak: null,
        duplicate: true,
      };

    const event: PointEventRecord = {
      id: ulid(),
      studentProfileId: values.studentProfileId,
      type: values.type,
      points: POINTS_FOR_EVENT[values.type],
      reason: reasonFor(values.type),
      referenceId: reference,
      createdByUserId: values.createdByUserId,
      occurredAt: values.occurredAt,
    };
    const totalPoints = (currentBalance?.totalPoints ?? 0) + event.points;
    const level = currentLevel(levels, totalPoints);
    await transaction.appendPointEvent(event);
    await transaction.savePointBalance({
      id: currentBalance?.id ?? ulid(),
      studentProfileId: values.studentProfileId,
      totalPoints,
      currentLevelId: level?.id ?? null,
      updatedAt: new Date(),
    });
    const streakType: StreakType | null =
      values.type === "attendance"
        ? "attendance"
        : values.type === "on_time_assignment"
          ? "assignment_completion"
          : null;
    const streak = streakType
      ? await incrementStreak(transaction, values.studentProfileId, streakType, values.occurredAt)
      : null;
    const awardedBadges = await awardEligibleBadges(transaction, event, totalPoints, streak);
    return { event, balance: totalPoints, level, awardedBadges, streak, duplicate: false };
  });
}

/** Records an approved illness/travel absence as neutral streak context; it never removes points or awards a prize. */
export async function recordStreakGracePeriod(
  database: GamificationDatabase,
  input: StreakGracePeriodInput,
): Promise<boolean> {
  const values = streakGracePeriodSchema.parse(input);
  const referenceId = graceReference(values.type, values.date, values.referenceId);
  return database.transaction(async (transaction) => {
    if (await transaction.findPointEventByReference(values.studentProfileId, referenceId))
      return false;
    await transaction.appendPointEvent({
      id: ulid(),
      studentProfileId: values.studentProfileId,
      type: "streak_grace",
      points: 0,
      reason: "streak",
      referenceId,
      createdByUserId: values.createdByUserId,
      occurredAt: new Date(`${values.date}T00:00:00.000Z`),
    });
    return true;
  });
}

export async function setCompetitionPreference(
  database: GamificationDatabase,
  actor: GamificationActor | null | undefined,
  input: CompetitionPreferenceInput,
): Promise<void> {
  requireActor(actor);
  if (!hasRole(actor, "parent"))
    throw new GamificationError(
      "FORBIDDEN",
      "Only a linked parent can change competition settings.",
      403,
    );
  const values = competitionPreferenceSchema.parse(input);
  if (!(await database.isParentLinkedToStudent(actor.userId, values.studentProfileId)))
    throw new GamificationError("FORBIDDEN", "The student is not in this family.", 403);
  await database.setParentCompetitionPreference(
    actor.userId,
    values.studentProfileId,
    values.enabled,
  );
}

export async function getGamificationSummary(
  database: GamificationDatabase,
  actor: GamificationActor | null | undefined,
  studentProfileId: string,
  now = new Date(),
): Promise<GamificationSummary> {
  requireActor(actor);
  await requireStudentView(database, actor, studentProfileId);
  await ensureDefaultCatalog(database);
  const [
    balance,
    levels,
    catalog,
    awards,
    attendance,
    assignments,
    competitionEnabled,
    challenges,
  ] = await Promise.all([
    database.getPointBalance(studentProfileId),
    database.listLevels(),
    database.listBadges(),
    database.listStudentBadges(studentProfileId),
    database.getStreak(studentProfileId, "attendance"),
    database.getStreak(studentProfileId, "assignment_completion"),
    database.isCompetitionEnabled(studentProfileId),
    database.listChallenges(now),
  ]);
  const badgeIds = new Set(awards.map((award) => award.badgeId));
  const available = challenges.filter(
    (challenge) => challenge.status !== "cancelled" && challenge.endAt >= now,
  );
  const progress = await Promise.all(
    available.map(async (challenge) => ({
      challenge,
      progress: await database.getChallengeProgress(challenge.id, studentProfileId),
    })),
  );
  return {
    totalPoints: balance?.totalPoints ?? 0,
    level: currentLevel(levels, balance?.totalPoints ?? 0),
    badges: catalog.filter((badge) => badgeIds.has(badge.id)),
    streaks: [attendance, assignments].filter((streak): streak is StreakRecord => streak !== null),
    competitionEnabled,
    challenges: progress,
  };
}

export async function createSeasonalChallenge(
  database: GamificationDatabase,
  actor: GamificationActor | null | undefined,
  input: ChallengeInput,
): Promise<ChallengeRecord> {
  requireActor(actor);
  if (!isStaff(actor) && !hasRole(actor, "tutor"))
    throw new GamificationError(
      "FORBIDDEN",
      "Only teaching staff can create a seasonal challenge.",
      403,
    );
  const values = challengeSchema.parse(input);
  const now = new Date();
  const status = values.startAt > now ? "upcoming" : values.endAt < now ? "completed" : "active";
  const challenge: ChallengeRecord = {
    id: ulid(),
    ...values,
    status,
    createdByUserId: actor.userId,
    createdAt: now,
    updatedAt: now,
  };
  await database.saveChallenge(challenge);
  return challenge;
}

/** Enrolment is personal progress only. No ranks, comparison queries, or leaderboards are exposed. */
export async function joinSeasonalChallenge(
  database: GamificationDatabase,
  actor: GamificationActor | null | undefined,
  challengeId: string,
  studentProfileId: string,
): Promise<ChallengeProgressRecord> {
  requireActor(actor);
  await requireStudentView(database, actor, studentProfileId);
  const challenge = await database.getChallenge(challengeId);
  if (!challenge)
    throw new GamificationError("CHALLENGE_NOT_FOUND", "Seasonal challenge was not found.", 404);
  const now = new Date();
  if (challenge.status !== "active" || challenge.startAt > now || challenge.endAt < now)
    throw new GamificationError(
      "CHALLENGE_NOT_ACTIVE",
      "This seasonal challenge is not active.",
      409,
    );
  const existing = await database.getChallengeProgress(challengeId, studentProfileId);
  if (existing) return existing;
  const progress: ChallengeProgressRecord = {
    id: ulid(),
    challengeId,
    studentProfileId,
    score: 0,
    joinedAt: now,
    createdAt: now,
  };
  await database.saveChallengeProgress(progress);
  return progress;
}

/** Worker-safe maintenance: determines temporal state only; it never sends engagement prompts. */
export async function reconcileSeasonalChallengeStatuses(
  database: GamificationDatabase,
  now = new Date(),
): Promise<number> {
  const challenges = await database.listChallenges(now);
  let changed = 0;
  for (const challenge of challenges) {
    const status =
      challenge.status === "cancelled"
        ? "cancelled"
        : challenge.endAt < now
          ? "completed"
          : challenge.startAt > now
            ? "upcoming"
            : "active";
    if (challenge.status !== status) {
      await database.saveChallenge({ ...challenge, status, updatedAt: now });
      changed += 1;
    }
  }
  return changed;
}
