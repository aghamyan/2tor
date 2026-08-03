import type {
  AssessmentRecord,
  LearningTask,
  ProjectRecord,
  QuestionRecord,
  ResourceRecord,
  SkillRecord,
  StudentProfile,
  SubjectJourney,
} from "./types";

/**
 * Development-only presentation fixtures. Route components use these to exercise the complete
 * student experience locally while the corresponding domain list queries are being connected.
 * Production can replace this module at the page boundary without changing presentational code.
 */
export const demoStudent: StudentProfile = {
  name: "Areg",
  initials: "AA",
  level: "Level 7 · Explorer",
  focus: "Fractions & ratios",
  streak: 4,
};

export const learningTasks: LearningTask[] = [
  {
    id: "fractions-practice",
    title: "Finish fractions practice set",
    subject: "Mathematics",
    duration: "15 min",
    priority: "Next",
    status: "in-progress",
    href: "/assignments",
    action: "Continue",
  },
  {
    id: "feedback-review",
    title: "Review Ani’s lesson feedback",
    subject: "Mathematics",
    duration: "5 min",
    priority: "Today",
    status: "reviewed",
    href: "/academics",
    action: "Read feedback",
  },
  {
    id: "prepare-question",
    title: "Prepare one question for class",
    subject: "Mathematics",
    duration: "3 min",
    priority: "Optional",
    status: "pending",
    href: "/discussions",
    action: "Add question",
  },
];

export const subjectJourneys: SubjectJourney[] = [
  {
    id: "math",
    subject: "Mathematics",
    tutor: "Ani Martirosyan",
    unit: "Fractions and ratios",
    progress: 72,
    recentScore: 88,
    milestone: "Add unlike denominators",
    nextClass: "Tue · 16:30",
    color: "teal",
  },
  {
    id: "english",
    subject: "English",
    tutor: "Mariam Sargsyan",
    unit: "Evidence in persuasive writing",
    progress: 54,
    recentScore: 84,
    milestone: "Build a supported argument",
    nextClass: "Thu · 17:00",
    color: "indigo",
  },
];

export const skills: SkillRecord[] = [
  {
    id: "equivalent",
    name: "Equivalent fractions",
    subject: "Mathematics",
    level: "mastered",
    progress: 94,
    change: "+8%",
    evidence: "Practice set · 18 Jul",
  },
  {
    id: "denominators",
    name: "Adding unlike denominators",
    subject: "Mathematics",
    level: "developing",
    progress: 68,
    change: "+12%",
    evidence: "Tutor review · 25 Jul",
  },
  {
    id: "word-problems",
    name: "Fraction word problems",
    subject: "Mathematics",
    level: "practice",
    progress: 42,
    change: "+3%",
    evidence: "Quiz · 29 Jul",
  },
  {
    id: "thesis",
    name: "Clear thesis statements",
    subject: "English",
    level: "mastered",
    progress: 90,
    change: "+5%",
    evidence: "Essay draft · 22 Jul",
  },
  {
    id: "evidence",
    name: "Using evidence",
    subject: "English",
    level: "developing",
    progress: 63,
    change: "+9%",
    evidence: "Tutor annotation · 30 Jul",
  },
];

export const assessments: AssessmentRecord[] = [
  {
    id: "fractions-check",
    title: "Fractions knowledge check",
    subject: "Mathematics",
    type: "Knowledge check",
    duration: "25 min",
    due: "Due Friday",
    attempts: "1 attempt",
    status: "pending",
  },
  {
    id: "writing-baseline",
    title: "Persuasive writing baseline",
    subject: "English",
    type: "Diagnostic",
    duration: "35 min",
    due: "Completed 24 Jul",
    attempts: "Completed",
    status: "completed",
    score: 84,
    strongest: "Structure",
    practice: "Supporting evidence",
  },
  {
    id: "ratio-quiz",
    title: "Ratios quick quiz",
    subject: "Mathematics",
    type: "Quick quiz",
    duration: "12 min",
    due: "Completed 17 Jul",
    attempts: "2 of 2",
    status: "completed",
    score: 88,
    strongest: "Simplifying ratios",
    practice: "Multi-step problems",
  },
];

export const projects: ProjectRecord[] = [
  {
    id: "budget",
    title: "Plan a balanced weekly budget",
    subject: "Mathematics",
    kind: "Individual project",
    tutor: "Ani Martirosyan",
    phase: "Building",
    deadline: "Due 14 Aug",
    progress: 61,
    update: "Your research notes were reviewed yesterday.",
  },
  {
    id: "heritage",
    title: "Stories from my neighbourhood",
    subject: "English",
    kind: "Group project · 3 learners",
    tutor: "Mariam Sargsyan",
    phase: "Research",
    deadline: "Due 28 Aug",
    progress: 35,
    update: "Two interview questions were added by your team.",
  },
];

export const resources: ResourceRecord[] = [
  {
    id: "fraction-lab",
    title: "Build fractions visually",
    subject: "Mathematics",
    type: "Interactive",
    duration: "12 min",
    skill: "Equivalent fractions",
    assignedBy: "Ani Martirosyan",
    saved: true,
    completed: false,
  },
  {
    id: "denominator-guide",
    title: "A visual guide to common denominators",
    subject: "Mathematics",
    type: "Guide",
    duration: "8 min",
    skill: "Unlike denominators",
    assignedBy: "Ani Martirosyan",
    saved: false,
    completed: false,
  },
  {
    id: "argument-video",
    title: "How strong arguments use evidence",
    subject: "English",
    type: "Video",
    duration: "9 min",
    skill: "Using evidence",
    assignedBy: "Mariam Sargsyan",
    saved: true,
    completed: true,
  },
  {
    id: "ratio-practice",
    title: "Ratios: six focused problems",
    subject: "Mathematics",
    type: "Practice set",
    duration: "15 min",
    skill: "Ratios",
    assignedBy: "Recommended",
    saved: false,
    completed: false,
  },
];

export const questions: QuestionRecord[] = [
  {
    id: "common-denominator",
    title: "Why do denominators need to match before adding?",
    subject: "Mathematics",
    posted: "Yesterday",
    answers: 2,
    verified: true,
    related: "Fractions lesson · 30 Jul",
    resolved: false,
  },
  {
    id: "essay-opening",
    title: "Can I open my essay with a question?",
    subject: "English",
    posted: "24 Jul",
    answers: 1,
    verified: true,
    related: "Persuasive writing",
    resolved: true,
  },
];
