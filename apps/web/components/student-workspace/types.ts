export type LearningStatus =
  | "pending"
  | "in-progress"
  | "submitted"
  | "reviewed"
  | "completed"
  | "overdue"
  | "developing"
  | "mastered"
  | "practice";

export interface StudentProfile {
  name: string;
  initials: string;
  level: string;
  focus: string;
  streak: number;
}

export interface LearningTask {
  id: string;
  title: string;
  subject: string;
  duration: string;
  priority: "Next" | "Today" | "Optional";
  status: LearningStatus;
  href: string;
  action: string;
}

export interface SubjectJourney {
  id: string;
  subject: string;
  tutor: string;
  unit: string;
  progress: number;
  recentScore: number;
  milestone: string;
  nextClass: string;
  color: "teal" | "indigo" | "amber";
}

export interface SkillRecord {
  id: string;
  name: string;
  subject: string;
  level: LearningStatus;
  progress: number;
  change: string;
  evidence: string;
}

export interface AssessmentRecord {
  id: string;
  title: string;
  subject: string;
  type: string;
  duration: string;
  due: string;
  attempts: string;
  status: LearningStatus;
  score?: number;
  strongest?: string;
  practice?: string;
}

export interface ProjectRecord {
  id: string;
  title: string;
  subject: string;
  kind: string;
  tutor: string;
  phase: "Planning" | "Research" | "Building" | "Review" | "Completed";
  deadline: string;
  progress: number;
  update: string;
}

export interface ResourceRecord {
  id: string;
  title: string;
  subject: string;
  type: "Video" | "Worksheet" | "Article" | "Interactive" | "Guide" | "Practice set";
  duration: string;
  skill: string;
  assignedBy: string;
  saved: boolean;
  completed: boolean;
}

export interface QuestionRecord {
  id: string;
  title: string;
  subject: string;
  posted: string;
  answers: number;
  verified: boolean;
  related: string;
  resolved: boolean;
}
