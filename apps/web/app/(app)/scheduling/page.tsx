import { ScheduleOverview } from "../../../components/scheduling/schedule-overview";
import { StudentClassesPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";
import { loadClassesForViewer } from "./queries";

export default async function SchedulingPage() {
  const [lessons, session] = await Promise.all([loadClassesForViewer(), currentSession()]);
  const viewerRole = session?.roles.includes("tutor")
    ? "tutor"
    : session?.roles.includes("parent")
      ? "parent"
      : "student";

  return viewerRole === "student" ? (
    <StudentClassesPage lessons={lessons} />
  ) : (
    <ScheduleOverview lessons={lessons} viewerRole={viewerRole} />
  );
}
