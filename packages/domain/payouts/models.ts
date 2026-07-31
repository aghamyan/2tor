export type PayoutRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";

export interface PayoutActor {
  userId: string;
  roles: readonly PayoutRole[];
  mfaVerifiedAt?: Date | null;
}

export type PayoutCurrency = "USD" | "AMD";
export type TutorEarningStatus = "pending" | "approved" | "paid" | "voided";
export type PayoutBatchStatus = "draft" | "processing" | "completed" | "failed";
export type PayoutItemStatus = "pending" | "paid" | "failed";
export type EarningReason = "completed" | "chargeable";

/**
 * D5/Payments supplies one event per completed or otherwise chargeable lesson. Compensation is
 * the full historical rate that applied when the lesson became earned; `earningPercentage`
 * applies cancellation/no-show policy to that snapshot.
 */
export interface LessonEarningEvent {
  lessonId: string;
  tutorProfileId: string;
  outcome: EarningReason;
  isTrial: boolean;
  earnedAt: Date;
  scheduledCompensationAmountMinor: number;
  compensationCurrency: PayoutCurrency;
  earningPercentage: number;
  /** Finance-only context. It is never copied into tutor-facing DTOs. */
  companyPriceAmountMinor?: number | null;
  /** Finance-only context. It is never copied into tutor-facing DTOs. */
  companyPriceCurrency?: PayoutCurrency | null;
}

export interface LessonEarningSourceFilter {
  periodStart: string;
  periodEnd: string;
}

export interface LessonEarningSource {
  listLessonEarningEvents(filter: LessonEarningSourceFilter): Promise<LessonEarningEvent[]>;
}

export interface TutorEarningEntryRecord {
  id: string;
  tutorProfileId: string;
  lessonId: string | null;
  amountMinor: number;
  currency: PayoutCurrency;
  status: TutorEarningStatus;
  reason: EarningReason;
  earnedAt: Date;
  approvedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTutorEarningEntry {
  id: string;
  tutorProfileId: string;
  lessonId: string;
  amountMinor: number;
  currency: PayoutCurrency;
  status: "pending";
  reason: EarningReason;
  earnedAt: Date;
  sourceSnapshot: {
    scheduledCompensationAmountMinor: number;
    earningPercentage: number;
    isTrial: boolean;
  };
}

export interface FxSnapshot {
  baseCurrency: PayoutCurrency;
  quoteCurrency: "AMD";
  /** Decimal AMD per one base-currency unit, stored as a string to avoid binary floating point. */
  rate: string;
  source: string;
  /** YYYY-MM-DD, the date used for conversion. */
  conversionDate: string;
}

export interface PayoutBatchRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  currency: "AMD";
  totalAmountMinor: number;
  status: PayoutBatchStatus;
  processedAt: Date | null;
  createdByUserId: string;
  fx: FxSnapshot | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPayoutBatch {
  id: string;
  periodStart: string;
  periodEnd: string;
  currency: "AMD";
  totalAmountMinor: number;
  status: "draft";
  createdByUserId: string;
  fx: FxSnapshot;
}

export interface PayoutItemRecord {
  id: string;
  payoutBatchId: string;
  tutorProfileId: string;
  tutorDisplayName: string;
  tutorEarningEntryId: string;
  lessonId: string | null;
  sourceAmountMinor: number;
  sourceCurrency: PayoutCurrency;
  amountMinor: number;
  currency: "AMD";
  status: PayoutItemStatus;
  evidenceRef: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPayoutItem {
  id: string;
  payoutBatchId: string;
  tutorProfileId: string;
  tutorEarningEntryId: string;
  amountMinor: number;
  currency: "AMD";
  status: "pending";
}

/** Internal finance ledger. Company price and margin must never appear in TutorEarningsSummary. */
export interface FinanceEarningLedgerRow extends TutorEarningEntryRecord {
  tutorDisplayName: string;
  companyPriceAmountMinor: number | null;
  companyPriceCurrency: PayoutCurrency | null;
  companyMarginAmountMinor: number | null;
}

export interface TutorEarningLine {
  id: string;
  lessonId: string | null;
  amountMinor: number;
  currency: PayoutCurrency;
  status: TutorEarningStatus;
  reason: EarningReason;
  earnedAt: Date;
}

export interface TutorExpectedTotal {
  currency: PayoutCurrency;
  amountMinor: number;
}

/**
 * Deliberately narrow tutor projection. Do not add company price, parent charge, or margin fields.
 */
export interface TutorEarningsSummary {
  periodStart: string;
  periodEnd: string;
  completedLessonCount: number;
  chargeableLessonCount: number;
  expectedTotals: TutorExpectedTotal[];
  entries: TutorEarningLine[];
}

export interface FinancePayoutBatchView extends PayoutBatchRecord {
  items: PayoutItemRecord[];
  reconciliation: PayoutReconciliation;
}

export interface FinancePayoutDashboard {
  kind: "finance";
  periodStart: string;
  periodEnd: string;
  ledger: FinanceEarningLedgerRow[];
  batches: FinancePayoutBatchView[];
}

export interface TutorPayoutDashboard {
  kind: "tutor";
  summary: TutorEarningsSummary;
}

export type PayoutDashboard = FinancePayoutDashboard | TutorPayoutDashboard;

export interface PayoutReconciliation {
  batchTotalAmountMinor: number;
  itemTotalAmountMinor: number;
  differenceAmountMinor: number;
  reconciled: boolean;
}

export interface EarningIngestionResult {
  created: TutorEarningEntryRecord[];
  skippedExistingLessonIds: string[];
  skippedTrialLessonIds: string[];
}

export interface PayoutDatabase {
  transaction<T>(operation: (database: PayoutDatabase) => Promise<T>): Promise<T>;

  findTutorProfileIdByUserId(userId: string): Promise<string | null>;
  findEarningByLessonId(lessonId: string): Promise<TutorEarningEntryRecord | null>;
  createEarningEntry(values: NewTutorEarningEntry): Promise<TutorEarningEntryRecord>;
  listEarningsForTutor(
    tutorProfileId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<TutorEarningEntryRecord[]>;
  listFinanceEarningLedger(
    periodStart: string,
    periodEnd: string,
  ): Promise<FinanceEarningLedgerRow[]>;
  listEligibleEarningEntries(
    periodStart: string,
    periodEnd: string,
  ): Promise<TutorEarningEntryRecord[]>;
  approveEarningEntries(
    entryIds: readonly string[],
    approvedByUserId: string,
  ): Promise<TutorEarningEntryRecord[]>;

  findBatchForPeriod(periodStart: string, periodEnd: string): Promise<PayoutBatchRecord | null>;
  createPayoutBatch(values: NewPayoutBatch): Promise<PayoutBatchRecord>;
  listPayoutBatches(): Promise<PayoutBatchRecord[]>;
  findPayoutBatch(batchId: string): Promise<PayoutBatchRecord | null>;
  createPayoutItems(values: readonly NewPayoutItem[]): Promise<PayoutItemRecord[]>;
  listPayoutItems(batchId: string): Promise<PayoutItemRecord[]>;
  completePayoutBatch(
    batchId: string,
    evidenceRef: string,
    paidAt: Date,
    actorUserId: string,
  ): Promise<PayoutBatchRecord>;
}
