"use client";

import { useFormatter, useTranslations } from "next-intl";

import type {
  FinancialReport,
  InvoiceRecord,
  PaymentTransactionRecord,
} from "../../../../packages/domain/payments/models";
import { DiscountForm } from "./discount-form";
import { PaymentElementForm } from "./payment-element-form";
import { RefundForm } from "./refund-form";
import styles from "./payments.module.css";

export function PaymentsOverview({
  invoices,
  transactions,
  reports,
  canPay,
  canRefund,
  canManageDiscounts,
  stripePublishableKey,
}: {
  invoices: InvoiceRecord[];
  transactions: PaymentTransactionRecord[];
  reports: FinancialReport[];
  canPay: boolean;
  canRefund: boolean;
  canManageDiscounts: boolean;
  stripePublishableKey: string | null;
}) {
  const t = useTranslations("payments");
  const format = useFormatter();
  const money = (amountMinor: number, currency: "USD" | "AMD") =>
    format.number(amountMinor / 100, { style: "currency", currency });
  const date = (value: Date | string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeZone: "UTC" }) : "—";
  const openInvoices = invoices.filter((invoice) => invoice.status === "open");
  const outstandingByCurrency = openInvoices.reduce<Record<string, number>>((totals, invoice) => {
    totals[invoice.currency] = (totals[invoice.currency] ?? 0) + invoice.totalMinor;
    return totals;
  }, {});

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t("overview.eyebrow")}</p>
          <h1>{t("overview.title")}</h1>
          <p className={styles.lede}>{t("overview.intro")}</p>
        </div>
        <div className={styles.securitySeal}>
          <span aria-hidden="true">S</span>
          <p>
            <strong>{t("overview.secureTitle")}</strong>
            {t("overview.secureBody")}
          </p>
        </div>
      </header>

      <section className={styles.settlementTape} aria-labelledby="settlement-title">
        <div className={styles.tapeLead}>
          <p>{t("summary.kicker")}</p>
          <h2 id="settlement-title">{t("summary.title")}</h2>
        </div>
        <div className={styles.tapeMetric}>
          <span>{t("summary.openInvoices")}</span>
          <strong>{openInvoices.length}</strong>
        </div>
        {(["USD", "AMD"] as const).map((currency) => (
          <div className={styles.tapeMetric} key={currency}>
            <span>{t("summary.outstanding", { currency })}</span>
            <strong>{money(outstandingByCurrency[currency] ?? 0, currency)}</strong>
          </div>
        ))}
      </section>

      {reports.length > 0 ? (
        <section className={styles.reportSection} aria-labelledby="report-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>{t("reports.eyebrow")}</p>
              <h2 id="report-title">{t("reports.title")}</h2>
            </div>
            <p>{t("reports.window")}</p>
          </div>
          <div className={styles.reportGrid}>
            {reports.map((report) => (
              <article className={styles.reportCard} key={report.currency}>
                <div className={styles.reportCurrency}>{report.currency}</div>
                <dl>
                  <div>
                    <dt>{t("reports.revenue")}</dt>
                    <dd>{money(report.revenueMinor, report.currency)}</dd>
                  </div>
                  <div>
                    <dt>{t("reports.refunds")}</dt>
                    <dd>{money(report.refundsMinor, report.currency)}</dd>
                  </div>
                  <div className={styles.netLine}>
                    <dt>{t("reports.net")}</dt>
                    <dd>{money(report.netRevenueMinor, report.currency)}</dd>
                  </div>
                  <div>
                    <dt>{t("reports.failures")}</dt>
                    <dd>{report.failedCount}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.ledgerGrid}>
        <section className={styles.invoiceSection} aria-labelledby="invoices-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>{t("invoices.eyebrow")}</p>
              <h2 id="invoices-title">{t("invoices.title")}</h2>
            </div>
            <span className={styles.count}>{invoices.length}</span>
          </div>
          {invoices.length === 0 ? (
            <p className={styles.empty}>{t("invoices.empty")}</p>
          ) : (
            <ol className={styles.invoiceRail}>
              {invoices.map((invoice) => (
                <li key={invoice.id} className={styles.invoiceCard}>
                  <div className={styles.invoiceTop}>
                    <div>
                      <span className={styles.invoiceNumber}>
                        {t("invoices.number", { id: invoice.id.slice(-8) })}
                      </span>
                      <h3>{money(invoice.totalMinor, invoice.currency)}</h3>
                    </div>
                    <span className={`${styles.status} ${styles[invoice.status]}`}>
                      <i aria-hidden="true" />
                      {t(`statuses.${invoice.status}`)}
                    </span>
                  </div>
                  <dl className={styles.invoiceFacts}>
                    <div>
                      <dt>{t("invoices.issued")}</dt>
                      <dd>{date(invoice.issuedAt)}</dd>
                    </div>
                    <div>
                      <dt>{t("invoices.due")}</dt>
                      <dd>{date(invoice.dueAt)}</dd>
                    </div>
                    <div>
                      <dt>{t("invoices.discount")}</dt>
                      <dd>{money(invoice.discountMinor, invoice.currency)}</dd>
                    </div>
                  </dl>
                  {canPay && invoice.status === "open" ? (
                    <PaymentElementForm
                      invoiceId={invoice.id}
                      publishableKey={stripePublishableKey}
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={styles.transactionSection} aria-labelledby="transactions-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>{t("transactions.eyebrow")}</p>
              <h2 id="transactions-title">{t("transactions.title")}</h2>
            </div>
          </div>
          {transactions.length === 0 ? (
            <p className={styles.empty}>{t("transactions.empty")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>{t("transactions.date")}</th>
                    <th>{t("transactions.amount")}</th>
                    <th>{t("transactions.status")}</th>
                    {canRefund ? <th>{t("transactions.action")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{date(transaction.processedAt ?? transaction.createdAt)}</td>
                      <td>{money(transaction.amountMinor, transaction.currency)}</td>
                      <td>
                        <span className={`${styles.status} ${styles[transaction.status]}`}>
                          <i aria-hidden="true" />
                          {t(`statuses.${transaction.status}`)}
                        </span>
                      </td>
                      {canRefund ? (
                        <td>
                          {transaction.status === "succeeded" ? (
                            <RefundForm
                              transactionId={transaction.id}
                              amountMinor={transaction.amountMinor}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {canManageDiscounts ? (
        <section className={styles.discountSection} aria-labelledby="discount-title">
          <div>
            <p className={styles.eyebrow}>{t("discounts.eyebrow")}</p>
            <h2 id="discount-title">{t("discounts.title")}</h2>
            <p>{t("discounts.intro")}</p>
          </div>
          <DiscountForm />
        </section>
      ) : null}
    </div>
  );
}
