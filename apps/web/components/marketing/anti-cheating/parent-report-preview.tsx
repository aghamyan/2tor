"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Clock3, ListChecks, MonitorSmartphone, ShieldCheck, Smartphone, Globe, Bot } from "lucide-react";
import type { AntiCheatingCopy } from "./anti-cheating-content";
import type { MonitoringEvent } from "./types";
import { IntegrityScore } from "./integrity-score";
import { SessionTimeline } from "./session-timeline";
import styles from "./anti-cheating-page.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

export interface ParentReportPreviewProps {
  copy: AntiCheatingCopy["report"];
  severityLabels: AntiCheatingCopy["severity"];
  integrityCopy: AntiCheatingCopy["integrityScore"];
  score: number;
  ratingLabel: string;
  categories: { key: string; value: number }[];
  events: MonitoringEvent[];
}

const stats: Array<{
  icon: typeof Clock3;
  labelKey: "durationLabel" | "completedLabel" | "focusTimeLabel" | "tabChangesLabel" | "phoneEventsLabel" | "externalLabel" | "aiLabel";
  valueKey: "duration" | "completed" | "focusTime" | "tabChanges" | "phoneEvents" | "external" | "ai";
}> = [
  { icon: Clock3, labelKey: "durationLabel", valueKey: "duration" },
  { icon: ListChecks, labelKey: "completedLabel", valueKey: "completed" },
  { icon: ShieldCheck, labelKey: "focusTimeLabel", valueKey: "focusTime" },
  { icon: MonitorSmartphone, labelKey: "tabChangesLabel", valueKey: "tabChanges" },
  { icon: Smartphone, labelKey: "phoneEventsLabel", valueKey: "phoneEvents" },
  { icon: Globe, labelKey: "externalLabel", valueKey: "external" },
  { icon: Bot, labelKey: "aiLabel", valueKey: "ai" },
];

export function ParentReportPreview({
  copy,
  severityLabels,
  integrityCopy,
  score,
  ratingLabel,
  categories,
  events,
}: ParentReportPreviewProps) {
  const reduceMotion = useReducedMotion();
  const categoryCopy = categories.map((category) => ({
    ...category,
    label: integrityCopy.categories[category.key as keyof typeof integrityCopy.categories],
  }));

  return (
    <motion.div
      className={styles.reportCard}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease }}
    >
      <div className={styles.reportHead}>
        <span className={styles.reportTag}>{copy.downloadLabel}</span>
        <h3>{copy.title}</h3>
        <p>{copy.subject}</p>
      </div>

      <dl className={styles.reportStatGrid}>
        {stats.map(({ icon: Icon, labelKey, valueKey }) => (
          <div key={valueKey} className={styles.reportStat}>
            <Icon size={16} aria-hidden="true" />
            <dt>{copy[labelKey]}</dt>
            <dd>{copy[valueKey]}</dd>
          </div>
        ))}
      </dl>

      <IntegrityScore
        heading={integrityCopy.heading}
        score={score}
        ratingLabel={ratingLabel}
        categories={categoryCopy}
        tooltip={integrityCopy.tooltip}
      />

      <div className={styles.reportTimeline}>
        <h4>{copy.timelineHeading}</h4>
        <SessionTimeline events={events} severityLabels={severityLabels} ariaLabel={copy.timelineHeading} />
      </div>

      <div className={styles.reportSummary}>
        <h4>{copy.summaryHeading}</h4>
        <p>{copy.summaryBody}</p>
        <p className={styles.reportDisclaimer}>{copy.disclaimer}</p>
      </div>
    </motion.div>
  );
}
