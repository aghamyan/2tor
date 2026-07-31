# Payments

This slice owns customer billing from a Scheduling (D5) chargeable event through a copied lesson
charge, invoice, Stripe authorization/capture, receipt, refund, and finance report. It does not
read or return academic records or messages.

## Chargeable event → invoice → receipt

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
5. A parent requests a Payment Intent. The server creates a Stripe customer reference and a
   pending transaction, then creates a manual-capture Payment Intent with the same idempotency
   key. The browser mounts Stripe Payment Element using only its client secret.
6. Stripe's signed `payment_intent.amount_capturable_updated` webhook marks the charge authorized.
   The reconciliation job captures it, and `payment_intent.succeeded` is the sole authority that
   marks the transaction captured/invoice paid and dispatches the receipt.

All money is a safe integer minor-unit value plus `USD` or `AMD`. Percentage application uses
integer/`BigInt` half-up arithmetic; money calculations never use floating point.

## Idempotency strategy

Every internal payment write requires an `Idempotency-Key`. The key is namespaced and SHA-256
hashed into a deterministic, ULID-shaped primary key. Retrying the same operation therefore
conflicts with the same primary key and returns/reuses the original record. Stripe receives that
same logical key on customer, Payment Intent, capture, and refund calls.

D5 scans may overlap freely: `lesson_charges.lesson_id` is unique and the charge ID is derived from
the lesson. Invoice/line/audit IDs are deterministic and the whole materialization is transactional.

The existing schema has no separate Stripe event table, and this slice is prohibited from changing
`packages/db`. The webhook therefore claims `audit_events.id =
paymentId("stripe-webhook", stripeEvent.id)` with one `INSERT ... ON CONFLICT DO NOTHING RETURNING`.
The claim and all local state changes run in the same database transaction:

- one returned row means the event is new and may be applied;
- no returned row means it is a replay and no payment state or notification is applied again;
- a failure rolls back the claim, allowing Stripe's retry to process the event.

The raw webhook body is passed to `stripe.webhooks.constructEvent()` before JSON normalization.
Missing or invalid `Stripe-Signature` values are rejected.

## Card-data boundary

The application never renders its own card-number field. `PaymentElementForm` mounts Stripe's
hosted Payment Element and sends only an invoice ID to this application. Persisted payment-method
data is restricted by the database schema to Stripe customer/payment-method references and safe
display metadata (`brand`, `last4`, expiry). PAN/CVC values are neither accepted by an API schema
nor represented by a domain model.

## Refunds, discounts, and access

- `requestRefund()` calls canonical `authorize(actor, "finance.refund", ...)`, reserves the amount
  against previous non-failed refunds, writes the refund and append-only audit row in one
  transaction, then calls Stripe idempotently. Large refunds inherit auth's fresh-MFA rule.
- The signed refund webhook completes/fails the local refund and dispatches
  `payment_refund`. Full refunds mark the copied lesson charge refunded.
- Receipt/failure/refund notices use the shared notification dispatcher when configured. Because
  this repository currently has no shared dispatcher composition root, the payments webhook has
  an idempotent localized in-app fallback; the notice is not lost and replay cannot duplicate it.
- Only administrators/super-administrators can create or activate sibling, referral, promotional,
  or manual discounts.
- Finance/admin transaction and report reads call
  `authorize(actor, "finance.view_transactions", {kind: "financial_record"})`. Parent reads are
  scoped to their own `parent_profile_id`. The returned records contain billing identifiers and
  money only—no student academic data or messages. Canonical auth independently denies a finance
  role reading an academic message.

## Reports and reconciliation

`getFinancialReportForActor()` reports captured revenue, completed refunds, net revenue, and
succeeded/failed/pending charge counts for one currency and UTC interval. USD and AMD are never
silently combined.

Two auto-discovered worker jobs live in `apps/worker/src/jobs/payments`:

- `payments.reconcile-chargeable-events` polls D5 every five minutes with a seven-day overlap.
- `payments.capture-authorizations` asks Stripe to capture eligible manual authorizations every
  two minutes. Stripe webhooks remain authoritative for the final local status.
