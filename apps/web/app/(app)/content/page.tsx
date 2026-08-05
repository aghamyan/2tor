import { ResourcesOverview } from "../../../components/content/resources-overview";
import { ResourceLibraryPage } from "../../../components/student-workspace/student-pages";
import { loadContentPageData } from "./queries";

export const dynamic = "force-dynamic";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [data, params] = await Promise.all([loadContentPageData(), searchParams]);
  return data.isStudent ? (
    <ResourceLibraryPage
      resources={data.resources}
      subjects={data.subjects}
      bookmarkedResourceIds={data.bookmarkedResourceIds}
      initialQuery={params.q}
    />
  ) : (
    <ResourcesOverview resources={data.resources} subjects={data.subjects} canCreate={data.canCreate} />
  );
}
