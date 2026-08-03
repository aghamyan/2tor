"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import styles from "./dashboard.module.css";

export interface DashboardSummaryItem {
  label: string;
  value: string;
  detail: string;
  href?: string;
  emphasis?: "default" | "attention";
  /**
   * Extra interactive content (e.g. a join-lesson link) rendered as a sibling of the card's own
   * link, never nested inside it — a link inside a link is invalid HTML and breaks keyboard/
   * screen-reader navigation.
   */
  extra?: ReactNode;
}

function SummaryItem({ item }: { item: DashboardSummaryItem }) {
  const content = (
    <>
      <span className={styles.summaryLabel}>{item.label}</span>
      <strong className={styles.summaryValue}>{item.value}</strong>
      <span className={styles.summaryDetail}>{item.detail}</span>
    </>
  );

  return (
    <div className={styles.summaryItem} data-emphasis={item.emphasis ?? "default"}>
      {item.href ? (
        <Link className={styles.summaryItemBody} href={item.href}>
          {content}
        </Link>
      ) : (
        <div className={styles.summaryItemBody}>{content}</div>
      )}
      {item.extra}
    </div>
  );
}

export function DashboardSummary({ items }: { items: readonly DashboardSummaryItem[] }) {
  return (
    <div className={styles.summaryGrid}>
      {items.map((item) => (
        <SummaryItem item={item} key={item.label} />
      ))}
    </div>
  );
}

export interface LocalizedDashboardSummaryItem extends Omit<
  DashboardSummaryItem,
  "label" | "detail" | "value"
> {
  labelKey: string;
  detailKey: string;
  value?: string;
  valueKey?: string;
}

export function LocalizedDashboardSummary({
  items,
}: {
  items: readonly LocalizedDashboardSummaryItem[];
}) {
  const t = useTranslations("dashboards");
  return (
    <DashboardSummary
      items={items.map((item) => ({
        label: t(item.labelKey),
        value: item.valueKey ? t(item.valueKey) : (item.value ?? ""),
        detail: t(item.detailKey),
        href: item.href,
        emphasis: item.emphasis,
        extra: item.extra,
      }))}
    />
  );
}

export function DashboardSummaryFallback() {
  return (
    <div className={styles.summaryGrid} aria-busy="true" aria-label="Loading dashboard signals">
      {[0, 1, 2, 3].map((item) => (
        <div className={styles.summarySkeleton} key={item}>
          <span />
          <strong />
          <span />
        </div>
      ))}
    </div>
  );
}
