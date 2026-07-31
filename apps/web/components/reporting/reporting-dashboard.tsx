"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  AggregateMetric,
  FunnelStage,
  MoneyMetric,
  ReportingSnapshot,
} from "../../../../packages/domain/reporting/models";
import styles from "./reporting.module.css";

function metricText(
  metric: AggregateMetric,
  locale: string,
  suppressedLabel: string,
  unavailableLabel: string,
): string {
  if (metric.suppressed) return suppressedLabel;
  if (metric.value === null) return unavailableLabel;
  if (metric.unit === "percent") return `${metric.value.toLocaleString(locale)}%`;
  if (metric.unit === "percentage_points") {
    const sign = metric.value > 0 ? "+" : "";
    return `${sign}${metric.value.toLocaleString(locale)} pp`;
  }
  if (metric.unit === "hours") return `${metric.value.toLocaleString(locale)} h`;
  if (metric.unit === "minutes") return `${metric.value.toLocaleString(locale)} min`;
  return metric.value.toLocaleString(locale);
}

function MetricCard({
  label,
  detail,
  metric,
  locale,
  suppressedLabel,
  unavailableLabel,
}: {
  label: string;
  detail: string;
  metric: AggregateMetric;
  locale: string;
  suppressedLabel: string;
  unavailableLabel: string;
}) {
  return (
    <article className={styles.metricCard}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>
        {metricText(metric, locale, suppressedLabel, unavailableLabel)}
      </p>
      <p className={styles.metricDetail}>{detail}</p>
      {!metric.suppressed && metric.sampleSize !== null && metric.sampleSize > 0 ? (
        <p className={styles.sample}>n = {metric.sampleSize.toLocaleString(locale)}</p>
      ) : null}
    </article>
  );
}

function MoneyCard({
  metric,
  locale,
  label,
  detail,
  suppressedLabel,
  unavailableLabel,
}: {
  metric: MoneyMetric;
  locale: string;
  label: string;
  detail: string;
  suppressedLabel: string;
  unavailableLabel: string;
}) {
  const value =
    metric.value === null
      ? metric.suppressed
        ? suppressedLabel
        : unavailableLabel
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: metric.currency,
        }).format(metric.value / 100);
  return (
    <article className={styles.metricCard}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>{value}</p>
      <p className={styles.metricDetail}>{detail}</p>
      {!metric.suppressed && metric.sampleSize ? (
        <p className={styles.sample}>n = {metric.sampleSize.toLocaleString(locale)}</p>
      ) : null}
    </article>
  );
}

export function ReportingDashboard({ report }: { report: ReportingSnapshot }) {
  const t = useTranslations("reporting");
  const locale = useLocale();
  const suppressedLabel = t("common.suppressed");
  const unavailableLabel = t("common.unavailable");
  const visibleCounts = report.funnel.stages
    .map((item) => item.reached.value)
    .filter((value): value is number => value !== null);
  const maximumFunnelCount = Math.max(1, ...visibleCounts);

  const operationalMetrics: {
    key: Exclude<keyof ReportingSnapshot["operational"], "marginPerLesson">;
    metric: AggregateMetric;
  }[] = [
    { key: "tutorAttendanceRate", metric: report.operational.tutorAttendanceRate },
    { key: "studentAttendanceRate", metric: report.operational.studentAttendanceRate },
    { key: "missingFeedbackRate", metric: report.operational.missingFeedbackRate },
    { key: "cancellationRate", metric: report.operational.cancellationRate },
    { key: "supportResolutionRate", metric: report.operational.supportResolutionRate },
    { key: "supportResolutionHours", metric: report.operational.supportResolutionHours },
    { key: "utilizationRate", metric: report.operational.utilizationRate },
    { key: "paymentFailureRate", metric: report.operational.paymentFailureRate },
    { key: "refundRate", metric: report.operational.refundRate },
  ];
  const academicMetrics: {
    key: Exclude<keyof ReportingSnapshot["academic"], "selfReportedSchoolPerformanceLabel">;
    metric: AggregateMetric;
  }[] = [
    { key: "baselineScore", metric: report.academic.baselineScore },
    { key: "followUpScore", metric: report.academic.followUpScore },
    { key: "baselineToFollowUpChange", metric: report.academic.baselineToFollowUpChange },
    { key: "milestoneCompletionRate", metric: report.academic.milestoneCompletionRate },
    { key: "planProgressRate", metric: report.academic.planProgressRate },
    { key: "accuracyTrend", metric: report.academic.accuracyTrend },
    { key: "rubricImprovement", metric: report.academic.rubricImprovement },
    { key: "selfReportedSchoolPerformance", metric: report.academic.selfReportedSchoolPerformance },
  ];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{t("overview.kicker")}</p>
          <h1>{t("overview.title")}</h1>
          <p className={styles.intro}>{t("overview.intro")}</p>
        </div>
        <div className={styles.periodBlock}>
          <span>{t("overview.period")}</span>
          <strong>
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
              new Date(report.period.start),
            )}
            {" — "}
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
              new Date(new Date(report.period.end).getTime() - 1),
            )}
          </strong>
          <small>{t("overview.utc")}</small>
        </div>
      </header>

      <div className={styles.controls} aria-label={t("overview.cadence")}>
        <Link
          className={report.cadence === "weekly" ? styles.activeCadence : styles.cadence}
          href="/reporting?cadence=weekly"
        >
          {t("overview.weekly")}
        </Link>
        <Link
          className={report.cadence === "monthly" ? styles.activeCadence : styles.cadence}
          href="/reporting?cadence=monthly"
        >
          {t("overview.monthly")}
        </Link>
        <span className={styles.generated}>
          {t("overview.generated", {
            date: new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            }).format(new Date(report.generatedAt)),
          })}
        </span>
      </div>

      <section className={styles.funnelSection} aria-labelledby="funnel-heading">
        <div className={styles.sectionLead}>
          <p className={styles.sectionIndex}>A</p>
          <div>
            <h2 id="funnel-heading">{t("funnel.title")}</h2>
            <p>{t("funnel.intro")}</p>
          </div>
        </div>
        <ol className={styles.funnel}>
          {report.funnel.stages.map((item, index) => {
            const width =
              item.reached.value === null ? 0 : (item.reached.value / maximumFunnelCount) * 100;
            return (
              <li
                key={item.stage}
                className={styles.funnelRow}
                style={{ "--meter-width": `${width}%` } as CSSProperties}
              >
                <span className={styles.stageNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.stageCopy}>
                  <strong>{t(`funnel.stages.${item.stage as FunnelStage}`)}</strong>
                  <span>
                    {item.conversionFromPrior
                      ? t("funnel.fromPrior", {
                          value: metricText(
                            item.conversionFromPrior,
                            locale,
                            suppressedLabel,
                            unavailableLabel,
                          ),
                        })
                      : t("funnel.entry")}
                  </span>
                </div>
                <div className={styles.meter} aria-hidden="true">
                  <span />
                </div>
                <b>{metricText(item.reached, locale, suppressedLabel, unavailableLabel)}</b>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={styles.metricSection} aria-labelledby="operations-heading">
        <div className={styles.sectionLead}>
          <p className={styles.sectionIndex}>B</p>
          <div>
            <h2 id="operations-heading">{t("operational.title")}</h2>
            <p>{t("operational.intro")}</p>
          </div>
        </div>
        <div className={styles.metricGrid}>
          {operationalMetrics.map(({ key, metric: value }) => (
            <MetricCard
              key={key}
              label={t(`operational.metrics.${key}.label`)}
              detail={t(`operational.metrics.${key}.detail`)}
              metric={value}
              locale={locale}
              suppressedLabel={suppressedLabel}
              unavailableLabel={unavailableLabel}
            />
          ))}
          {report.operational.marginPerLesson.length === 0 ? (
            <MetricCard
              label={t("operational.metrics.marginPerLesson.label")}
              detail={t("operational.metrics.marginPerLesson.detail")}
              metric={{
                value: null,
                numerator: null,
                denominator: null,
                unit: "minor_currency_units",
                suppressed: false,
                sampleSize: 0,
              }}
              locale={locale}
              suppressedLabel={suppressedLabel}
              unavailableLabel={unavailableLabel}
            />
          ) : (
            report.operational.marginPerLesson.map((value) => (
              <MoneyCard
                key={value.currency}
                label={`${t("operational.metrics.marginPerLesson.label")} · ${value.currency}`}
                detail={t("operational.metrics.marginPerLesson.detail")}
                metric={value}
                locale={locale}
                suppressedLabel={suppressedLabel}
                unavailableLabel={unavailableLabel}
              />
            ))
          )}
        </div>
      </section>

      <section className={styles.metricSection} aria-labelledby="academic-heading">
        <div className={styles.sectionLead}>
          <p className={styles.sectionIndex}>C</p>
          <div>
            <h2 id="academic-heading">{t("academic.title")}</h2>
            <p>{t("academic.intro")}</p>
          </div>
        </div>
        <div className={styles.metricGrid}>
          {academicMetrics.map(({ key, metric: value }) => (
            <MetricCard
              key={key}
              label={t(`academic.metrics.${key}.label`)}
              detail={t(`academic.metrics.${key}.detail`)}
              metric={value}
              locale={locale}
              suppressedLabel={suppressedLabel}
              unavailableLabel={unavailableLabel}
            />
          ))}
        </div>
      </section>

      <aside className={styles.privacyBoundary} aria-label={t("privacy.title")}>
        <span className={styles.privacyMark} aria-hidden="true">
          ∅
        </span>
        <div>
          <h2>{t("privacy.title")}</h2>
          <p>{t("privacy.body", { count: report.privacy.minimumCohortSize })}</p>
          <p className={styles.never}>{t("privacy.never")}</p>
        </div>
      </aside>
    </div>
  );
}
