import { ScheduleOverview } from "../../../components/scheduling/schedule-overview";
import { TutorClassesWorkspace } from "../../../components/scheduling/tutor-classes-workspace";
import { StudentClassesPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";
import { loadClassesForViewer, loadSchedulableOptions } from "./queries";

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

  return viewerRole === "tutor" ? (
    <TutorClassesWorkspace
      initialLessons={lessons}
      assignments={options.assignments}
      subjects={options.subjects}
    />
  ) : viewerRole === "student" ? (
    <StudentClassesPage lessons={lessons} />
  ) : (
    <ScheduleOverview lessons={lessons} viewerRole={viewerRole} />
  );
}
