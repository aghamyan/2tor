import type { SkillAssessmentEventRecord } from "../../../../../packages/domain/academics/models";
import type {
  SkillMasteryDomain,
  SkillMasteryTopic,
  StudentMasteryMap,
} from "../../../../../packages/domain/academics/services";
import type { GamificationSummary } from "../../../../../packages/domain/gamification/models";
import type { RewardsSummaryData } from "../../../components/progress/progress-page";
import { statusLabels } from "../../../components/progress/progress-data";
import type {
  CurriculumDomain,
  EvidenceItem,
  MasteryStatus,
  ScoreHistoryItem,
  TopicProgress,
} from "../../../components/progress/progress-data";
import type { TimelineEventData } from "../../../components/progress/progress-page";

/** Converts this domain's `skill_mastery_status` enum values to the UI's kebab-case `MasteryStatus`. */
const STATUS_TO_KEBAB: Record<string, MasteryStatus> = {
  mastered: "mastered",
  secure: "secure",
  developing: "developing",
  needs_attention: "needs-attention",
  not_demonstrated: "not-demonstrated",
  not_assessed: "not-assessed",
  in_progress: "in-progress",
  upcoming: "upcoming",
};

function toKebabStatus(status: string): MasteryStatus {
  return STATUS_TO_KEBAB[status] ?? "not-assessed";
}

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EVIDENCE_TYPE_LABEL: Record<string, EvidenceItem["type"]> = {
  tutor_observation: "Tutor observation",
  homework: "Homework",
  lesson_activity: "Lesson activity",
  diagnostic: "Diagnostic",
  assessment: "Assessment",
};

/**
 * Narrative fields the mock UI invents per topic (`parentSummary`, `recommendedAction`) have no
 * real backing data beyond the tutor's latest note — this is a deliberate simplification, not a
 * missing feature: this build never fabricates commentary the tutor didn't write.
 */
export function toTopicProgress(topic: SkillMasteryTopic): TopicProgress {
  const { skill, record } = topic;
  const score = record?.score != null ? Number(record.score) : null;
  const note = record?.lastNote?.trim() || null;
  return {
    id: skill.id,
    code: skill.code ?? skill.key,
    name: skill.name,
    description: skill.description ?? "",
    score,
    status: toKebabStatus(record?.status ?? "not_assessed"),
    confidence: record?.confidence ?? null,
    evidenceCount: record?.evidenceCount ?? 0,
    evidenceSummary:
      !record || record.evidenceCount === 0
        ? "No evidence recorded yet"
        : `${record.evidenceCount} recorded ${record.evidenceCount === 1 ? "observation" : "observations"}`,
    lastAssessed: formatDate(record?.lastAssessedAt),
    trend: record?.trend ?? "new",
    note: note ?? "Assessment has not been recorded yet.",
    parentSummary: note ?? "The tutor has not recorded evidence for this topic yet.",
    recommendedAction: note ?? "No action needed until this topic is assessed.",
    expectedTiming: record ? "Now" : "This term",
    expectedForGrade: true,
    prerequisiteIds: topic.prerequisiteSkillIds.length ? topic.prerequisiteSkillIds : undefined,
    mistakePatterns: skill.misconceptions.length
      ? skill.misconceptions.map((item) => item.issue)
      : undefined,
  };
}

export function toCurriculumDomains(map: StudentMasteryMap): CurriculumDomain[] {
  const domains: CurriculumDomain[] = map.domains.map((domain: SkillMasteryDomain) => ({
    id: domain.unit.id,
    name: domain.unit.nameEn,
    description: domain.unit.note ?? `${domain.topics.length} topics`,
    topics: domain.topics.map(toTopicProgress),
  }));
  if (map.unsorted.length) {
    domains.push({
      id: "custom",
      name: "Additional topics",
      description: "Topics your tutor added outside the standard curriculum.",
      topics: map.unsorted.map(toTopicProgress),
    });
  }
  return domains;
}

export function toEvidenceItems(events: SkillAssessmentEventRecord[]): EvidenceItem[] {
  return events.map((event) => ({
    id: event.id,
    date: formatDate(event.createdAt) ?? "",
    type: EVIDENCE_TYPE_LABEL[event.evidenceType] ?? "Tutor observation",
    result: event.score != null ? `${Number(event.score).toFixed(1)} / 10` : "Observed",
    note: event.note ?? "",
    calculation: event.calculationMethod,
  }));
}

/** Cross-topic recent activity for the Timeline view. `detail` is always the tutor's own note text — never invented commentary. */
export function toTimelineEvents(
  events: SkillAssessmentEventRecord[],
  skillNameById: Map<string, string>,
): TimelineEventData[] {
  return events.map((event) => {
    const status = toKebabStatus(event.status);
    const name = skillNameById.get(event.skillId) ?? "A topic";
    return {
      date: formatDate(event.createdAt) ?? "",
      type: EVIDENCE_TYPE_LABEL[event.evidenceType] ?? "Tutor observation",
      title: `${name} recorded as ${statusLabels[status]}`,
      detail: event.note?.trim() || "No additional note recorded.",
      topicId: event.skillId,
    };
  });
}

export function toScoreHistory(events: SkillAssessmentEventRecord[]): ScoreHistoryItem[] {
  return events
    .filter((event): event is typeof event & { score: string } => event.score != null)
    .slice()
    .reverse()
    .map((event) => ({ date: formatDate(event.createdAt) ?? "", score: Number(event.score) }));
}

export function toRewardsSummary(summary: GamificationSummary | null): RewardsSummaryData | null {
  if (!summary) return null;
  return {
    totalPoints: summary.totalPoints,
    levelName: summary.level?.name ?? null,
    badges: summary.badges.map((badge) => ({ id: badge.id, name: badge.name, description: badge.description })),
    streaks: summary.streaks.map((streak) => ({
      type: streak.type,
      currentCount: streak.currentCount,
      longestCount: streak.longestCount,
    })),
  };
}
