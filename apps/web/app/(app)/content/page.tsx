import { ContentOverview } from "../../../components/content/content-overview";
import { ResourceLibraryPage } from "../../../components/student-workspace/student-pages";
import { currentSession } from "../../../lib/current-session";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [session, params] = await Promise.all([currentSession(), searchParams]);
  return session?.roles.includes("student") ? (
    <ResourceLibraryPage initialQuery={params.q} />
  ) : (
    <ContentOverview />
  );
}
