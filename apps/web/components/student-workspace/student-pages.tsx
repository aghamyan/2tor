"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  BellRing,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Flame,
  FolderKanban,
  Headphones,
  LifeBuoy,
  ListFilter,
  type LucideIcon,
  MessageCircleQuestion,
  MessageSquareText,
  Paperclip,
  PlayCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Video,
} from "lucide-react";

import type { ClassListRecord } from "../../app/(app)/scheduling/queries";
import type { AssignmentListData } from "../../app/(app)/assignments/queries";
import type { AssessmentsPageData } from "../../app/(app)/assessments/queries";
import type { ContentPageData } from "../../app/(app)/content/queries";
import {
  demoStudent,
  learningTasks,
  projects,
  questions,
  skills,
  subjectJourneys,
} from "./fixtures";
import type { LearningStatus } from "./types";
import {
  CardLink,
  EmptyState,
  InsightNote,
  LearningTrail,
  MetricCard,
  PageHeader,
  PrimaryLink,
  ProgressBar,
  ProgressRing,
  SecondaryLink,
  SectionHeader,
  StatusBadge,
  WorkspacePage,
  workspaceStyles as s,
} from "./workspace";

const SHOW_PRESENTATION_FIXTURES = process.env.NODE_ENV !== "production";

function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: readonly string[];
  active: string;
  onChange: (tab: string) => void;
  label: string;
}) {
  return (
    <div className={s.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function formatClassDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function subscribeToQuestionDraft() {
  return () => undefined;
}

function questionDraftSnapshot() {
  return window.localStorage.getItem("2tor-question-draft");
}

function parseQuestionDraft(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { title?: unknown; description?: unknown };
    return typeof parsed.title === "string" && typeof parsed.description === "string"
      ? { title: parsed.title, description: parsed.description }
      : null;
  } catch {
    return null;
  }
}

export function StudentOverviewPage({
  name = demoStudent.name,
  nextLesson,
  nextLessonJoinUrl,
  weekLessonCount = 0,
}: {
  name?: string;
  nextLesson?: {
    id: string;
    subjectId: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    timezoneAtBooking: string;
  } | null;
  nextLessonJoinUrl?: string | null;
  weekLessonCount?: number;
}) {
  const plannedTasks = SHOW_PRESENTATION_FIXTURES ? learningTasks : [];
  const nextLessonDuration = nextLesson
    ? Math.round(
        (new Date(nextLesson.scheduledEndAt).getTime() -
          new Date(nextLesson.scheduledStartAt).getTime()) /
          60_000,
      )
    : 0;
  return (
    <WorkspacePage>
      <section className={s.welcome}>
        <div>
          <p className={s.eyebrow}>Today · Your learning workspace</p>
          <h1>Good afternoon, {name}.</h1>
          <p>
            {plannedTasks.length > 0
              ? `You have ${plannedTasks.length} useful next steps${nextLesson ? " and a lesson coming up." : ". Your class schedule is clear for now."}`
              : nextLesson
                ? "Your next lesson is ready below."
                : "You’re caught up. Choose one useful next step when you’re ready."}
          </p>
        </div>
        {SHOW_PRESENTATION_FIXTURES ? (
          <div className={s.identityCard}>
            <span className={s.avatar}>{demoStudent.initials}</span>
            <div>
              <strong>{demoStudent.focus}</strong>
              <small>{demoStudent.level}</small>
            </div>
            <span className={s.streak}>
              <Flame size={15} aria-hidden="true" /> {demoStudent.streak} days
            </span>
          </div>
        ) : null}
      </section>

      {nextLesson ? (
        <section className={s.nextUp} aria-labelledby="next-up-title">
          <div className={s.nextUpMain}>
            <div className={s.nextUpLabel}>
              <span>Next up</span>
              <strong>{formatClassDate(nextLesson.scheduledStartAt)}</strong>
            </div>
            <div className={s.nextUpTitle}>
              <div className={s.subjectGlyph}>
                <span>{nextLesson.subjectId.slice(0, 1).toUpperCase()}</span>
              </div>
              <div>
                <p>{nextLesson.subjectId}</p>
                <h2 id="next-up-title">Your next scheduled learning session</h2>
                <span>
                  {nextLessonDuration} minutes · {nextLesson.timezoneAtBooking}
                </span>
              </div>
            </div>
            <LearningTrail active={2} />
          </div>
          <div className={s.nextUpAction}>
            <span>Scheduled for</span>
            <strong>
              {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
                new Date(nextLesson.scheduledStartAt),
              )}
            </strong>
            <small>Open the class page for materials and preparation notes.</small>
            {nextLessonJoinUrl ? (
              <a
                className={s.primaryButton}
                href={nextLessonJoinUrl}
                target="_blank"
                rel="noreferrer"
              >
                Join class <Video size={16} />
              </a>
            ) : (
              <PrimaryLink href={`/scheduling/${nextLesson.id}`}>View class</PrimaryLink>
            )}
            <SecondaryLink href="/content">Open materials</SecondaryLink>
          </div>
        </section>
      ) : (
        <section className={s.clearState}>
          <div className={s.emptyIcon}>
            <CalendarDays size={24} />
          </div>
          <div>
            <p className={s.eyebrow}>Next up</p>
            <h2>You’re clear for now.</h2>
            <p>No class is currently scheduled. Keep the momentum with one useful next step.</p>
          </div>
          <div className={s.inlineActions}>
            <PrimaryLink href="/assignments">Continue homework</PrimaryLink>
            <SecondaryLink href="/academics">Review recent lesson</SecondaryLink>
            <SecondaryLink href="/discussions">Ask your tutor</SecondaryLink>
          </div>
        </section>
      )}

      <div className={s.overviewGrid}>
        <section className={s.planCard} aria-labelledby="today-plan-title">
          <SectionHeader
            title="Your learning plan for today"
            description="A focused 23 minutes—then you’re done."
          />
          {plannedTasks.length > 0 ? (
            <ol className={s.taskList}>
              {plannedTasks.map((task, index) => (
              <li key={task.id}>
                <span className={s.taskIndex}>{index + 1}</span>
                <div className={s.taskBody}>
                  <strong>{task.title}</strong>
                  <span>
                    {task.subject} · {task.duration}
                  </span>
                </div>
                <StatusBadge status={task.status} />
                <Link href={task.href}>
                  {task.action}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </li>
              ))}
            </ol>
          ) : (
            <div className={s.planEmpty}>
              <CheckCircle2 aria-hidden="true" size={20} />
              <div>
                <strong>Your plan is clear.</strong>
                <p>New homework, feedback, and lesson preparation will appear here.</p>
              </div>
              <SecondaryLink href="/content">Practice a skill</SecondaryLink>
            </div>
          )}
        </section>

        <aside className={s.weekCard} aria-labelledby="week-title">
          <SectionHeader title="This week" />
          {SHOW_PRESENTATION_FIXTURES ? (
            <>
              <div className={s.weekProgress}>
                <ProgressRing value={78} label="on track" />
                <div>
                  <strong id="week-title">A strong, steady week</strong>
                  <p>You completed every planned lesson and improved two fraction skills.</p>
                </div>
              </div>
              <div className={s.miniMetrics}>
                <span>
                  <b>{weekLessonCount}</b> lessons
                </span>
                <span>
                  <b>87%</b> homework
                </span>
                <span>
                  <b>2h 40m</b> study
                </span>
              </div>
            </>
          ) : (
            <div className={s.weekPending}>
              <strong id="week-title">
                {weekLessonCount > 0
                  ? `${weekLessonCount} ${weekLessonCount === 1 ? "lesson" : "lessons"} this week`
                  : "Your weekly report is taking shape"}
              </strong>
              <p>Completion, study time, and skill trends appear after recorded learning activity.</p>
            </div>
          )}
          <Link className={s.textLink} href="/gamification">
            Open progress report <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <div className={s.twoColumn}>
        <section className={s.feedbackCard}>
          <SectionHeader
            title="Latest tutor feedback"
            action={
              <Link className={s.textLink} href="/academics">
                View all
              </Link>
            }
          />
          {SHOW_PRESENTATION_FIXTURES ? (
            <>
              <div className={s.tutorLine}>
                <span className={s.avatar} data-tone="indigo">
                  AM
                </span>
                <div>
                  <strong>Ani Martirosyan</strong>
                  <small>Fractions practice · Yesterday</small>
                </div>
              </div>
              <blockquote>
                “You explained your thinking clearly and spotted your own mistake. Next, slow down
                when finding the common denominator.”
              </blockquote>
              <div className={s.feedbackPoints}>
                <p>
                  <CheckCircle2 size={16} />{" "}
                  <span>
                    <b>Strength</b> Explaining your method
                  </span>
                </p>
                <p>
                  <Target size={16} />{" "}
                  <span>
                    <b>Work on</b> Checking denominator multiples
                  </span>
                </p>
              </div>
            </>
          ) : (
            <div className={s.feedbackEmpty}>
              <MessageSquareText aria-hidden="true" size={20} />
              <strong>No tutor feedback yet</strong>
              <p>Reviewed lesson and homework notes will collect here.</p>
              <SecondaryLink href="/academics">Open learning journey</SecondaryLink>
            </div>
          )}
        </section>
        <section className={s.quickCard}>
          <SectionHeader title="Quick actions" />
          <div className={s.quickGrid}>
            <CardLink
              href="/assignments"
              eyebrow="Homework"
              title={SHOW_PRESENTATION_FIXTURES ? "Continue practice" : "Open homework"}
              detail={
                SHOW_PRESENTATION_FIXTURES
                  ? "Fractions set · 9 of 15 done"
                  : "See what needs attention next."
              }
              meta={SHOW_PRESENTATION_FIXTURES ? "8 min left" : undefined}
            />
            <CardLink
              href="/discussions"
              eyebrow="Ask"
              title="Ask your tutor"
              detail="Connect it to a class or task."
            />
            <CardLink
              href="/content"
              eyebrow="Library"
              title={SHOW_PRESENTATION_FIXTURES ? "Open resources" : "Browse resources"}
              detail={
                SHOW_PRESENTATION_FIXTURES
                  ? "Four recommendations for you."
                  : "Find guides, videos, and practice."
              }
            />
            <CardLink
              href="/communication"
              eyebrow="Messages"
              title={SHOW_PRESENTATION_FIXTURES ? "Read feedback note" : "Open messages"}
              detail={
                SHOW_PRESENTATION_FIXTURES
                  ? "One unread message from Ani."
                  : "Connect with approved learning contacts."
              }
            />
          </div>
        </section>
      </div>
    </WorkspacePage>
  );
}

export function LearningJourneyPage() {
  const [skillFilter, setSkillFilter] = useState("All skills");
  const visibleSkills =
    skillFilter === "All skills"
      ? skills
      : skills.filter(
          (skill) =>
            skill.level ===
            (
              {
                Mastered: "mastered",
                Developing: "developing",
                "Needs practice": "practice",
              } as const
            )[skillFilter as "Mastered" | "Developing" | "Needs practice"],
        );
  if (!SHOW_PRESENTATION_FIXTURES) {
    return (
      <WorkspacePage>
        <PageHeader
          eyebrow="Progress · Learning record"
          title="Your learning journey"
          description="See what you are learning, where you are improving, and what comes next."
          action={<PrimaryLink href="/scheduling">View next class</PrimaryLink>}
        />
        <EmptyState
          title="Your learning record is ready to grow"
          description="Completed lessons, tutor feedback, skills, and milestones will appear here as they are recorded."
          primary={<PrimaryLink href="/scheduling">Open classes</PrimaryLink>}
          secondary={<SecondaryLink href="/content">Explore resources</SecondaryLink>}
        />
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Progress · Learning record"
        title="Your learning journey"
        description="See what you are learning, where you are improving, and what comes next."
        action={<PrimaryLink href="/scheduling">View next class</PrimaryLink>}
      />
      <section>
        <SectionHeader
          title="Subjects in focus"
          description="Your current units, tutors, and next milestones."
        />
        <div className={s.subjectGrid}>
          {subjectJourneys.map((subject) => (
            <article className={s.subjectCard} data-tone={subject.color} key={subject.id}>
              <header>
                <span>{subject.subject.slice(0, 1)}</span>
                <div>
                  <p>{subject.subject}</p>
                  <small>{subject.tutor}</small>
                </div>
                <strong>{subject.progress}%</strong>
              </header>
              <h3>{subject.unit}</h3>
              <ProgressBar value={subject.progress} label="Unit progress" />
              <dl>
                <div>
                  <dt>Recent score</dt>
                  <dd>{subject.recentScore}%</dd>
                </div>
                <div>
                  <dt>Next class</dt>
                  <dd>{subject.nextClass}</dd>
                </div>
              </dl>
              <footer>
                <span>Next milestone</span>
                <Link href="/scheduling">
                  {subject.milestone}
                  <ChevronRight size={15} />
                </Link>
              </footer>
            </article>
          ))}
        </div>
      </section>
      <div className={s.twoColumnWide}>
        <section className={s.panel}>
          <SectionHeader
            title="Skills map"
            description="Every level links back to recent evidence."
          />
          <Tabs
            tabs={["All skills", "Mastered", "Developing", "Needs practice"]}
            active={skillFilter}
            onChange={setSkillFilter}
            label="Filter skills"
          />
          <div className={s.skillList}>
            {visibleSkills.map((skill) => (
              <article key={skill.id}>
                <div>
                  <strong>{skill.name}</strong>
                  <small>
                    {skill.subject} · {skill.evidence}
                  </small>
                </div>
                <StatusBadge status={skill.level} />
                <span>{skill.change}</span>
                <ProgressBar value={skill.progress} label={skill.name} />
              </article>
            ))}
          </div>
        </section>
        <aside className={s.milestoneCard}>
          <p className={s.eyebrow}>Next milestone</p>
          <h2>Add and subtract fractions independently</h2>
          <p>
            Complete the remaining practice, review Ani’s note, then demonstrate the skill in
            Friday’s check.
          </p>
          <ProgressRing value={68} label="complete" />
          <ul>
            <li data-done="true">Equivalent fractions practice</li>
            <li data-done="true">Tutor-guided examples</li>
            <li>Independent practice set</li>
            <li>Knowledge check</li>
          </ul>
          <PrimaryLink href="/assignments">Continue practice</PrimaryLink>
          <small>Expected by 8 August</small>
        </aside>
      </div>
      <section className={s.panel}>
        <SectionHeader
          title="Recent learning trail"
          description="A record of work, feedback, and progress—not just scores."
        />
        <ol className={s.timeline}>
          <li>
            <span>
              <CheckCircle2 />
            </span>
            <div>
              <strong>Homework reviewed</strong>
              <p>Fractions practice · Ani highlighted two strong explanations.</p>
              <small>
                Yesterday · <Link href="/assignments">View evidence</Link>
              </small>
            </div>
          </li>
          <li>
            <span>
              <MessageSquareText />
            </span>
            <div>
              <strong>Tutor feedback received</strong>
              <p>Focus next on common denominator multiples.</p>
              <small>
                30 Jul · <Link href="/academics">Read feedback</Link>
              </small>
            </div>
          </li>
          <li>
            <span>
              <Star />
            </span>
            <div>
              <strong>Skill mastered</strong>
              <p>Equivalent fractions moved to mastered.</p>
              <small>
                28 Jul · <Link href="/gamification">See progress</Link>
              </small>
            </div>
          </li>
        </ol>
      </section>
    </WorkspacePage>
  );
}

export function StudentClassesPage({ lessons }: { lessons: ClassListRecord[] }) {
  const [tab, setTab] = useState("Upcoming");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [now] = useState(() => Date.now());
  const filtered = lessons.filter((lesson) =>
    tab === "Upcoming"
      ? lesson.status === "scheduled" && new Date(lesson.scheduledStartAt).getTime() >= now
      : tab === "Past"
        ? lesson.status === "completed" || new Date(lesson.scheduledStartAt).getTime() < now
        : lesson.status === "canceled",
  );
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Learning · Schedule"
        title="Classes"
        description="Join upcoming lessons, review past classes, and find everything connected to each lesson."
        action={<SecondaryLink href="/content">Open class materials</SecondaryLink>}
      />
      <div className={s.toolbar}>
        <Tabs
          tabs={["Upcoming", "Past", "Cancelled"]}
          active={tab}
          onChange={setTab}
          label="Class status"
        />
        <div>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            className={s.iconButton}
            onClick={() => setView("list")}
          >
            <ListFilter size={17} />
          </button>
          <button
            type="button"
            aria-label="Calendar view"
            aria-pressed={view === "calendar"}
            className={s.iconButton}
            onClick={() => setView("calendar")}
          >
            <CalendarDays size={17} />
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={tab === "Upcoming" ? "No upcoming classes yet" : `No ${tab.toLowerCase()} classes`}
          description={
            tab === "Upcoming"
              ? "Scheduled lessons will appear here as soon as your tutor or parent books them."
              : "There is nothing in this view right now."
          }
          primary={<PrimaryLink href="/academics">Review past learning</PrimaryLink>}
          secondary={<SecondaryLink href="/support">Contact support</SecondaryLink>}
        />
      ) : (
        <div className={s.classList} data-view={view}>
          {filtered.map((lesson) => {
            const minutes = Math.round(
              (new Date(lesson.scheduledEndAt).getTime() -
                new Date(lesson.scheduledStartAt).getTime()) /
                60000,
            );
            return (
              <article className={s.classCard} key={lesson.id}>
                <div className={s.classDate}>
                  <span>
                    {new Intl.DateTimeFormat(undefined, { month: "short" }).format(
                      new Date(lesson.scheduledStartAt),
                    )}
                  </span>
                  <strong>
                    {new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(
                      new Date(lesson.scheduledStartAt),
                    )}
                  </strong>
                </div>
                <div className={s.classInfo}>
                  <div>
                    <span>{lesson.subjectId}</span>
                    <StatusBadge status={lesson.status === "completed" ? "completed" : "pending"} />
                  </div>
                  <h2>
                    {lesson.status === "completed"
                      ? "Review lesson and tutor notes"
                      : "Your next scheduled learning session"}
                  </h2>
                  <p>
                    <Clock3 size={15} /> {formatClassDate(lesson.scheduledStartAt)} · {minutes} min
                    · {lesson.timezoneAtBooking}
                  </p>
                  <div className={s.classMeta}>
                    <span>
                      <FileText size={14} /> Materials available
                    </span>
                    <span>
                      <CheckCircle2 size={14} /> Homework connected
                    </span>
                  </div>
                </div>
                <div className={s.classActions}>
                  {lesson.status === "scheduled" && lesson.joinUrl ? (
                    <a
                      className={s.primaryButton}
                      href={lesson.joinUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Join class <Video size={16} />
                    </a>
                  ) : (
                    <PrimaryLink href={`/scheduling/${lesson.id}`}>Review lesson</PrimaryLink>
                  )}
                  <SecondaryLink href={`/scheduling/${lesson.id}`}>View details</SecondaryLink>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </WorkspacePage>
  );
}

function assignmentState(item: AssignmentListData["page"]["items"][number]): string {
  if (item.submissionStatus === "graded") return "Reviewed";
  if (item.submissionStatus === "submitted") return "Submitted";
  if (item.dueAt && new Date(item.dueAt).getTime() < Date.now()) return "Overdue";
  if (item.submissionStatus === "in_progress" || item.submissionStatus === "returned")
    return "In progress";
  return "To do";
}
export function StudentHomeworkPage({ data }: { data: AssignmentListData }) {
  const [tab, setTab] = useState("To do");
  const tabs = ["To do", "In progress", "Submitted", "Reviewed", "Overdue"];
  const visible = data.page.items.filter((item) => assignmentState(item) === tab);
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Learning · Coursework"
        title="Homework"
        description="See what needs attention, submit your work, and review tutor feedback."
        action={<SecondaryLink href="/academics">Review feedback</SecondaryLink>}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Homework status" />
      {visible.length === 0 ? (
        <EmptyState
          title={tab === "To do" ? "You’re caught up" : `No homework ${tab.toLowerCase()}`}
          description="Review recent feedback or practice a developing skill while you wait."
          primary={<PrimaryLink href="/academics">Review feedback</PrimaryLink>}
          secondary={<SecondaryLink href="/content">Practice a skill</SecondaryLink>}
        />
      ) : (
        <div className={s.assignmentGrid}>
          {visible.map((item) => {
            const state = assignmentState(item);
            const status: LearningStatus =
              state === "Reviewed"
                ? "reviewed"
                : state === "Submitted"
                  ? "submitted"
                  : state === "Overdue"
                    ? "overdue"
                    : state === "In progress"
                      ? "in-progress"
                      : "pending";
            return (
              <article className={s.assignmentCard} key={item.id}>
                <header>
                  <span>{item.subjectName ?? "Learning task"}</span>
                  <StatusBadge status={status} />
                </header>
                <h2>{item.title}</h2>
                <p>Connected to your latest lesson · Tutor assignment</p>
                <div className={s.assignmentMeta}>
                  <span>
                    <CalendarDays size={15} />{" "}
                    {item.dueAt
                      ? `Due ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(item.dueAt))}`
                      : "No due date"}
                  </span>
                  <span>
                    <Clock3 size={15} /> 15–20 min
                  </span>
                </div>
                {item.score !== null && item.maxScore !== null ? (
                  <div className={s.scoreLine}>
                    <strong>
                      {item.score}/{item.maxScore}
                    </strong>
                    <span>See what worked and what to improve.</span>
                  </div>
                ) : (
                  <ProgressBar
                    value={item.submissionStatus === "in_progress" ? 45 : 0}
                    label="Assignment progress"
                  />
                )}
                <PrimaryLink href={`/assignments/${item.id}`}>
                  {status === "reviewed"
                    ? "Review feedback"
                    : status === "submitted"
                      ? "View submission"
                      : status === "in-progress"
                        ? "Continue"
                        : "Start assignment"}
                </PrimaryLink>
              </article>
            );
          })}
        </div>
      )}
    </WorkspacePage>
  );
}

function formatAssessmentType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function AssessmentsPage({ assessments }: { assessments: AssessmentsPageData["assessments"] }) {
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Learning · Evaluations"
        title="Assessments"
        description="Complete evaluations your tutor has published for you, then review results and what to practice next."
        action={<SecondaryLink href="/content">Preparation resources</SecondaryLink>}
      />
      {assessments.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="When your tutor publishes an assessment, it will appear here."
          primary={<PrimaryLink href="/content">Review preparation resources</PrimaryLink>}
          secondary={<SecondaryLink href="/academics">View learning goals</SecondaryLink>}
        />
      ) : (
        <div className={s.assessmentGrid}>
          {assessments.map((a) => (
            <article className={s.assessmentCard} key={a.id}>
              <header>
                <span>{formatAssessmentType(a.type)}</span>
              </header>
              <h2>{a.title}</h2>
              <p>{a.description ?? "No description provided."}</p>
              <PrimaryLink href={`/assessments/${a.id}`}>Start assessment</PrimaryLink>
            </article>
          ))}
        </div>
      )}
    </WorkspacePage>
  );
}

export function ProjectsPage() {
  const [tab, setTab] = useState("Active");
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const availableProjects = SHOW_PRESENTATION_FIXTURES ? projects : [];
  const visible = availableProjects.filter((p) =>
    tab === "Active" ? p.phase !== "Completed" : p.phase === "Completed",
  );
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Learning · Applied work"
        title="Projects"
        description="Build meaningful work, collaborate safely, and show what you have learned."
        action={<PrimaryLink href="/discussions">Ask about a project</PrimaryLink>}
      />
      <Tabs
        tabs={["Active", "Completed", "Portfolio"]}
        active={tab}
        onChange={setTab}
        label="Project view"
      />
      {visible.length === 0 ? (
        <EmptyState
          title={
            tab === "Portfolio"
              ? "Your portfolio is ready for its first project"
              : tab === "Active"
                ? "No active projects"
                : "No completed projects yet"
          }
          description="Finished work will collect here with its skills, tutor note, and visibility setting."
          primary={<PrimaryLink href="/content">Explore example projects</PrimaryLink>}
          secondary={<SecondaryLink href="/discussions">Ask your tutor</SecondaryLink>}
        />
      ) : (
        <div className={s.projectGrid}>
          {visible.map((p) => (
            <article className={s.projectCard} key={p.id}>
              <div className={s.projectArt}>
                <FolderKanban size={28} />
                <span>{p.subject}</span>
              </div>
              <div className={s.projectBody}>
                <header>
                  <span>{p.kind}</span>
                  <b>{p.phase}</b>
                </header>
                <h2>{p.title}</h2>
                <p>{p.update}</p>
                <ProgressBar value={p.progress} label={`${p.phase} phase`} />
                <dl>
                  <div>
                    <dt>Tutor</dt>
                    <dd>{p.tutor}</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{p.deadline}</dd>
                  </div>
                </dl>
                <div className={s.inlineActions}>
                  <button
                    className={s.primaryButton}
                    type="button"
                    aria-expanded={openProjectId === p.id}
                    onClick={() => setOpenProjectId((current) => (current === p.id ? null : p.id))}
                  >
                    {openProjectId === p.id ? "Close project" : "Open project"}
                  </button>
                </div>
                {openProjectId === p.id ? (
                  <div className={s.projectDetails}>
                    <strong>Current milestone</strong>
                    <p>
                      Finish the working draft, attach one source, and ask your tutor for review.
                    </p>
                    <div className={s.inlineActions}>
                      <SecondaryLink href="/content">Open project files</SecondaryLink>
                      <SecondaryLink href="/discussions">Ask your tutor</SecondaryLink>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
      <details className={s.privacyStrip}>
        <ShieldCheck size={18} />
        <summary>
          <strong>Your work stays private by default.</strong> You choose what appears in your
          portfolio.
        </summary>
        <p>
          Only approved tutors and connected parents can see active work. Portfolio publishing
          requires an explicit visibility choice.
        </p>
      </details>
    </WorkspacePage>
  );
}

export function ProgressPage() {
  const [period, setPeriod] = useState("This month");
  if (!SHOW_PRESENTATION_FIXTURES) {
    return (
      <WorkspacePage>
        <PageHeader
          eyebrow="Progress · Evidence"
          title="Progress"
          description="See how your skills, consistency, and confidence are growing."
          action={<SecondaryLink href="/academics">Open learning journey</SecondaryLink>}
        />
        <EmptyState
          title="Your progress report is taking shape"
          description="Skill trends, completion rates, and tutor observations will appear after recorded learning activity."
          primary={<PrimaryLink href="/scheduling">Open classes</PrimaryLink>}
          secondary={<SecondaryLink href="/content">Practice a skill</SecondaryLink>}
        />
      </WorkspacePage>
    );
  }
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Progress · Evidence"
        title="Progress"
        description="See how your skills, consistency, and confidence are growing."
        action={<SecondaryLink href="/academics">Open learning journey</SecondaryLink>}
      />
      <Tabs
        tabs={["This week", "This month", "This term", "All time"]}
        active={period}
        onChange={setPeriod}
        label="Progress period"
      />
      <div className={s.metricGrid}>
        <MetricCard
          label="Lessons completed"
          value="11"
          detail="2 more than last month"
          tone="positive"
        />
        <MetricCard
          label="Homework completion"
          value="87%"
          detail="9 of 10 on time"
          tone="positive"
        />
        <MetricCard label="Average assessment" value="86%" detail="Up 7 points" tone="positive" />
        <MetricCard label="Skills mastered" value="8" detail="2 newly mastered" />
      </div>
      <div className={s.progressLayout}>
        <section className={s.chartCard}>
          <SectionHeader
            title="Learning trend"
            description="Your own progress over time, compared with your previous work."
          />
          <div
            className={s.chart}
            role="img"
            aria-label="Scores increased from 68 to 88 percent across six recent learning checks"
          >
            <span style={{ height: "38%" }} />
            <span style={{ height: "48%" }} />
            <span style={{ height: "55%" }} />
            <span style={{ height: "63%" }} />
            <span style={{ height: "72%" }} />
            <span style={{ height: "82%" }} />
            <div className={s.chartLine} />
          </div>
          <div className={s.chartLabels}>
            <span>Jun 15</span>
            <span>Jul 1</span>
            <span>Jul 15</span>
            <span>Now</span>
          </div>
          <InsightNote>
            Your scores are rising most when you complete a short review within 24 hours of class.
          </InsightNote>
        </section>
        <aside className={s.observationCard}>
          <div className={s.tutorLine}>
            <span className={s.avatar}>AM</span>
            <div>
              <strong>Ani’s observation</strong>
              <small>Updated 30 July</small>
            </div>
          </div>
          <h2>“Areg is explaining the why, not just the answer.”</h2>
          <dl>
            <div>
              <dt>Strength</dt>
              <dd>Clear mathematical reasoning</dd>
            </div>
            <div>
              <dt>Develop next</dt>
              <dd>Accuracy in multi-step problems</dd>
            </div>
            <div>
              <dt>Recommended</dt>
              <dd>Two short denominator drills</dd>
            </div>
          </dl>
          <PrimaryLink href="/content">Open practice</PrimaryLink>
        </aside>
      </div>
      <section className={s.panel}>
        <SectionHeader
          title="Skill progress"
          description="Recent change, evidence, and the most useful next step."
        />
        <div className={s.skillTable}>
          {skills.map((skill) => (
            <article key={skill.id}>
              <div>
                <strong>{skill.name}</strong>
                <small>{skill.subject}</small>
              </div>
              <StatusBadge status={skill.level} />
              <ProgressBar value={skill.progress} label={skill.name} />
              <span>{skill.change}</span>
              <Link href="/academics">View evidence</Link>
            </article>
          ))}
        </div>
      </section>
    </WorkspacePage>
  );
}

const RESOURCE_THUMB: Record<
  ContentPageData["resources"][number]["type"],
  { label: string; icon: LucideIcon }
> = {
  video: { label: "Video", icon: PlayCircle },
  interactive: { label: "Interactive", icon: Sparkles },
  document: { label: "Guide", icon: BookMarked },
  worksheet: { label: "Practice set", icon: BookMarked },
  link: { label: "Guide", icon: BookMarked },
};

function messageFromResourceResponse(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

export function ResourceLibraryPage({
  resources,
  subjects,
  bookmarkedResourceIds,
  initialQuery = "",
}: {
  resources: ContentPageData["resources"];
  subjects: ContentPageData["subjects"];
  bookmarkedResourceIds: string[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<"All" | ContentPageData["resources"][number]["type"]>("All");
  const [savedIds, setSavedIds] = useState(() => new Set(bookmarkedResourceIds));
  const [openResourceId, setOpenResourceId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const subjectName = (subjectId: string | null) =>
    subjectId ? (subjects.find((subject) => subject.id === subjectId)?.name ?? null) : null;
  const visible = useMemo(
    () =>
      resources.filter(
        (r) => (filter === "All" || r.type === filter) && r.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [resources, query, filter],
  );

  async function toggleSaved(resourceId: string) {
    const wasSaved = savedIds.has(resourceId);
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
    setError(null);
    try {
      const response = await fetch("/api/content/bookmarks", {
        method: wasSaved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(resourceId);
        else next.delete(resourceId);
        return next;
      });
      setError("That resource could not be saved. Try again.");
    }
  }

  async function submitReport(resourceId: string) {
    if (!reportReason.trim()) return;
    setError(null);
    try {
      const response = await fetch("/api/content/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId, reason: reportReason.trim() }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok)
        throw new Error(messageFromResourceResponse(payload, "That report could not be sent."));
      setReportedIds((current) => new Set(current).add(resourceId));
      setReportingId(null);
      setReportReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That report could not be sent.");
    }
  }

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Resources · Library"
        title="Resource library"
        description="Find videos, guides, and practice your tutors have published."
        action={<SecondaryLink href="/academics">View learning goals</SecondaryLink>}
      />
      <div className={s.libraryToolbar}>
        <label className={s.librarySearch}>
          <Search size={18} />
          <span className={s.srOnly}>Search resources</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources…"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="Resource type"
        >
          <option value="All">All</option>
          {(["video", "document", "worksheet", "interactive", "link"] as const).map((type) => (
            <option key={type} value={type}>
              {RESOURCE_THUMB[type].label}
            </option>
          ))}
        </select>
      </div>
      <SectionHeader
        title="Published resources"
        description="Everything your tutors have shared with the class."
      />
      {error ? (
        <p role="alert" className={s.inlineError}>
          {error}
        </p>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState
          title={resources.length === 0 ? "No resources yet" : "No resources match that search"}
          description={
            resources.length === 0
              ? "When your tutor publishes a resource, it will appear here."
              : "Try a broader search or reset the resource type filter."
          }
          primary={
            <button
              className={s.primaryButton}
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("All");
              }}
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className={s.resourceGrid}>
          {visible.map((r) => {
            const thumb = RESOURCE_THUMB[r.type];
            const ThumbIcon = thumb.icon;
            const videoLink = r.links.find((link) => link.provider === "youtube");
            const isOpen = openResourceId === r.id;
            return (
              <article className={s.resourceCard} key={r.id}>
                <div className={s.resourceThumb} data-type={thumb.label}>
                  <ThumbIcon />
                  <span>{thumb.label}</span>
                </div>
                <div className={s.resourceBody}>
                  <p>{subjectName(r.subjectId) ?? "General"}</p>
                  <h2>{r.title}</h2>
                  <span>{r.tags.length > 0 ? r.tags.join(" · ") : "No tags yet"}</span>
                  <small>{new Date(r.createdAt).toLocaleDateString()}</small>
                  <div>
                    <button
                      className={s.resourceOpen}
                      type="button"
                      onClick={() => setOpenResourceId((current) => (current === r.id ? null : r.id))}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? "Close details" : "Open resource"} <ArrowUpRight size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={savedIds.has(r.id) ? "Remove from saved" : "Save resource"}
                      onClick={() => void toggleSaved(r.id)}
                    >
                      <Star size={16} fill={savedIds.has(r.id) ? "currentColor" : "none"} />
                    </button>
                  </div>
                  {isOpen ? (
                    <div className={s.resourceDetails}>
                      <p>{r.description ?? "No description provided."}</p>
                      {videoLink ? (
                        <iframe
                          style={{ aspectRatio: "16 / 9", width: "100%", border: 0 }}
                          src={videoLink.url}
                          title={videoLink.title ?? r.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : null}
                      {reportedIds.has(r.id) ? (
                        <small>Reported for review.</small>
                      ) : reportingId === r.id ? (
                        <div className={s.inlineActions}>
                          <input
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="Why are you reporting this?"
                          />
                          <button
                            className={s.primaryButton}
                            type="button"
                            disabled={!reportReason.trim()}
                            onClick={() => void submitReport(r.id)}
                          >
                            Send report
                          </button>
                          <button
                            className={s.secondaryButton}
                            type="button"
                            onClick={() => {
                              setReportingId(null);
                              setReportReason("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className={s.secondaryButton}
                          type="button"
                          onClick={() => setReportingId(r.id)}
                        >
                          Report this resource
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className={s.safetyNote}>
        <ShieldCheck size={17} />
        <span>External links open with a clear warning. Use “Report this resource” above if something is wrong.</span>
      </div>
    </WorkspacePage>
  );
}

export function QuestionsPage() {
  const availableQuestions = SHOW_PRESENTATION_FIXTURES ? questions : [];
  const [tab, setTab] = useState("My questions");
  const [composer, setComposer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<{ title: string; description: string } | null>(null);
  const persistedDraftValue = useSyncExternalStore(
    subscribeToQuestionDraft,
    questionDraftSnapshot,
    () => null,
  );
  const draftToShow = savedDraft ?? parseQuestionDraft(persistedDraftValue);

  const visibleQuestions =
    tab === "Answered"
      ? availableQuestions.filter((question) => question.resolved)
      : tab === "Class questions"
        ? []
        : availableQuestions;
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Resources · Questions"
        title="Questions"
        description="Ask about your lessons, homework, and learning topics."
        action={
          <button className={s.primaryButton} type="button" onClick={() => setComposer((v) => !v)}>
            <Plus size={16} />
            {composer ? "Close composer" : "Ask a question"}
          </button>
        }
      />
      {composer ? (
        <form
          className={s.composer}
          onSubmit={(event) => {
            event.preventDefault();
            const draft = new FormData(event.currentTarget);
            window.localStorage.setItem(
              "2tor-question-draft",
              JSON.stringify({
                title: draft.get("title"),
                description: draft.get("description"),
                savedAt: new Date().toISOString(),
              }),
            );
            setSavedDraft({
              title: String(draft.get("title") ?? ""),
              description: String(draft.get("description") ?? ""),
            });
            setComposer(false);
            setNotice("Your question was saved on this device as a draft.");
            setTab("Drafts");
          }}
        >
          <SectionHeader
            title="Ask a clear learning question"
            description="Connect it to the work your tutor already knows."
          />
          <div className={s.formGrid}>
            <label>
              Subject
              <select>
                <option>Mathematics</option>
                <option>English</option>
              </select>
            </label>
            <label>
              Related to
              <select>
                <option>Fractions lesson · 30 Jul</option>
                <option>Fractions practice set</option>
                <option>Weekly budget project</option>
              </select>
            </label>
          </div>
          <label>
            Question title
            <input name="title" required placeholder="What are you trying to understand?" />
          </label>
          <label>
            More detail
            <textarea
              name="description"
              required
              placeholder="Show what you tried and where you got stuck."
            />
          </label>
          <div className={s.composerFoot}>
            <span>
              <ShieldCheck size={15} /> Don’t include personal contact information.
            </span>
            <div>
              <label className={s.secondaryButton}>
                <Paperclip size={15} /> Attach file
                <input className={s.srOnly} type="file" />
              </label>
              <button className={s.primaryButton} type="submit">
                <Send size={15} /> Save draft
              </button>
            </div>
          </div>
        </form>
      ) : null}
      {notice ? (
        <div className={s.insightNote} role="status">
          <CheckCircle2 size={16} />
          {notice}
          <button type="button" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      <Tabs
        tabs={["My questions", "Class questions", "Answered", "Drafts"]}
        active={tab}
        onChange={setTab}
        label="Question view"
      />
      {tab === "Drafts" ? (
        draftToShow ? (
          <div className={s.questionList}>
            <article>
              <span className={s.questionIcon}>
                <FileText aria-hidden="true" />
              </span>
              <div>
                <p>Draft · Saved on this device</p>
                <h2>{draftToShow.title}</h2>
                <span>{draftToShow.description}</span>
              </div>
              <div>
                <StatusBadge status="in-progress" />
                <button className={s.questionOpen} type="button" onClick={() => setComposer(true)}>
                  Continue editing <ChevronRight size={15} />
                </button>
              </div>
            </article>
          </div>
        ) : (
          <EmptyState
            title="No question drafts"
            description="Start a question and save it on this device if you need more time."
            primary={
              <button className={s.primaryButton} type="button" onClick={() => setComposer(true)}>
                <Plus size={16} /> Start a question
              </button>
            }
          />
        )
      ) : visibleQuestions.length === 0 ? (
        <EmptyState
          title={
            tab === "Class questions"
              ? "No class questions yet"
              : tab === "Answered"
                ? "No answered questions yet"
                : "No questions yet"
          }
          description={
            tab === "Class questions"
              ? "Questions shared with your class will appear here when that feature is available for a lesson."
              : "Ask about a lesson, homework task, or project when you need help."
          }
          primary={
            <button className={s.primaryButton} type="button" onClick={() => setComposer(true)}>
              <Plus size={16} /> Ask your own question
            </button>
          }
          secondary={<SecondaryLink href="/scheduling">Open classes</SecondaryLink>}
        />
      ) : (
        <div className={s.questionList}>
          {visibleQuestions.map((q) => (
            <article key={q.id}>
              <span className={s.questionIcon}>
                <MessageCircleQuestion />
              </span>
              <div>
                <p>
                  {q.subject} · {q.related}
                </p>
                <h2>{q.title}</h2>
                <span>
                  {q.posted} · {q.answers} {q.answers === 1 ? "answer" : "answers"}
                </span>
              </div>
              <div>
                {q.verified ? (
                  <span className={s.verified}>
                    <ShieldCheck size={14} /> Verified answer
                  </span>
                ) : null}
                <button
                  className={s.questionOpen}
                  type="button"
                  aria-expanded={openQuestionId === q.id}
                  onClick={() => setOpenQuestionId((current) => (current === q.id ? null : q.id))}
                >
                  {openQuestionId === q.id ? "Close question" : "Open question"}
                  <ChevronRight size={15} />
                </button>
              </div>
              {openQuestionId === q.id ? (
                <div className={s.questionDetail}>
                  <strong>Tutor answer</strong>
                  <p>
                    Think of the denominator as the size of each piece. The pieces must be the same
                    size before their counts can be combined.
                  </p>
                  <div className={s.verified}>
                    <ShieldCheck size={14} /> Verified by Ani Martirosyan
                  </div>
                  <SecondaryLink href="/content">Open related resource</SecondaryLink>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </WorkspacePage>
  );
}

export function SupportPage() {
  const [helpQuery, setHelpQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const topics = [
    "Joining a class",
    "Submitting homework",
    "Uploading a file",
    "Account access",
    "Changing notifications",
    "Reporting a problem",
    "Contacting a tutor",
    "Parent connection",
  ];
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Help · Student support"
        title="Help and support"
        description="Solve common problems quickly, or send our support team the right details."
      />
      <label className={s.searchField}>
        <Search size={18} />
        <span className={s.srOnly}>Search help topics</span>
        <input
          value={helpQuery}
          onChange={(event) => setHelpQuery(event.target.value)}
          placeholder="Search help topics…"
        />
        <kbd>
          {topics.filter((topic) => topic.toLowerCase().includes(helpQuery.toLowerCase())).length}{" "}
          topics
        </kbd>
      </label>
      <section>
        <SectionHeader title="Common help topics" />
        <div className={s.topicGrid}>
          {topics
            .filter((topic) => topic.toLowerCase().includes(helpQuery.toLowerCase()))
            .map((topic) => (
              <button
                type="button"
                onClick={() => setSelectedTopic((current) => (current === topic ? null : topic))}
                aria-expanded={selectedTopic === topic}
                key={topic}
              >
                <CircleHelp size={18} />
                <span>{topic}</span>
                <ChevronRight size={15} />
              </button>
            ))}
        </div>
        {selectedTopic ? (
          <div className={s.helpAnswer}>
            <strong>{selectedTopic}</strong>
            <p>
              Open the connected page first, look for its primary action, and use “Contact support”
              below if the step still does not work.
            </p>
            <button type="button" onClick={() => setRequestType(selectedTopic)}>
              I still need help
            </button>
          </div>
        ) : null}
      </section>
      <div className={s.supportGrid}>
        <article>
          <LifeBuoy />
          <h2>Help center</h2>
          <p>Step-by-step guides for classes, homework, files, and your account.</p>
          <button
            className={s.secondaryButton}
            type="button"
            onClick={() => setSelectedTopic("Joining a class")}
          >
            Browse guides
          </button>
        </article>
        <article>
          <Headphones />
          <h2>Contact support</h2>
          <p>Tell us what happened and include the page where you got stuck.</p>
          <button
            className={s.primaryButton}
            type="button"
            onClick={() => setRequestType("General support")}
          >
            Start a request
          </button>
        </article>
        <article>
          <BellRing />
          <h2>Technical issue</h2>
          <p>Report something that is broken and include the page where it happened.</p>
          <button
            className={s.secondaryButton}
            type="button"
            onClick={() => setRequestType("Technical issue")}
          >
            Report issue
          </button>
        </article>
        <article data-tone="safe">
          <ShieldCheck />
          <h2>Safety concern</h2>
          <p>Send a private safety report to the safeguarding team.</p>
          <button
            className={s.secondaryButton}
            type="button"
            onClick={() => setRequestType("Safety concern")}
          >
            Report safely
          </button>
        </article>
      </div>
      {requestType ? (
        <form
          className={s.supportForm}
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setSendingRequest(true);
            setSubmissionMessage(null);
            try {
              const response = await fetch("/api/support/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subject: String(form.get("subject") ?? requestType),
                  description: String(form.get("description") ?? ""),
                  category:
                    requestType === "Safety concern"
                      ? "safety"
                      : requestType === "Technical issue"
                        ? "technical"
                        : "academic",
                  priority: requestType === "Safety concern" ? "urgent" : "normal",
                  urgency: "standard",
                  sensitiveChange: null,
                  source: { type: "page", id: String(form.get("source") ?? "student-dashboard") },
                }),
              });
              if (!response.ok) {
                throw new Error("The request could not be sent. Your description is still here.");
              }
              setSubmissionMessage(
                "Your support request was sent. You can follow its status below.",
              );
              setRequestType(null);
            } catch (error) {
              setSubmissionMessage(
                error instanceof Error ? error.message : "The request could not be sent.",
              );
            } finally {
              setSendingRequest(false);
            }
          }}
        >
          <SectionHeader
            title={requestType}
            description="Include the page and what happened so the right team can help quickly."
          />
          <div className={s.formGrid}>
            <label>
              Subject
              <input name="subject" required defaultValue={requestType} />
            </label>
            <label>
              Related page
              <input name="source" defaultValue={selectedTopic ?? "Student dashboard"} />
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              required
              minLength={10}
              placeholder="What happened, and what did you expect?"
            />
          </label>
          <div className={s.inlineActions}>
            <button className={s.primaryButton} type="submit" disabled={sendingRequest}>
              {sendingRequest ? "Sending…" : "Send request"}
            </button>
            <button
              className={s.secondaryButton}
              type="button"
              onClick={() => setRequestType(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {submissionMessage ? (
        <div className={s.insightNote} role="status">
          <CheckCircle2 size={16} />
          {submissionMessage}
          <button type="button" onClick={() => setSubmissionMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {SHOW_PRESENTATION_FIXTURES ? (
        <>
          <aside className={s.ticketStatus}>
            <div>
              <span>Latest request</span>
              <strong>#2T-184 · Class audio problem</strong>
              <small>Updated today at 12:40</small>
            </div>
            <span className={s.status} data-status="in-progress">
              In progress
            </span>
            <button
              className={s.questionOpen}
              type="button"
              onClick={() => setTicketOpen((current) => !current)}
              aria-expanded={ticketOpen}
            >
              {ticketOpen ? "Hide request" : "View request"}
            </button>
          </aside>
          {ticketOpen ? (
            <div className={s.helpAnswer}>
              <strong>Class audio problem</strong>
              <p>
                Support is reviewing the connection details you sent. Your work is saved and no
                lesson attendance data was lost.
              </p>
              <small>Next update expected within one working day.</small>
            </div>
          ) : null}
        </>
      ) : null}
    </WorkspacePage>
  );
}
