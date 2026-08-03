import { ProjectsOverview as LegacyProjectsOverview } from "../../../components/projects/projects-overview";
import { ProjectsPage as StudentProjectsPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";

export default async function ProjectsPage() {
  const session = await currentSession();
  return session?.roles.includes("student") ? <StudentProjectsPage /> : <LegacyProjectsOverview />;
}
