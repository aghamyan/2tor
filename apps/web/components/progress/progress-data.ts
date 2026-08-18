export type MasteryStatus =
  | "mastered"
  | "secure"
  | "developing"
  | "needs-attention"
  | "not-demonstrated"
  | "not-assessed"
  | "in-progress"
  | "upcoming";

export type Confidence = "low" | "medium" | "high";
export type Trend = "up" | "down" | "steady" | "new";

export interface EvidenceItem {
  id: string;
  date: string;
  type: "Tutor observation" | "Homework" | "Lesson activity" | "Diagnostic" | "Assessment";
  result: string;
  note: string;
  calculation: "automatic" | "tutor";
}

export interface ScoreHistoryItem {
  date: string;
  score: number;
}

export interface TopicProgress {
  id: string;
  code: string;
  name: string;
  description: string;
  score: number | null;
  calculatedScore?: number;
  status: MasteryStatus;
  confidence: Confidence | null;
  evidenceCount: number;
  evidenceSummary: string;
  lastAssessed: string | null;
  trend: Trend;
  trendValue?: number;
  note: string;
  parentSummary: string;
  recommendedAction: string;
  expectedTiming: "Completed" | "Now" | "This term" | "Next term";
  expectedForGrade: boolean;
  overdue?: boolean;
  plannedDate?: string;
  prerequisiteIds?: string[];
  mistakePatterns?: string[];
  lessonPlan?: string;
  evidence?: EvidenceItem[];
  history?: ScoreHistoryItem[];
}

export interface CurriculumDomain {
  id: string;
  name: string;
  description: string;
  topics: TopicProgress[];
}

export const statusLabels: Record<MasteryStatus, string> = {
  mastered: "Mastered",
  secure: "Secure",
  developing: "Developing",
  "needs-attention": "Needs attention",
  "not-demonstrated": "Not demonstrated",
  "not-assessed": "Not assessed",
  "in-progress": "In progress",
  upcoming: "Upcoming",
};

export function domainStats(domain: CurriculumDomain) {
  const assessed = domain.topics.filter((item) => item.score !== null);
  const score = assessed.length
    ? Math.round((assessed.reduce((sum, item) => sum + (item.score ?? 0), 0) / assessed.length) * 10)
    : 0;
  return {
    score,
    mastered: domain.topics.filter((item) => item.status === "mastered").length,
    concerns: domain.topics.filter((item) => ["needs-attention", "not-demonstrated"].includes(item.status)).length,
    unassessed: domain.topics.filter((item) => item.status === "not-assessed").length,
  };
}
