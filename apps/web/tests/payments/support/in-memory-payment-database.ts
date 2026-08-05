import type {
  ChargeableEventBillingFacts,
  DiscountRecord,
  FinancialReport,
  InvoiceRecord,
  LessonChargeRecord,
  LessonPriceType,
  PaymentAuditRecord,
  PaymentCurrency,
  PaymentDatabase,
  PaymentTransactionRecord,
  PriceRecord,
  PriceRuleRecord,
} from "../../../../../packages/domain/payments/models";

export class InMemoryPaymentDatabase implements PaymentDatabase {
  readonly parentProfilesByUser = new Map<string, string>();
  readonly parentUsersByProfile = new Map<string, string>();
  readonly billingFacts = new Map<string, ChargeableEventBillingFacts>();
  readonly prices = new Map<string, PriceRecord>();
  readonly charges = new Map<string, LessonChargeRecord>();
  readonly invoices = new Map<string, InvoiceRecord>();
  readonly discounts = new Map<string, DiscountRecord>();
  readonly transactions = new Map<string, PaymentTransactionRecord>();
  readonly audits = new Map<string, PaymentAuditRecord>();

  async transaction<T>(operation: (database: PaymentDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findParentProfileIdByUserId(userId: string) {
    return this.parentProfilesByUser.get(userId) ?? null;
  }

  async findParentUserIdByProfileId(parentProfileId: string) {
    return this.parentUsersByProfile.get(parentProfileId) ?? null;
  }

  async getBillingFactsForAssignment(assignmentId: string, lessonId: string) {
    return this.billingFacts.get(`${assignmentId}:${lessonId}`) ?? null;
  }

  async findPrice(subjectId: string, lessonType: LessonPriceType, effectiveAt: Date) {
    return (
      [...this.prices.values()]
        .filter(
          (price) =>
            (price.subjectId === subjectId || price.subjectId === null) &&
            price.lessonType === lessonType &&
            price.effectiveFrom <= effectiveAt &&
            (price.effectiveTo === null || price.effectiveTo > effectiveAt),
        )
        .sort((left, right) => {
          const specificity =
            Number(right.subjectId === subjectId) - Number(left.subjectId === subjectId);
          return specificity || right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
        })[0] ?? null
    );
  }

  async savePrice(price: PriceRuleRecord) {
    if (!this.prices.has(price.id)) this.prices.set(price.id, price);
  }

  async getLessonChargeByLessonId(lessonId: string) {
    return [...this.charges.values()].find((charge) => charge.lessonId === lessonId) ?? null;
  }

  async getLessonCharge(id: string) {
    return this.charges.get(id) ?? null;
  }

  async saveLessonCharge(charge: LessonChargeRecord) {
    if (![...this.charges.values()].some((item) => item.lessonId === charge.lessonId)) {
      this.charges.set(charge.id, charge);
    }
  }

  async updateLessonCharge(
    id: string,
    update: { status: LessonChargeRecord["status"]; capturedAt?: Date | null; updatedAt: Date },
  ) {
    const charge = this.charges.get(id);
    if (charge) {
      this.charges.set(id, {
        ...charge,
        status: update.status,
        capturedAt: update.capturedAt === undefined ? charge.capturedAt : update.capturedAt,
        updatedAt: update.updatedAt,
      });
    }
  }

  async saveInvoice(invoice: InvoiceRecord) {
    if (!this.invoices.has(invoice.id)) this.invoices.set(invoice.id, invoice);
  }

  async getInvoice(id: string) {
    return this.invoices.get(id) ?? null;
  }

  async findInvoiceByLessonChargeId(lessonChargeId: string) {
    return (
      [...this.invoices.values()].find((invoice) =>
        invoice.items.some((item) => item.lessonChargeId === lessonChargeId),
      ) ?? null
    );
  }

  async listInvoices(parentProfileId: string | null, cursor: string | null, limit: number) {
    return [...this.invoices.values()]
      .filter(
        (invoice) =>
          (parentProfileId === null || invoice.parentProfileId === parentProfileId) &&
          (cursor === null || invoice.id < cursor),
      )
      .sort((left, right) => right.id.localeCompare(left.id))
      .slice(0, limit);
  }

  async updateInvoice(
    id: string,
    update: { status: InvoiceRecord["status"]; paidAt?: Date | null; updatedAt: Date },
  ) {
    const invoice = this.invoices.get(id);
    if (invoice) {
      this.invoices.set(id, {
        ...invoice,
        status: update.status,
        paidAt: update.paidAt === undefined ? invoice.paidAt : update.paidAt,
        updatedAt: update.updatedAt,
      });
    }
  }

  async getDiscountByCode(code: string) {
    return [...this.discounts.values()].find((discount) => discount.code === code) ?? null;
  }

  async saveDiscount(discount: DiscountRecord) {
    if (!this.discounts.has(discount.id)) this.discounts.set(discount.id, discount);
  }

  async setDiscountActive(id: string, isActive: boolean, updatedAt: Date) {
    const discount = this.discounts.get(id);
    if (discount) this.discounts.set(id, { ...discount, isActive, updatedAt });
  }

  async listPaymentTransactions(
    parentProfileId: string | null,
    cursor: string | null,
    limit: number,
  ) {
    return [...this.transactions.values()]
      .filter(
        (transaction) =>
          (parentProfileId === null || transaction.parentProfileId === parentProfileId) &&
          (cursor === null || transaction.id < cursor),
      )
      .sort((left, right) => right.id.localeCompare(left.id))
      .slice(0, limit);
  }

  async appendAudit(event: PaymentAuditRecord) {
    if (!this.audits.has(event.id)) this.audits.set(event.id, event);
  }

  async claimIdempotency(event: PaymentAuditRecord) {
    if (this.audits.has(event.id)) return false;
    this.audits.set(event.id, event);
    return true;
  }

  async getFinancialReport(
    from: Date,
    to: Date,
    currency: PaymentCurrency,
  ): Promise<FinancialReport> {
    const transactionRows = [...this.transactions.values()].filter(
      (transaction) =>
        transaction.currency === currency &&
        transaction.type === "charge" &&
        transaction.createdAt >= from &&
        transaction.createdAt < to,
    );
    const revenueMinor = transactionRows
      .filter((transaction) => transaction.status === "succeeded")
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
    return {
      from,
      to,
      currency,
      revenueMinor,
      refundsMinor: 0,
      netRevenueMinor: revenueMinor,
      succeededCount: transactionRows.filter((item) => item.status === "succeeded").length,
      failedCount: transactionRows.filter((item) => item.status === "failed").length,
      pendingCount: transactionRows.filter((item) => item.status === "pending").length,
    };
  }
}
