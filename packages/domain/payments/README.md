# Payments

This slice owns billing records from a Scheduling (D5) chargeable event through a copied lesson
charge, invoice, and finance report. It does not read or return academic records or messages.

Card payment collection (Stripe) has been removed. This slice no longer authorizes, captures, or
refunds a charge — it materializes invoices from D5 events and exposes read/report access plus
discount and price-rule administration. A future payment processor integration would add a
collection flow on top of the same `lesson_charges`/`invoices` records.

## Chargeable event → invoice

1. `payments.reconcile-chargeable-events` polls D5 with an overlapping lookback window.
2. D5 returns only chargeable cancellations/no-shows. A tutor cancellation, trial, technical
   issue, or on-time cancellation produces no event and therefore no charge.
3. `invoiceChargeableEvent()` resolves the primary billing parent and the price effective at the
   lesson's scheduled time. Subject-specific prices win over general prices, so the model supports
   variable pricing even if launch data contains one active price.
4. The service applies D5's integer `chargePercentage`, optionally applies an active
   administrator-created discount, and copies the resolved money into `lesson_charges`,
   `invoices`, and `invoice_items` in one transaction. `invoice_items.unit_amount_minor` preserves
   the full historical unit price; the charge/item amount preserves the policy-adjusted amount.
   Later price edits never rewrite that history.

All money is a safe integer minor-unit value plus `USD` or `AMD`. Percentage application uses
integer/`BigInt` half-up arithmetic; money calculations never use floating point.

## Idempotency strategy

Every internal payment write requires an `Idempotency-Key`. The key is namespaced and SHA-256
hashed into a deterministic, ULID-shaped primary key. Retrying the same operation therefore
conflicts with the same primary key and returns/reuses the original record.

D5 scans may overlap freely: `lesson_charges.lesson_id` is unique and the charge ID is derived from
the lesson. Invoice/line/audit IDs are deterministic and the whole materialization is transactional.

## Discounts and access

- Only administrators/super-administrators can create or activate sibling, referral, promotional,
  or manual discounts.
- Finance/admin transaction and report reads call
  `authorize(actor, "finance.view_transactions", {kind: "financial_record"})`. Parent reads are
  scoped to their own `parent_profile_id`. The returned records contain billing identifiers and
  money only—no student academic data or messages. Canonical auth independently denies a finance
  role reading an academic message.

## Reports

`getFinancialReportForActor()` reports captured revenue, completed refunds, net revenue, and
succeeded/failed/pending charge counts for one currency and UTC interval. USD and AMD are never
silently combined. Since nothing currently writes a `succeeded` payment transaction or a
`completed` refund, these reports read as zero until a payment processor is reconnected.

One auto-discovered worker job lives in `apps/worker/src/jobs/payments`:

- `payments.reconcile-chargeable-events` polls D5 every five minutes with a seven-day overlap.
