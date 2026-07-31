import { describe, expect, it } from "vitest";
import { competitionCardIsVisible } from "../../components/gamification/competition-visibility";
import {
  createSeasonalChallenge,
  getGamificationSummary,
  joinSeasonalChallenge,
  recordPointEvent,
  recordStreakGracePeriod,
  setCompetitionPreference,
} from "../../../../packages/domain/gamification/services";
import { InMemoryGamificationDatabase } from "./support/in-memory-gamification-database";

const parent = { userId: "parent-1", roles: ["parent"] as const };
const student = {
  userId: "student-user",
  studentProfileId: "student-1",
  roles: ["student"] as const,
};
const tutor = { userId: "tutor-1", roles: ["tutor"] as const };

describe("gamification services", () => {
  it("hides every competitive surface when a linked parent disables it", async () => {
    const database = new InMemoryGamificationDatabase();
    database.parentLinks.add("parent-1:student-1");
    await setCompetitionPreference(database, parent, {
      studentProfileId: "student-1",
      enabled: true,
    });
    expect((await getGamificationSummary(database, student, "student-1")).competitionEnabled).toBe(
      true,
    );

    await setCompetitionPreference(database, parent, {
      studentProfileId: "student-1",
      enabled: false,
    });
    const summary = await getGamificationSummary(database, student, "student-1");
    expect(summary.competitionEnabled).toBe(false);
    expect(competitionCardIsVisible(summary.competitionEnabled)).toBe(false);
    expect(summary).not.toHaveProperty("leaderboard");
  });

  it("does not break an attendance streak across a marked absence", async () => {
    const database = new InMemoryGamificationDatabase();
    await recordPointEvent(database, {
      studentProfileId: "student-1",
      type: "attendance",
      referenceId: "lesson-monday",
      occurredAt: new Date("2026-08-03T15:00:00.000Z"),
      createdByUserId: "tutor-1",
    });
    await recordStreakGracePeriod(database, {
      studentProfileId: "student-1",
      type: "attendance",
      date: "2026-08-04",
      reason: "illness",
      referenceId: "absence-tuesday",
      createdByUserId: "parent-1",
    });
    const result = await recordPointEvent(database, {
      studentProfileId: "student-1",
      type: "attendance",
      referenceId: "lesson-wednesday",
      occurredAt: new Date("2026-08-05T15:00:00.000Z"),
      createdByUserId: "tutor-1",
    });
    expect(result.streak).toMatchObject({ type: "attendance", currentCount: 2, longestCount: 2 });
  });

  it("uses a fixed private point policy and ignores a delivered source event twice", async () => {
    const database = new InMemoryGamificationDatabase();
    const input = {
      studentProfileId: "student-1",
      type: "improvement_over_prior_attempt" as const,
      referenceId: "attempt-2",
      occurredAt: new Date("2026-08-03T15:00:00.000Z"),
      createdByUserId: "tutor-1",
    };
    const first = await recordPointEvent(database, input);
    const replay = await recordPointEvent(database, input);
    expect(first.event.points).toBe(12);
    expect(replay).toMatchObject({ duplicate: true, balance: 12 });
    expect(database.pointEvents).toHaveLength(1);
  });

  it("lets a learner opt into a seasonal challenge without exposing a rank", async () => {
    const database = new InMemoryGamificationDatabase();
    const now = new Date();
    const challenge = await createSeasonalChallenge(database, tutor, {
      title: "August project sketch",
      description: null,
      subjectId: null,
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 60_000),
    });
    const progress = await joinSeasonalChallenge(database, student, challenge.id, "student-1");
    expect(progress).toMatchObject({
      challengeId: challenge.id,
      studentProfileId: "student-1",
      score: 0,
    });
    expect(progress).not.toHaveProperty("rank");
  });
});
