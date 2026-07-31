import type {
  ChargeableEventBillingFacts,
  DiscountRecord,
  FinancialReport,
  InvoiceRecord,
  LessonChargeRecord,
  LessonPriceType,
  PaymentAuditRecord,
  PaymentCurrency,
  PaymentCustomerRecord,
  PaymentDatabase,
  PaymentTransactionRecord,
  PriceRecord,
  PriceRuleRecord,
  RefundRecord,
  TransactionUpdate,
} from "../../../../../packages/domain/payments/models";

export class InMemoryPaymentDatabase implements PaymentDatabase {
  readonly parentProfilesByUser = new Map<string, string>();
  readonly parentUsersByProfile = new Map<string, string>();
  readonly billingFacts = new Map<string, ChargeableEventBillingFacts>();
  readonly prices = new Map<string, PriceRecord>();
  readonly charges = new Map<string, LessonChargeRecord>();
  readonly invoices = new Map<string, InvoiceRecord>();
  readonly discounts = new Map<string, DiscountRecord>();
  readonly customers = new Map<string, PaymentCustomerRecord>();
  readonly transactions = new Map<string, PaymentTransactionRecord>();
  readonly refunds = new Map<string, RefundRecord>();
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

  async getPaymentCustomer(parentProfileId: string) {
    return (
      [...this.customers.values()].find(
        (customer) => customer.parentProfileId === parentProfileId,
      ) ?? null
    );
  }

  async savePaymentCustomer(customer: PaymentCustomerRecord) {
    const existing = await this.getPaymentCustomer(customer.parentProfileId);
    if (!existing) this.customers.set(customer.id, customer);
  }

  async savePaymentTransaction(transaction: PaymentTransactionRecord) {
    if (!this.transactions.has(transaction.id)) this.transactions.set(transaction.id, transaction);
  }

  async getPaymentTransaction(id: string) {
    return this.transactions.get(id) ?? null;
  }

  async getPaymentTransactionForUpdate(id: string) {
    return this.transactions.get(id) ?? null;
  }

  async getPaymentTransactionByStripeIntent(stripePaymentIntentId: string) {
    return (
      [...this.transactions.values()].find(
        (transaction) => transaction.stripePaymentIntentId === stripePaymentIntentId,
      ) ?? null
    );
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

  async listAuthorizedTransactions(limit: number) {
    return [...this.transactions.values()]
      .filter((transaction) => {
        const charge = transaction.lessonChargeId
          ? this.charges.get(transaction.lessonChargeId)
          : null;
        return transaction.status === "pending" && charge?.status === "authorized";
      })
      .slice(0, limit);
  }

  async updatePaymentTransaction(id: string, update: TransactionUpdate & { updatedAt: Date }) {
    const transaction = this.transactions.get(id);
    if (!transaction) return;
    this.transactions.set(id, {
      ...transaction,
      status: update.status ?? transaction.status,
      stripePaymentIntentId: update.stripePaymentIntentId ?? transaction.stripePaymentIntentId,
      processedAt: update.processedAt === undefined ? transaction.processedAt : update.processedAt,
      updatedAt: update.updatedAt,
    });
  }

  async saveRefund(refund: RefundRecord) {
    if (!this.refunds.has(refund.id)) this.refunds.set(refund.id, refund);
  }

  async getRefund(id: string) {
    return this.refunds.get(id) ?? null;
  }

  async listRefundsForTransaction(paymentTransactionId: string) {
    return [...this.refunds.values()].filter(
      (refund) => refund.paymentTransactionId === paymentTransactionId,
    );
  }

  async updateRefund(
    id: string,
    update: { status: RefundRecord["status"]; processedAt?: Date | null; updatedAt: Date },
  ) {
    const refund = this.refunds.get(id);
    if (refund) {
      this.refunds.set(id, {
        ...refund,
        status: update.status,
        processedAt: update.processedAt === undefined ? refund.processedAt : update.processedAt,
        updatedAt: update.updatedAt,
      });
    }
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
    const refundRows = [...this.refunds.values()].filter(
      (refund) =>
        refund.currency === currency &&
        refund.status === "completed" &&
        refund.createdAt >= from &&
        refund.createdAt < to,
    );
    const revenueMinor = transactionRows
      .filter((transaction) => transaction.status === "succeeded")
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
    const refundsMinor = refundRows.reduce((sum, refund) => sum + refund.amountMinor, 0);
    return {
      from,
      to,
      currency,
      revenueMinor,
      refundsMinor,
      netRevenueMinor: revenueMinor - refundsMinor,
      succeededCount: transactionRows.filter((item) => item.status === "succeeded").length,
      failedCount: transactionRows.filter((item) => item.status === "failed").length,
      pendingCount: transactionRows.filter((item) => item.status === "pending").length,
    };
  }
}
