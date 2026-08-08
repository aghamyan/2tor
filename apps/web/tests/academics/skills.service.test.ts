import { describe, expect, it } from "vitest";
import {
  getStudentMasteryMap,
  recordSkillAssessments,
} from "../../../../packages/domain/academics/services";
import { InMemoryAcademicDatabase } from "./support/in-memory-academic-database";

const tutor = { userId: "tutor-1", roles: ["tutor"] as const };
const parent = { userId: "parent-1", roles: ["parent"] as const };

function seededDatabase() {
  const database = new InMemoryAcademicDatabase();
  database.tutorAssignments.add("tutor-1:student-1");
  database.parentLinks.add("parent-1:student-1");
  database.skills.set("skill-1", {
    id: "skill-1",
    subjectId: "subject-math",
    unitId: null,
    orderIndex: 0,
    code: "5.NF.1",
    key: "skill:test:1",
    name: "Adding fractions with unlike denominators",
    description: null,
    masteryCriteria: [],
    misconceptions: [],
    createdByUserId: null,
  });
  return database;
}

function reviewInput(overrides: Partial<Parameters<typeof recordSkillAssessments>[2]> = {}) {
  return {
    studentProfileId: "student-1",
    lessonId: null,
    sharedNote: "Solid lesson today.",
    evidenceType: "tutor_observation" as const,
    visibleToParent: true,
    visibleToStudent: true,
    entries: [
      { skillId: "skill-1", score: 6.5, status: "developing" as const, confidence: null, note: null },
    ],
    ...overrides,
  };
}

describe("recordSkillAssessments", () => {
  it("appends an event and upserts the rollup with an accurate evidence count and trend", async () => {
    const database = seededDatabase();
    await recordSkillAssessments(database, tutor, reviewInput());

    expect(database.skillEvents).toHaveLength(1);
    expect(database.skillEvents[0]).toMatchObject({ skillId: "skill-1", score: "6.5", status: "developing" });

    const firstRecord = await database.getStudentSkillRecord("student-1", "skill-1");
    expect(firstRecord).toMatchObject({ score: "6.5", status: "developing", evidenceCount: 1, trend: "new" });

    await recordSkillAssessments(
      database,
      tutor,
      reviewInput({ entries: [{ skillId: "skill-1", score: 8.2, status: "secure" as const, confidence: null, note: null }] }),
    );

    expect(database.skillEvents).toHaveLength(2);
    const secondRecord = await database.getStudentSkillRecord("student-1", "skill-1");
    expect(secondRecord).toMatchObject({ score: "8.2", status: "secure", evidenceCount: 2, trend: "up" });
  });

  it("never derives status from the score — status is always exactly what the tutor selected", async () => {
    const database = seededDatabase();
    await recordSkillAssessments(
      database,
      tutor,
      reviewInput({ entries: [{ skillId: "skill-1", score: 9.8, status: "needs_attention" as const, confidence: null, note: null }] }),
    );
    const record = await database.getStudentSkillRecord("student-1", "skill-1");
    expect(record?.status).toBe("needs_attention");
  });
});

describe("getStudentMasteryMap visibility", () => {
  it("hides a visibleToParent: false record from a parent, but not from the tutor who recorded it", async () => {
    const database = seededDatabase();
    await recordSkillAssessments(
      database,
      tutor,
      reviewInput({ visibleToParent: false, visibleToStudent: true }),
    );

    const parentView = await getStudentMasteryMap(database, parent, "student-1", "subject-math");
    const parentTopic = [...parentView.domains, { unit: null, topics: parentView.unsorted }]
      .flatMap((domain) => domain.topics)
      .find((topic) => topic.skill.id === "skill-1");
    expect(parentTopic?.record).toBeNull();

    const tutorView = await getStudentMasteryMap(database, tutor, "student-1", "subject-math");
    const tutorTopic = [...tutorView.domains, { unit: null, topics: tutorView.unsorted }]
      .flatMap((domain) => domain.topics)
      .find((topic) => topic.skill.id === "skill-1");
    expect(tutorTopic?.record?.score).toBe("6.5");
  });
});
