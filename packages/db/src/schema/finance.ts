import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { currencyEnum, minorUnits, timestamps, ulidFk, ulidPk, utcTimestamp } from "./_common";
import { users } from "./identity";
import { parentProfiles } from "./families";
import { tutorProfiles } from "./tutors";
import { lessons } from "./scheduling";
import { subjects } from "./academic";

/**
 * Finance domain. Every money column is an integer minor-unit `bigint` + explicit `currency`
 * (spec §15: "financial records use integer cents," "tutor AMD payouts use integer luma"). Prices
 * and tutor compensation are looked up at charge/earning time and their values COPIED onto
 * `lesson_charges`/`tutor_earning_entries` — those rows never recompute from a possibly-since-
 * changed `prices`/rate row. No card numbers are stored anywhere; `payment_methods_reference`
 * only ever holds a Stripe token reference plus display metadata (brand/last4).
 */

export const lessonTypeEnum = pgEnum("lesson_type", ["standard", "trial", "group"]);
export const lessonChargeStatusEnum = pgEnum("lesson_charge_status", [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "waived",
]);
export const discountTypeEnum = pgEnum("discount_type", [
  "sibling",
  "referral",
  "promotional",
  "admin_manual",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);
export const paymentTransactionTypeEnum = pgEnum("payment_transaction_type", [
  "charge",
  "refund",
  "adjustment",
]);
export const paymentTransactionStatusEnum = pgEnum("payment_transaction_status", [
  "pending",
  "succeeded",
  "failed",
  "canceled",
]);
export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const tutorEarningStatusEnum = pgEnum("tutor_earning_status", [
  "pending",
  "approved",
  "paid",
  "voided",
]);
export const payoutBatchStatusEnum = pgEnum("payout_batch_status", [
  "draft",
  "processing",
  "completed",
  "failed",
]);
export const payoutItemStatusEnum = pgEnum("payout_item_status", ["pending", "paid", "failed"]);

/** Variable price rules (spec §2.3), even though MVP may only populate one active row per lesson type. */
export const prices = pgTable("prices", {
  id: ulidPk(),
  key: text("key").unique(),
  subjectId: ulidFk("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
  lessonType: lessonTypeEnum("lesson_type").notNull().default("standard"),
  amountMinor: minorUnits("amount_minor").notNull(),
  currency: currencyEnum("currency").notNull(),
  effectiveFrom: utcTimestamp("effective_from").notNull(),
  effectiveTo: utcTimestamp("effective_to"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamps.createdAt,
});

/** `amount_minor`/`currency` are a snapshot copied from `prices` at charge time — never re-derived. */
export const lessonCharges = pgTable("lesson_charges", {
  id: ulidPk(),
  lessonId: ulidFk("lesson_id")
    .notNull()
    .unique()
    .references(() => lessons.id, { onDelete: "restrict" }),
  parentProfileId: ulidFk("parent_profile_id")
    .notNull()
    .references(() => parentProfiles.id, { onDelete: "restrict" }),
  priceId: ulidFk("price_id").references(() => prices.id, { onDelete: "restrict" }),
  amountMinor: minorUnits("amount_minor").notNull(),
  currency: currencyEnum("currency").notNull(),
  status: lessonChargeStatusEnum("status").notNull().default("pending"),
  capturedAt: utcTimestamp("captured_at"),
  ...timestamps,
});

export const paymentCustomers = pgTable("payment_customers", {
  id: ulidPk(),
  parentProfileId: ulidFk("parent_profile_id")
    .notNull()
    .unique()
    .references(() => parentProfiles.id, { onDelete: "restrict" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  ...timestamps,
});

/** Stripe token reference and display metadata only — never a card number (spec §12.4/§4.3). */
export const paymentMethodsReference = pgTable("payment_methods_reference", {
  id: ulidPk(),
  paymentCustomerId: ulidFk("payment_customer_id")
    .notNull()
    .references(() => paymentCustomers.id, { onDelete: "cascade" }),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
  brand: text("brand"),
  last4: text("last4"),
  expMonth: integer("exp_month"),
  expYear: integer("exp_year"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamps.createdAt,
});

export const discounts = pgTable("discounts", {
  id: ulidPk(),
  code: text("code").unique(),
  type: discountTypeEnum("type").notNull(),
  percentOff: numeric("percent_off", { precision: 5, scale: 2 }),
  amountOffMinor: minorUnits("amount_off_minor"),
  currency: currencyEnum("currency"),
  startsAt: utcTimestamp("starts_at"),
  endsAt: utcTimestamp("ends_at"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const invoices = pgTable("invoices", {
  id: ulidPk(),
  parentProfileId: ulidFk("parent_profile_id")
    .notNull()
    .references(() => parentProfiles.id, { onDelete: "restrict" }),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  currency: currencyEnum("currency").notNull(),
  subtotalMinor: minorUnits("subtotal_minor").notNull(),
  discountMinor: minorUnits("discount_minor").notNull().default(0),
  totalMinor: minorUnits("total_minor").notNull(),
  issuedAt: utcTimestamp("issued_at"),
  dueAt: utcTimestamp("due_at"),
  paidAt: utcTimestamp("paid_at"),
  ...timestamps,
});

export const invoiceItems = pgTable("invoice_items", {
  id: ulidPk(),
  invoiceId: ulidFk("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  lessonChargeId: ulidFk("lesson_charge_id").references(() => lessonCharges.id, {
    onDelete: "restrict",
  }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitAmountMinor: minorUnits("unit_amount_minor").notNull(),
  amountMinor: minorUnits("amount_minor").notNull(),
  currency: currencyEnum("currency").notNull(),
  createdAt: timestamps.createdAt,
});

export const paymentTransactions = pgTable("payment_transactions", {
  id: ulidPk(),
  lessonChargeId: ulidFk("lesson_charge_id").references(() => lessonCharges.id, {
    onDelete: "restrict",
  }),
  invoiceId: ulidFk("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
  parentProfileId: ulidFk("parent_profile_id")
    .notNull()
    .references(() => parentProfiles.id, { onDelete: "restrict" }),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  type: paymentTransactionTypeEnum("type").notNull(),
  amountMinor: minorUnits("amount_minor").notNull(),
  currency: currencyEnum("currency").notNull(),
  status: paymentTransactionStatusEnum("status").notNull().default("pending"),
  processedAt: utcTimestamp("processed_at"),
  ...timestamps,
});

export const refunds = pgTable("refunds", {
  id: ulidPk(),
  paymentTransactionId: ulidFk("payment_transaction_id")
    .notNull()
    .references(() => paymentTransactions.id, { onDelete: "restrict" }),
  amountMinor: minorUnits("amount_minor").notNull(),
  currency: currencyEnum("currency").notNull(),
  reason: text("reason").notNull(),
  status: refundStatusEnum("status").notNull().default("pending"),
  requestedByUserId: ulidFk("requested_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  approvedByUserId: ulidFk("approved_by_user_id").references(() => users.id),
  processedAt: utcTimestamp("processed_at"),
  ...timestamps,
});

/** `amount_minor`/`currency` are a snapshot of the tutor's compensation rate at the time the lesson was earned. */
export const tutorEarningEntries = pgTable("tutor_earning_entries", {
  id: ulidPk(),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "restrict" }),
  lessonId: ulidFk("lesson_id").references(() => lessons.id, { onDelete: "restrict" }),
  amountMinor: minorUnits("amount_minor").notNull(),
  currency: currencyEnum("currency").notNull(),
  status: tutorEarningStatusEnum("status").notNull().default("pending"),
  earnedAt: utcTimestamp("earned_at").notNull(),
  approvedByUserId: ulidFk("approved_by_user_id").references(() => users.id),
  ...timestamps,
});

export const payoutBatches = pgTable("payout_batches", {
  id: ulidPk(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  currency: currencyEnum("currency").notNull(),
  totalAmountMinor: minorUnits("total_amount_minor").notNull(),
  status: payoutBatchStatusEnum("status").notNull().default("draft"),
  processedAt: utcTimestamp("processed_at"),
  createdByUserId: ulidFk("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
});

export const payoutItems = pgTable("payout_items", {
  id: ulidPk(),
  payoutBatchId: ulidFk("payout_batch_id")
    .notNull()
    .references(() => payoutBatches.id, { onDelete: "cascade" }),
  tutorProfileId: ulidFk("tutor_profile_id")
    .notNull()
    .references(() => tutorProfiles.id, { onDelete: "restrict" }),
  tutorEarningEntryId: ulidFk("tutor_earning_entry_id").references(() => tutorEarningEntries.id, {
    onDelete: "restrict",
  }),
  amountMinor: minorUnits("amount_minor").notNull(),
  currency: currencyEnum("currency").notNull(),
  status: payoutItemStatusEnum("status").notNull().default("pending"),
  /** External payout completion evidence (spec §4.4: "Mark external payout completion with evidence"). */
  evidenceRef: text("evidence_ref"),
  paidAt: utcTimestamp("paid_at"),
  ...timestamps,
});

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: ulidPk(),
    baseCurrency: currencyEnum("base_currency").notNull(),
    quoteCurrency: currencyEnum("quote_currency").notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    asOf: utcTimestamp("as_of").notNull(),
    source: text("source"),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("exchange_rates_unique").on(table.baseCurrency, table.quoteCurrency, table.asOf),
  ],
);
