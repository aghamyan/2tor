export type PaymentCurrency = "USD" | "AMD";
export type PaymentRole =
  "parent" | "student" | "tutor" | "finance" | "administrator" | "super_administrator";
export type LessonPriceType = "standard" | "trial" | "group";
export type LessonChargeStatus =
  "pending" | "authorized" | "captured" | "failed" | "refunded" | "waived";
export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";
export type PaymentTransactionStatus = "pending" | "succeeded" | "failed" | "canceled";
export type RefundStatus = "pending" | "processing" | "completed" | "failed";
export type DiscountType = "sibling" | "referral" | "promotional" | "admin_manual";

export interface PaymentActor {
  userId: string;
  roles: readonly PaymentRole[];
  mfaVerifiedAt?: Date | null;
}

export interface PriceRecord {
  id: string;
  subjectId: string | null;
  lessonType: LessonPriceType;
  amountMinor: number;
  currency: PaymentCurrency;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface PriceRuleRecord extends PriceRecord {
  key: string;
  createdByUserId: string;
  createdAt: Date;
}

export interface LessonChargeRecord {
  id: string;
  lessonId: string;
  parentProfileId: string;
  priceId: string | null;
  amountMinor: number;
  currency: PaymentCurrency;
  status: LessonChargeStatus;
  capturedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItemRecord {
  id: string;
  invoiceId: string;
  lessonChargeId: string | null;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  amountMinor: number;
  currency: PaymentCurrency;
  createdAt: Date;
}

export interface InvoiceRecord {
  id: string;
  parentProfileId: string;
  status: InvoiceStatus;
  currency: PaymentCurrency;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: InvoiceItemRecord[];
}

export interface PaymentTransactionRecord {
  id: string;
  lessonChargeId: string | null;
  invoiceId: string | null;
  parentProfileId: string;
  type: "charge" | "refund" | "adjustment";
  amountMinor: number;
  currency: PaymentCurrency;
  status: PaymentTransactionStatus;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscountRecord {
  id: string;
  code: string | null;
  type: DiscountType;
  /** Integer basis points: 1_000 means 10.00%. */
  percentOffBasisPoints: number | null;
  amountOffMinor: number | null;
  currency: PaymentCurrency | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdByUserId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialReport {
  from: Date;
  to: Date;
  currency: PaymentCurrency;
  revenueMinor: number;
  refundsMinor: number;
  netRevenueMinor: number;
  succeededCount: number;
  failedCount: number;
  pendingCount: number;
}

export interface PaymentPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ChargeableEventBillingFacts {
  parentProfileId: string;
  parentUserId: string;
  subjectId: string;
}

export interface PaymentAuditRecord {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt: Date;
}

export interface PaymentDatabase {
  transaction<T>(operation: (database: PaymentDatabase) => Promise<T>): Promise<T>;

  findParentProfileIdByUserId(userId: string): Promise<string | null>;
  findParentUserIdByProfileId(parentProfileId: string): Promise<string | null>;
  getBillingFactsForAssignment(
    assignmentId: string,
    lessonId: string,
  ): Promise<ChargeableEventBillingFacts | null>;
  findPrice(
    subjectId: string,
    lessonType: LessonPriceType,
    effectiveAt: Date,
  ): Promise<PriceRecord | null>;
  savePrice(price: PriceRuleRecord): Promise<void>;

  getLessonChargeByLessonId(lessonId: string): Promise<LessonChargeRecord | null>;
  getLessonCharge(id: string): Promise<LessonChargeRecord | null>;
  saveLessonCharge(charge: LessonChargeRecord): Promise<void>;
  updateLessonCharge(
    id: string,
    update: { status: LessonChargeStatus; capturedAt?: Date | null; updatedAt: Date },
  ): Promise<void>;

  saveInvoice(invoice: InvoiceRecord): Promise<void>;
  getInvoice(id: string): Promise<InvoiceRecord | null>;
  findInvoiceByLessonChargeId(lessonChargeId: string): Promise<InvoiceRecord | null>;
  listInvoices(
    parentProfileId: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<InvoiceRecord[]>;
  updateInvoice(
    id: string,
    update: { status: InvoiceStatus; paidAt?: Date | null; updatedAt: Date },
  ): Promise<void>;

  getDiscountByCode(code: string): Promise<DiscountRecord | null>;
  saveDiscount(discount: DiscountRecord): Promise<void>;
  setDiscountActive(id: string, isActive: boolean, updatedAt: Date): Promise<void>;

  listPaymentTransactions(
    parentProfileId: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<PaymentTransactionRecord[]>;

  appendAudit(event: PaymentAuditRecord): Promise<void>;
  /** Atomic insert-if-absent. False means this exact external event was already applied. */
  claimIdempotency(event: PaymentAuditRecord): Promise<boolean>;
  getFinancialReport(from: Date, to: Date, currency: PaymentCurrency): Promise<FinancialReport>;
}
