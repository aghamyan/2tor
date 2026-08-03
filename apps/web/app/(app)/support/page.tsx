import { SupportOverview as LegacySupportOverview } from "../../../components/support/support-overview";
import { SupportPage as StudentSupportPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";

export default async function SupportPage() {
  const session = await currentSession();
  return session?.roles.includes("student") ? <StudentSupportPage /> : <LegacySupportOverview />;
}
