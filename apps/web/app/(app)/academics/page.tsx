import { AcademicsOverview } from "../../../components/academics/academics-overview";
import { LearningJourneyPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";

export default async function AcademicsPage() {
  const session = await currentSession();
  return session?.roles.includes("student") ? <LearningJourneyPage /> : <AcademicsOverview />;
}
