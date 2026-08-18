import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { communityName } from "../../../../../../packages/domain/discussions/branding";
import type { DiscussionReportSeverity, DiscussionReportStatus } from "../../../../../../packages/domain/discussions/models";
import { DiscussionShell } from "../../../../components/discussions/discussion-shell";
import { SimpleActionButton } from "../../../../components/discussions/simple-action-button";
import { ResolveReportForm } from "../../../../components/discussions/resolve-report-form";
import { formatRelativeTime } from "../../../../components/discussions/format";
import { assignReportAction } from "../actions";
import { loadModerationQueue, loadViewerContext } from "../queries";
import feedStyles from "../../../../components/discussions/feed.module.css";
import styles from "../../../../components/discussions/moderation.module.css";
import activityStyles from "../../../../components/discussions/activity-page.module.css";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<DiscussionReportStatus, "primary" | "green" | "amber" | "muted" | "danger"> = {
  open: "amber",
  reviewing: "primary",
  resolved: "green",
  dismissed: "muted",
  escalated: "danger",
};
const SEVERITY_TONE: Record<DiscussionReportSeverity, "primary" | "green" | "amber" | "muted" | "danger"> = {
  low: "muted",
  medium: "amber",
  high: "danger",
  critical: "danger",
};
const STATUS_TABS: Array<"open" | DiscussionReportStatus | "all"> = [
  "open",
  "reviewing",
  "escalated",
  "resolved",
  "dismissed",
  "all",
];

export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await loadViewerContext();
  if (!viewer.isStaffViewer) redirect("/discussions");

  const [{ status }, t, locale] = await Promise.all([searchParams, getTranslations("discussions"), getLocale()]);
  const activeTab = STATUS_TABS.includes(status as never) ? (status as (typeof STATUS_TABS)[number]) : "open";
  const items = await loadModerationQueue(activeTab === "all" ? {} : { status: activeTab as DiscussionReportStatus });

  return (
    <DiscussionShell activeTabId={null} tabs={[]} askHref={null}>
      <p className={activityStyles.eyebrow}>{t("moderation.eyebrow")}</p>
      <div className={activityStyles.headerRow}>
        <div>
          <h1 className={activityStyles.title}>{t("moderation.title")}</h1>
          <p className={activityStyles.subtitle}>{t("moderation.subtitle")}</p>
        </div>
      </div>

      <nav className={activityStyles.picker} aria-label={t("moderation.statusLabel")}>
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/discussions/moderation?status=${tab}`}
            className={activityStyles.pickerLink}
            aria-current={tab === activeTab ? "true" : undefined}
          >
            {t(`moderation.reportStatus.${tab}` as never)}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className={`${activityStyles.empty} ${styles.queueEmpty}`}>
          <p className={activityStyles.emptyTitle}>{t("moderation.emptyTitle")}</p>
          <p>{t("moderation.emptyBody")}</p>
        </div>
      ) : (
        <ul className={`${activityStyles.list} ${styles.queueList}`}>
          {items.map((item) => {
            const previewLabel = item.targetPreview || t("moderation.targetRemoved");
            return (
              <li key={item.report.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.badges}>
                    <span className={feedStyles.badge} data-tone={STATUS_TONE[item.report.status]}>
                      {t(`moderation.reportStatus.${item.report.status}` as never)}
                    </span>
                    {item.report.severity ? (
                      <span className={feedStyles.badge} data-tone={SEVERITY_TONE[item.report.severity]}>
                        {t(`moderation.severity.${item.report.severity}` as never)}
                      </span>
                    ) : null}
                    <span className={feedStyles.badge} data-tone="muted">
                      {t(`moderation.targetType.${item.report.targetType}` as never)}
                    </span>
                  </div>
                  <span className={activityStyles.itemMeta}>
                    <time dateTime={item.report.createdAt.toISOString()}>
                      {formatRelativeTime(item.report.createdAt, locale)}
                    </time>
                  </span>
                </div>

                {item.targetSlug ? (
                  <Link href={`/discussions/${item.targetSlug}`} className={styles.targetPreview}>
                    {previewLabel}
                  </Link>
                ) : (
                  <span className={styles.targetPreview}>{previewLabel}</span>
                )}

                <p className={styles.reportReason}>{item.report.reason}</p>
                {item.report.details ? <p className={styles.reportDetails}>{item.report.details}</p> : null}

                <div className={styles.metaRow}>
                  <span>
                    {t("moderation.reportedBy", { name: item.reporterDisplayName ?? t("moderation.unknownUser") })}
                  </span>
                  {item.targetAuthorDisplayName ? (
                    <span>{t("moderation.authoredBy", { name: item.targetAuthorDisplayName })}</span>
                  ) : null}
                  <span>
                    {item.assignedModeratorDisplayName
                      ? t("moderation.assignedTo", { name: item.assignedModeratorDisplayName })
                      : t("moderation.unassigned")}
                  </span>
                </div>

                <div className={styles.actions}>
                  {item.report.assignedModeratorId !== viewer.userId ? (
                    <SimpleActionButton
                      action={assignReportAction.bind(null, item.report.id, viewer.userId)}
                      label={t("moderation.assignToMe")}
                      className={styles.assignButton}
                      showFeedback={false}
                    />
                  ) : null}
                  <ResolveReportForm reportId={item.report.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DiscussionShell>
  );
}

export function generateMetadata() {
  return { title: communityName, robots: { index: false, follow: false, nocache: true } };
}
