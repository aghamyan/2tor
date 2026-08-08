import { ScheduleOverview } from "../../../components/scheduling/schedule-overview";
import { TutorClassesWorkspace } from "../../../components/scheduling/tutor-classes-workspace";
import { StudentClassesPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";
import {
  loadClassesForViewer,
  loadRecentLessons,
  loadSchedulableOptions,
  type ClassListRecord,
} from "./queries";

export default async function SchedulingPage() {
  const [lessons, session, options] = await Promise.all([
    loadClassesForViewer(),
    currentSession(),
    loadSchedulableOptions(),
  ]);
  const viewerRole = session?.roles.includes("tutor")
    ? "tutor"
    : session?.roles.includes("parent")
      ? "parent"
      : "student";

  if (viewerRole === "tutor") {
    return (
      <TutorClassesWorkspace
        initialLessons={lessons}
        assignments={options.assignments}
        subjects={options.subjects}
      />
    );
  }
  if (viewerRole === "student") return <StudentClassesPage lessons={lessons} />;

  // The parent overview groups classes into Upcoming/Completed/Missed/Cancelled/Rescheduled
  // sections, so it needs more history than `loadClassesForViewer`'s near-term window (yesterday
  // through +60 days) carries. `loadRecentLessons` covers the last 180 days instead; merge the two
  // by id so a class that already appears in the near-term window (with its resolved joinUrl)
  // isn't duplicated by the history fetch.
  const history = await loadRecentLessons();
  const seen = new Set(lessons.map((lesson) => lesson.id));
  const merged: ClassListRecord[] = [
    ...lessons,
    ...history.filter((lesson) => !seen.has(lesson.id)).map((lesson) => ({ ...lesson, joinUrl: null })),
  ];

  return <ScheduleOverview lessons={merged} viewerRole={viewerRole} />;
}
