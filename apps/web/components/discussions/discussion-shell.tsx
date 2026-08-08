import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Plus } from "lucide-react";

import { communityName } from "../../../../packages/domain/discussions/branding";
import { MathOverflowStats, type MathOverflowStatsData } from "./mathoverflow-stats";
import styles from "./discussion-shell.module.css";

export interface DiscussionTab {
  id: string;
  label: string;
  href: string;
}

export async function DiscussionShell({
  activeTabId,
  tabs,
  askHref,
  viewerKind,
  stats,
  children,
}: {
  activeTabId: string | null;
  tabs: DiscussionTab[];
  askHref: string | null;
  viewerKind?: "student" | "tutor" | "staff";
  stats?: MathOverflowStatsData;
  children: ReactNode;
}) {
  const t = await getTranslations("discussions");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.headerKicker}>
            <p className={styles.eyebrow}>{t("shell.eyebrow")}</p>
            {viewerKind ? (
              <span className={styles.roleLabel}>{t(`shell.role.${viewerKind}` as never)}</span>
            ) : null}
          </div>
          <h1 className={styles.title}>{communityName}</h1>
          <p className={styles.tagline}>{t("shell.tagline")}</p>
          {viewerKind ? (
            <p className={styles.context}>{t(`shell.context.${viewerKind}` as never)}</p>
          ) : null}
        </div>
        {askHref ? (
          <Link href={askHref} className={styles.askButton}>
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
            {t("shell.askButton")}
            <ArrowRight className={styles.askArrow} size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      {stats ? (
        <MathOverflowStats stats={stats} emphasizeAttention={viewerKind !== "student"} />
      ) : null}
      {tabs.length > 0 ? (
        <nav className={styles.tabs} aria-label={communityName}>
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={styles.tab}
              aria-current={tab.id === activeTabId ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
