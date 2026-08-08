import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { communityName } from "../../../../../packages/domain/discussions/branding";
import {
  DiscussionShell,
  type DiscussionTab,
} from "../../../components/discussions/discussion-shell";
import { Feed } from "../../../components/discussions/feed";
import type { DiscussionFeedFilterInput } from "../../../../../packages/domain/discussions/schemas";
import { buildDiscussionsHref } from "../../../components/discussions/query-params";
import {
  hasTutorReviewSignal,
  needsTutorAttention,
} from "../../../components/discussions/question-state";
import { loadFeed, loadTags, loadViewerContext } from "./queries";

export const dynamic = "force-dynamic";

// Platform-authenticated only, never internet-facing — see packages/domain/discussions/README.md.
export const metadata: Metadata = {
  title: communityName,
  robots: { index: false, follow: false, nocache: true },
};

const DEFAULT_SORT = "recent_activity";
const PAGE_SIZE = 20;

interface DiscussionsSearchParams {
  tab?: string;
  search?: string;
  sort?: string;
  tag?: string;
  grade?: string;
  status?: string;
  author?: string;
  authorName?: string;
  cursor?: string;
}

export default async function DiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<DiscussionsSearchParams>;
}) {
  const params = await searchParams;
  const viewer = await loadViewerContext();
  if (viewer.isParentViewer) redirect("/discussions/family");

  const tab = params.tab ?? null;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? DEFAULT_SORT;
  const tagSlug = params.tag ?? "";
  const grade = params.grade ?? "";
  const status = params.status ?? "";
  const offset = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;

  const filter: DiscussionFeedFilterInput = {
    search: search || undefined,
    sort: sort as DiscussionFeedFilterInput["sort"],
    tagSlug: tagSlug || undefined,
    gradeLevel: grade || undefined,
    status: (status || undefined) as DiscussionFeedFilterInput["status"],
    cursor: params.cursor || undefined,
    limit: PAGE_SIZE,
  };
  if (tab === "mine") filter.authorUserId = viewer.userId;
  if (tab === "following") filter.followedByUserId = viewer.userId;
  if (tab === "saved") filter.savedByUserId = viewer.userId;
  if (tab === "needs-review") filter.needsTutorReview = true;
  // Author filtering only applies to the general feed — "mine" already means "authored by me",
  // and the other tabs (following/saved/needs-review/moderation) aren't author-scoped views.
  if ((!tab || tab === "all") && params.author) filter.authorUserId = params.author;

  const [page, tags, t] = await Promise.all([
    loadFeed(filter),
    loadTags(),
    getTranslations("discussions"),
  ]);

  const currentParams: Record<string, string | undefined> = {
    tab: params.tab,
    search: params.search,
    sort: params.sort,
    tag: params.tag,
    grade: params.grade,
    status: params.status,
    author: !tab || tab === "all" ? params.author : undefined,
    authorName: !tab || tab === "all" ? params.authorName : undefined,
  };

  const tabs: DiscussionTab[] = [
    {
      id: "all",
      label: t("tabs.all"),
      href: buildDiscussionsHref("/discussions", currentParams, { tab: null, cursor: null }),
    },
  ];
  if (!viewer.isTutorViewer && !viewer.isStaffViewer) {
    tabs.push({
      id: "mine",
      label: t("tabs.mine"),
      href: buildDiscussionsHref("/discussions", currentParams, { tab: "mine", cursor: null }),
    });
  }
  if (viewer.isTutorViewer || viewer.isStaffViewer) {
    tabs.push({
      id: "needs-review",
      label: t("tabs.needsReview"),
      href: buildDiscussionsHref("/discussions", currentParams, {
        tab: "needs-review",
        cursor: null,
      }),
    });
  }
  tabs.push(
    {
      id: "following",
      label: t("tabs.following"),
      href: buildDiscussionsHref("/discussions", currentParams, { tab: "following", cursor: null }),
    },
    {
      id: "saved",
      label: t("tabs.saved"),
      href: buildDiscussionsHref("/discussions", currentParams, { tab: "saved", cursor: null }),
    },
  );
  if (viewer.isStaffViewer) {
    tabs.push({ id: "moderation", label: t("tabs.moderation"), href: "/discussions/moderation" });
  }

  const viewerKind = viewer.isStaffViewer ? "staff" : viewer.isTutorViewer ? "tutor" : "student";
  const stats = {
    visible: page.items.length,
    needsAttention: page.items.filter(needsTutorAttention).length,
    active: page.items.filter((item) => item.answerCount > 0 || item.commentCount > 0).length,
    tutorReviewed: page.items.filter(hasTutorReviewSignal).length,
  };

  return (
    <DiscussionShell
      activeTabId={tab ?? "all"}
      tabs={tabs}
      askHref={viewer.canAsk ? "/discussions/ask" : null}
      viewerKind={viewerKind}
      stats={stats}
    >
      <Feed
        page={page}
        tags={tags}
        basePath="/discussions"
        tab={tab}
        search={search}
        sort={sort}
        tagSlug={tagSlug}
        grade={grade}
        status={status}
        offset={offset}
        limit={PAGE_SIZE}
        currentParams={currentParams}
        viewerKind={viewerKind}
        viewerUserId={viewer.userId}
        canAsk={viewer.canAsk}
      />
    </DiscussionShell>
  );
}
