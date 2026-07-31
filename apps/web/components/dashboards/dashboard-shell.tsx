"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { DashboardKind, DashboardPanel } from "../../app/(app)/(dashboards)/_lib/catalog";
import styles from "./dashboard.module.css";

export interface DashboardShellProps {
  kind: DashboardKind;
  panels: readonly DashboardPanel[];
  summary: ReactNode;
  viewerName?: string;
}

export function DashboardShell({ kind, panels, summary, viewerName }: DashboardShellProps) {
  const t = useTranslations("dashboards");
  const dashboardKey =
    kind === "student-younger"
      ? "studentYounger"
      : kind === "student-older"
        ? "studentOlder"
        : kind;

  return (
    <div className={styles.shell} data-dashboard-kind={kind}>
      <header className={styles.masthead}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>{t(`${dashboardKey}.eyebrow`)}</p>
          <h1>
            {viewerName
              ? t(`${dashboardKey}.personalTitle`, { name: viewerName })
              : t(`${dashboardKey}.title`)}
          </h1>
          <p className={styles.intro}>{t(`${dashboardKey}.intro`)}</p>
        </div>
        <div className={styles.roleMark} aria-hidden="true">
          <span>16</span>
          <strong>{t(`${dashboardKey}.mark`)}</strong>
        </div>
      </header>

      <nav className={styles.signalRail} aria-label={t("common.dashboardSections")}>
        <a href="#signals">
          <span>1</span>
          {t("common.signals")}
        </a>
        <i aria-hidden="true" />
        <a href="#workspace">
          <span>2</span>
          {t("common.workspace")}
        </a>
        <i aria-hidden="true" />
        <a href="#workspace">
          <span>3</span>
          {t("common.nextAction")}
        </a>
      </nav>

      <section id="signals" className={styles.summarySection} aria-labelledby="signals-title">
        <div className={styles.sectionLead}>
          <p>{t("common.now")}</p>
          <h2 id="signals-title">{t(`${dashboardKey}.signalsTitle`)}</h2>
        </div>
        <div className={styles.summaryContent}>{summary}</div>
      </section>

      <section id="workspace" className={styles.workspace} aria-labelledby="workspace-title">
        <div className={styles.workspaceHeader}>
          <div>
            <p className={styles.sectionKicker}>{t("common.moduleSurfaces")}</p>
            <h2 id="workspace-title">{t(`${dashboardKey}.workspaceTitle`)}</h2>
          </div>
          <p>{t(`${dashboardKey}.workspaceIntro`)}</p>
        </div>

        <div className={styles.panelGrid}>
          {panels.map((panel) => (
            <Link
              className={styles.panel}
              data-span={panel.span}
              data-tone={panel.tone}
              data-module={panel.module}
              data-panel-id={panel.id}
              href={panel.href}
              key={panel.id}
            >
              <span className={styles.moduleLabel}>{t(`modules.${panel.module}`)}</span>
              <h3>{t(panel.titleKey)}</h3>
              <p>{t(panel.bodyKey)}</p>
              <span className={styles.openLabel}>
                {t("common.open")}
                <span aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
