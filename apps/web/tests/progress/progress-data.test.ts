import { describe, expect, it } from "vitest";

import { domainStats, statusLabels, type CurriculumDomain, type TopicProgress } from "../../components/progress/progress-data";

function topic(overrides: Partial<TopicProgress> & Pick<TopicProgress, "id" | "status">): TopicProgress {
  return {
    code: overrides.id,
    name: overrides.id,
    description: "",
    score: null,
    confidence: null,
    evidenceCount: 0,
    evidenceSummary: "",
    lastAssessed: null,
    trend: "new",
    note: "",
    parentSummary: "",
    recommendedAction: "",
    expectedTiming: "Now",
    expectedForGrade: true,
    ...overrides,
  };
}

describe("domainStats", () => {
  it("every documented status has a label", () => {
    expect(Object.keys(statusLabels)).toHaveLength(8);
  });

  it("computes a mastery percentage only from assessed (scored) topics", () => {
    const domain: CurriculumDomain = {
      id: "d1",
      name: "Domain",
      description: "",
      topics: [
        topic({ id: "t1", status: "mastered", score: 9 }),
        topic({ id: "t2", status: "secure", score: 7 }),
        topic({ id: "t3", status: "not-assessed", score: null }),
      ],
    };
    const stats = domainStats(domain);
    expect(stats.score).toBe(80);
    expect(stats.mastered).toBe(1);
    expect(stats.unassessed).toBe(1);
  });

  it("counts needs-attention and not-demonstrated as concerns", () => {
    const domain: CurriculumDomain = {
      id: "d1",
      name: "Domain",
      description: "",
      topics: [
        topic({ id: "t1", status: "needs-attention", score: 3 }),
        topic({ id: "t2", status: "not-demonstrated", score: 0 }),
        topic({ id: "t3", status: "mastered", score: 9 }),
      ],
    };
    expect(domainStats(domain).concerns).toBe(2);
  });
});
