"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type {
  FinancePayoutDashboard,
  PayoutCurrency,
  PayoutDashboard,
  TutorPayoutDashboard,
} from "../../../../packages/domain/payouts/models";
import {
  approveEarningsAction,
  completePayoutBatchAction,
  createPayoutBatchAction,
} from "../../app/(app)/payouts/actions";
import { INITIAL_PAYOUT_ACTION_STATE } from "../../app/(app)/payouts/action-state";
import { ActionFeedback } from "./action-feedback";
import styles from "./payouts.module.css";

function formatMinor(amountMinor: number, currency: PayoutCurrency, locale: string): string {
  const amount = amountMinor / 100;
  if (currency === "AMD") {
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)} ֏`;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function shortDate(value: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function TutorView({ dashboard, locale }: { dashboard: TutorPayoutDashboard; locale: string }) {
  const t = useTranslations("payouts");
  const summary = dashboard.summary;
  return (
    <main className={styles.shell}>
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>{t("tutor.eyebrow")}</p>
        <h1 className={styles.title}>{t("tutor.title")}</h1>
        <p className={styles.lede}>
          {t("tutor.period", {
            start: summary.periodStart,
            end: summary.periodEnd,
          })}
        </p>
      </header>

      <section className={styles.tutorSummary} aria-label={t("tutor.summaryLabel")}>
        <div className={styles.countBlock}>
          <span className={styles.bigCount}>{summary.completedLessonCount}</span>
          <span className={styles.countLabel}>{t("tutor.completedLessons")}</span>
        </div>
        <div className={styles.expectedBlock}>
          <span className={styles.utilityLabel}>{t("tutor.expectedTotal")}</span>
          {summary.expectedTotals.length === 0 ? (
            <strong className={styles.expectedAmount}>{t("common.none")}</strong>
          ) : (
            summary.expectedTotals.map((total) => (
              <strong className={styles.expectedAmount} key={total.currency}>
                {formatMinor(total.amountMinor, total.currency, locale)}
              </strong>
            ))
          )}
          {summary.chargeableLessonCount > 0 ? (
            <span className={styles.smallNote}>
              {t("tutor.chargeableCount", { count: summary.chargeableLessonCount })}
            </span>
          ) : null}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.utilityLabel}>{t("tutor.ledgerEyebrow")}</p>
            <h2>{t("tutor.ledgerTitle")}</h2>
          </div>
        </div>
        {summary.entries.length === 0 ? (
          <p className={styles.empty}>{t("tutor.empty")}</p>
        ) : (
          <ul className={styles.tutorEntries}>
            {summary.entries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{t(`reason.${entry.reason}`)}</strong>
                  <span>{shortDate(entry.earnedAt, locale)}</span>
                </div>
                <div className={styles.entryAmount}>
                  <strong>{formatMinor(entry.amountMinor, entry.currency, locale)}</strong>
                  <span className={styles.status} data-status={entry.status}>
                    {t(`status.${entry.status}`)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function FinanceView({ dashboard, locale }: { dashboard: FinancePayoutDashboard; locale: string }) {
  const t = useTranslations("payouts");
  const [approveState, approveAction, approving] = useActionState(
    approveEarningsAction,
    INITIAL_PAYOUT_ACTION_STATE,
  );
  const [batchState, batchAction, creating] = useActionState(
    createPayoutBatchAction,
    INITIAL_PAYOUT_ACTION_STATE,
  );
  const [completeState, completeAction, completing] = useActionState(
    completePayoutBatchAction,
    INITIAL_PAYOUT_ACTION_STATE,
  );
  const pendingEntries = dashboard.ledger.filter((entry) => entry.status === "pending");

  return (
    <main className={styles.shell}>
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>{t("finance.eyebrow")}</p>
        <h1 className={styles.title}>{t("finance.title")}</h1>
        <p className={styles.lede}>{t("finance.intro")}</p>
      </header>

      <ActionFeedback state={approveState} />
      <ActionFeedback state={batchState} />
      <ActionFeedback state={completeState} />

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.utilityLabel}>{t("finance.batchEyebrow")}</p>
            <h2>{t("finance.batchesTitle")}</h2>
          </div>
          <span className={styles.periodChip}>
            {dashboard.periodStart} — {dashboard.periodEnd}
          </span>
        </div>

        {dashboard.batches.length === 0 ? (
          <p className={styles.empty}>{t("finance.noBatches")}</p>
        ) : (
          <div className={styles.batchList}>
            {dashboard.batches.map((batch) => (
              <article className={styles.batchCard} key={batch.id}>
                <header className={styles.batchHeader}>
                  <div>
                    <span className={styles.utilityLabel}>{batch.periodStart.slice(0, 7)}</span>
                    <h3>{formatMinor(batch.totalAmountMinor, "AMD", locale)}</h3>
                  </div>
                  <span className={styles.status} data-status={batch.status}>
                    {t(`status.${batch.status}`)}
                  </span>
                </header>

                <div className={styles.balanceRail} data-balanced={batch.reconciliation.reconciled}>
                  <div>
                    <span>{t("finance.batchTotal")}</span>
                    <strong>
                      {formatMinor(batch.reconciliation.batchTotalAmountMinor, "AMD", locale)}
                    </strong>
                  </div>
                  <span className={styles.equals} aria-hidden="true">
                    =
                  </span>
                  <div>
                    <span>{t("finance.itemTotal")}</span>
                    <strong>
                      {formatMinor(batch.reconciliation.itemTotalAmountMinor, "AMD", locale)}
                    </strong>
                  </div>
                  <span className={styles.balanceResult}>
                    {batch.reconciliation.reconciled
                      ? t("finance.reconciled")
                      : t("finance.difference", {
                          amount: formatMinor(
                            batch.reconciliation.differenceAmountMinor,
                            "AMD",
                            locale,
                          ),
                        })}
                  </span>
                </div>

                <dl className={styles.fxFacts}>
                  <div>
                    <dt>{t("finance.fxRate")}</dt>
                    <dd>
                      {batch.fx
                        ? `${batch.fx.baseCurrency}/AMD ${batch.fx.rate}`
                        : t("common.missing")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("finance.fxSource")}</dt>
                    <dd>{batch.fx?.source ?? t("common.missing")}</dd>
                  </div>
                  <div>
                    <dt>{t("finance.conversionDate")}</dt>
                    <dd>{batch.fx?.conversionDate ?? t("common.missing")}</dd>
                  </div>
                  <div>
                    <dt>{t("finance.items")}</dt>
                    <dd>{batch.items.length}</dd>
                  </div>
                </dl>

                <div className={styles.batchActions}>
                  <a
                    className={styles.secondaryButton}
                    href={`/api/payouts/batches/${batch.id}/export`}
                  >
                    {t("finance.exportCsv")}
                  </a>
                  {batch.status !== "completed" ? (
                    <form action={completeAction} className={styles.evidenceForm}>
                      <input type="hidden" name="batchId" value={batch.id} />
                      <label>
                        <span>{t("finance.evidenceRef")}</span>
                        <input
                          name="evidenceRef"
                          placeholder={t("finance.evidencePlaceholder")}
                          required
                        />
                      </label>
                      <button disabled={completing} type="submit">
                        {completing ? t("common.saving") : t("finance.markComplete")}
                      </button>
                    </form>
                  ) : (
                    <p className={styles.evidenceRecorded}>
                      {t("finance.evidenceRecorded", {
                        reference: batch.items[0]?.evidenceRef ?? t("common.missing"),
                      })}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.workbench}>
        <div>
          <p className={styles.utilityLabel}>{t("finance.approvalEyebrow")}</p>
          <h2>{t("finance.approvalTitle")}</h2>
          <p>{t("finance.approvalHelp", { count: pendingEntries.length })}</p>
          <form action={approveAction}>
            {pendingEntries.map((entry) => (
              <input key={entry.id} type="hidden" name="entryId" value={entry.id} />
            ))}
            <button disabled={approving || pendingEntries.length === 0} type="submit">
              {approving ? t("common.saving") : t("finance.approvePending")}
            </button>
          </form>
        </div>
        <form action={batchAction} className={styles.batchForm}>
          <div className={styles.formHeading}>
            <p className={styles.utilityLabel}>{t("finance.newBatchEyebrow")}</p>
            <h2>{t("finance.newBatchTitle")}</h2>
          </div>
          <label>
            <span>{t("finance.periodStart")}</span>
            <input defaultValue={dashboard.periodStart} name="periodStart" type="date" required />
          </label>
          <label>
            <span>{t("finance.periodEnd")}</span>
            <input defaultValue={dashboard.periodEnd} name="periodEnd" type="date" required />
          </label>
          <label>
            <span>{t("finance.baseCurrency")}</span>
            <select defaultValue="USD" name="baseCurrency">
              <option value="USD">USD</option>
              <option value="AMD">AMD</option>
            </select>
          </label>
          <label>
            <span>{t("finance.rate")}</span>
            <input inputMode="decimal" name="rate" placeholder="405.50" required />
          </label>
          <label className={styles.wideField}>
            <span>{t("finance.source")}</span>
            <input name="source" placeholder={t("finance.sourcePlaceholder")} required />
          </label>
          <label>
            <span>{t("finance.conversionDate")}</span>
            <input name="conversionDate" type="date" required />
          </label>
          <button className={styles.wideField} disabled={creating} type="submit">
            {creating ? t("common.saving") : t("finance.createBatch")}
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.utilityLabel}>{t("finance.ledgerEyebrow")}</p>
            <h2>{t("finance.ledgerTitle")}</h2>
          </div>
          <span>{t("finance.entryCount", { count: dashboard.ledger.length })}</span>
        </div>
        {dashboard.ledger.length === 0 ? (
          <p className={styles.empty}>{t("finance.noEarnings")}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.ledger}>
              <thead>
                <tr>
                  <th>{t("finance.tutor")}</th>
                  <th>{t("finance.earnedAt")}</th>
                  <th>{t("finance.reason")}</th>
                  <th>{t("finance.tutorEarning")}</th>
                  <th>{t("finance.companyPrice")}</th>
                  <th>{t("finance.margin")}</th>
                  <th>{t("finance.status")}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.tutorDisplayName}</strong>
                      <span>{entry.lessonId ?? "—"}</span>
                    </td>
                    <td>{shortDate(entry.earnedAt, locale)}</td>
                    <td>{t(`reason.${entry.reason}`)}</td>
                    <td>{formatMinor(entry.amountMinor, entry.currency, locale)}</td>
                    <td>
                      {entry.companyPriceAmountMinor !== null && entry.companyPriceCurrency !== null
                        ? formatMinor(
                            entry.companyPriceAmountMinor,
                            entry.companyPriceCurrency,
                            locale,
                          )
                        : "—"}
                    </td>
                    <td>
                      {entry.companyMarginAmountMinor !== null
                        ? formatMinor(entry.companyMarginAmountMinor, entry.currency, locale)
                        : "—"}
                    </td>
                    <td>
                      <span className={styles.status} data-status={entry.status}>
                        {t(`status.${entry.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export function PayoutOverview({ dashboard }: { dashboard: PayoutDashboard }) {
  const locale = useLocale();
  return dashboard.kind === "tutor" ? (
    <TutorView dashboard={dashboard} locale={locale} />
  ) : (
    <FinanceView dashboard={dashboard} locale={locale} />
  );
}
