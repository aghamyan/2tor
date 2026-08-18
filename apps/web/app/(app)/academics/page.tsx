import { ProgressPage, type ActorRole } from "../../../components/progress/progress-page";
import { currentSession } from "../../../lib/current-session";
import {
  loadLearnerOptions,
  loadRecentSkillActivity,
  loadRewardsSummary,
  loadStudentMasteryMap,
  loadSubjectOptions,
} from "./queries";
import { toCurriculumDomains, toRewardsSummary, toTimelineEvents } from "./progress-adapter";

export const dynamic = "force-dynamic";

function roleFor(roles: readonly string[]): ActorRole {
  if (roles.includes("tutor")) return "tutor";
  if (roles.includes("student")) return "student";
  if (roles.includes("administrator") || roles.includes("super_administrator")) return "admin";
  return "parent";
}

export default async function AcademicsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; subject?: string }>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const role = roleFor(session.roles);
  const { student: requestedStudent, subject: requestedSubject } = await searchParams;

  const [learnerOptions, subjectOptions] = await Promise.all([
    loadLearnerOptions(),
    loadSubjectOptions(),
  ]);

  const learner = learnerOptions.find((option) => option.studentProfileId === requestedStudent) ?? learnerOptions[0];
  const subject = subjectOptions.find((option) => option.id === requestedSubject) ?? subjectOptions[0];

  if (!learner || !subject) {
    return (
      <div style={{ padding: "48px 24px", maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <h1>No mastery map yet</h1>
        <p>
          {role === "tutor"
            ? "You don't have any assigned students yet — the mastery map appears once a student is assigned to you."
            : "No learner or subject is available yet. Check back once a tutor has been assigned."}
        </p>
      </div>
    );
  }

  const [map, rewards, recentActivity] = await Promise.all([
    loadStudentMasteryMap(learner.studentProfileId, subject.id),
    loadRewardsSummary(learner.studentProfileId),
    loadRecentSkillActivity(learner.studentProfileId, subject.id),
  ]);

  const domains = toCurriculumDomains(map);
  const skillNameById = new Map(
    domains.flatMap((domain) => domain.topics.map((topic) => [topic.id, topic.name] as const)),
  );
  const allTopics = domains.flatMap((domain) => domain.topics);
  const lastAssessed = allTopics
    .map((topic) => topic.lastAssessed)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  return (
    <ProgressPage
      role={role}
      studentProfileId={learner.studentProfileId}
      subjectId={subject.id}
      learnerName={learner.name}
      subjectName={subject.name}
      updatedLabel={lastAssessed ? `Updated ${lastAssessed}` : null}
      domains={domains}
      timelineEvents={toTimelineEvents(recentActivity, skillNameById)}
      rewards={toRewardsSummary(rewards)}
      learnerOptions={learnerOptions}
      subjectOptions={subjectOptions}
    />
  );
}
