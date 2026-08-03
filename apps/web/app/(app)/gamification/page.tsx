import { GamificationOverview } from "../../../components/gamification/gamification-overview";
import { ProgressPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";

/** Live points data is loaded through the relationship-authorized overview endpoint. */
export default async function GamificationPage() {
  const session = await currentSession();
  return session?.roles.includes("student") ? (
    <ProgressPage />
  ) : (
    <GamificationOverview competitionEnabled={false} />
  );
}
