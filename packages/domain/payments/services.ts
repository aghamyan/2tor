import { ulid } from "ulid";

// packages/domain cannot declare @app/auth without an out-of-scope package.json edit.
import { authorize } from "../../auth/src/index";
import type { ChargeableLessonEvent } from "../scheduling/chargeable-events";
import { PaymentError } from "./errors";
import { paymentId, requireIdempotencyKey } from "./idempotency";
import type {
  DiscountRecord,
  FinancialReport,
  InvoiceRecord,
  LessonPriceType,
  PaymentActor,
  PaymentCurrency,
  PaymentDatabase,
  PaymentPage,
  PaymentTransactionRecord,
  PriceRuleRecord,
} from "./models";
import {
  createDiscountSchema,
  createPriceSchema,
  financialReportSchema,
  invoiceListSchema,
  transactionListSchema,
  type CreateDiscountInput,
  type CreatePriceInput,
} from "./schemas";

const DAY_MS = 24 * 60 * 60 * 1_000;

function requireActor(actor: PaymentActor | null | undefined): asserts actor is PaymentActor {
  if (!actor) {
    throw new PaymentError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
  }
}

function isAdministrator(actor: PaymentActor): boolean {
  return actor.roles.includes("administrator") || actor.roles.includes("super_administrator");
}

function authorizeFinanceView(actor: PaymentActor): void {
  const decision = authorize(actor, "finance.view_transactions", {
    kind: "financial_record",
  });
  if (!decision.allowed) throw new PaymentError("FORBIDDEN", decision.reason, 403);
}

function assertSafeMoney(amountMinor: number, currency: PaymentCurrency): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new PaymentError(
      "INVALID_INPUT",
      `A ${currency} amount must be a non-negative safe integer in minor units.`,
    );
  }
}

/** Integer half-up multiplication; no floating-point money arithmetic. */
function multiplyRatio(amountMinor: number, numerator: number, denominator: number): number {
  assertSafeMoney(amountMinor, "USD");
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new PaymentError("INVALID_INPUT", "The charge ratio is invalid.");
  }
  const result =
    (BigInt(amountMinor) * BigInt(numerator) + BigInt(Math.floor(denominator / 2))) /
    BigInt(denominator);
  const value = Number(result);
  if (!Number.isSafeInteger(value)) {
    throw new PaymentError("INVALID_INPUT", "The calculated money amount is too large.");
  }
  return value;
}

function lessonPriceType(event: ChargeableLessonEvent): LessonPriceType {
  if (event.lessonKind === "group") return "group";
  if (event.lessonKind === "trial") return "trial";
  return "standard";
}

function discountAmount(
  discount: DiscountRecord | null,
  subtotalMinor: number,
  currency: PaymentCurrency,
  at: Date,
): number {
  if (
    !discount ||
    !discount.isActive ||
    (discount.startsAt && discount.startsAt > at) ||
    (discount.endsAt && discount.endsAt <= at)
  ) {
    return 0;
  }
  if (discount.percentOffBasisPoints !== null) {
    return Math.min(
      subtotalMinor,
      multiplyRatio(subtotalMinor, discount.percentOffBasisPoints, 10_000),
    );
  }
  if (discount.amountOffMinor !== null && discount.currency === currency) {
    return Math.min(subtotalMinor, discount.amountOffMinor);
  }
  return 0;
}

export interface ChargeableEventInvoiceOptions {
  idempotencyKey: string;
  discountCode?: string | null;
  now?: Date;
}

/**
 * Consumes D5's event contract. The price lookup and every copied money field are committed in
 * one transaction. lessonId's DB uniqueness plus deterministic IDs make overlapping worker scans
 * safe.
 */
export async function invoiceChargeableEvent(
  database: PaymentDatabase,
  event: ChargeableLessonEvent,
  options: ChargeableEventInvoiceOptions,
): Promise<InvoiceRecord> {
  const key = requireIdempotencyKey(options.idempotencyKey);
  if (
    !Number.isInteger(event.chargePercentage) ||
    event.chargePercentage <= 0 ||
    event.chargePercentage > 100
  ) {
    throw new PaymentError("INVALID_INPUT", "Charge percentage must be an integer from 1 to 100.");
  }
  return database.transaction(async (transaction) => {
    const existingCharge = await transaction.getLessonChargeByLessonId(event.lessonId);
    if (existingCharge) {
      const existingInvoice = await transaction.findInvoiceByLessonChargeId(existingCharge.id);
      if (existingInvoice) return existingInvoice;
    }

    const facts = await transaction.getBillingFactsForAssignment(
      event.tutorStudentAssignmentId,
      event.lessonId,
    );
    if (!facts) {
      throw new PaymentError(
        "BILLING_PARENT_NOT_FOUND",
        "No primary billing parent is linked to this lesson.",
        409,
      );
    }
    const price = await transaction.findPrice(
      facts.subjectId,
      lessonPriceType(event),
      event.scheduledStartAt,
    );
    if (!price) {
      throw new PaymentError("PRICE_NOT_FOUND", "No effective price exists for this lesson.", 409);
    }
    assertSafeMoney(price.amountMinor, price.currency);
    const subtotalMinor = multiplyRatio(price.amountMinor, event.chargePercentage, 100);
    const discount = options.discountCode
      ? await transaction.getDiscountByCode(options.discountCode.trim().toUpperCase())
      : null;
    const discountMinor = discountAmount(discount, subtotalMinor, price.currency, event.canceledAt);
    const now = options.now ?? new Date();
    const chargeId = paymentId("lesson-charge", `lesson:${event.lessonId}`);
    const invoiceId = paymentId("invoice", key);
    const charge = {
      id: chargeId,
      lessonId: event.lessonId,
      parentProfileId: facts.parentProfileId,
      priceId: price.id,
      amountMinor: subtotalMinor,
      currency: price.currency,
      status: "pending" as const,
      capturedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const invoice: InvoiceRecord = {
      id: invoiceId,
      parentProfileId: facts.parentProfileId,
      status: "open",
      currency: price.currency,
      subtotalMinor,
      discountMinor,
      totalMinor: subtotalMinor - discountMinor,
      issuedAt: now,
      dueAt: new Date(now.getTime() + DAY_MS),
      paidAt: null,
      createdAt: now,
      updatedAt: now,
      items: [
        {
          id: paymentId("invoice-item", key),
          invoiceId,
          lessonChargeId: chargeId,
          description: `Lesson charge · ${event.reasonCode}`,
          quantity: 1,
          unitAmountMinor: price.amountMinor,
          amountMinor: subtotalMinor,
          currency: price.currency,
          createdAt: now,
        },
      ],
    };
    await transaction.saveLessonCharge(charge);
    await transaction.saveInvoice(invoice);
    await transaction.appendAudit({
      id: paymentId("invoice-audit", key),
      actorUserId: null,
      action: "payments.chargeable_event.invoiced",
      resourceType: "invoices",
      resourceId: invoice.id,
      reason: event.reasonCode,
      newValue: {
        lessonId: event.lessonId,
        cancellationId: event.cancellationId,
        priceId: price.id,
        historicalUnitAmountMinor: price.amountMinor,
        chargePercentage: event.chargePercentage,
        chargedAmountMinor: subtotalMinor,
        discountMinor,
        currency: price.currency,
      },
      createdAt: now,
    });
    return invoice;
  });
}

async function parentScopeForRead(
  database: PaymentDatabase,
  actor: PaymentActor,
): Promise<string | null> {
  const financeDecision = authorize(actor, "finance.view_transactions", {
    kind: "financial_record",
  });
  if (financeDecision.allowed) return null;
  if (!actor.roles.includes("parent")) {
    throw new PaymentError("FORBIDDEN", financeDecision.reason, 403);
  }
  const parentProfileId = await database.findParentProfileIdByUserId(actor.userId);
  if (!parentProfileId) {
    throw new PaymentError("FORBIDDEN", "A billing parent profile is required.", 403);
  }
  return parentProfileId;
}

export async function listTransactionsForActor(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<PaymentPage<PaymentTransactionRecord>> {
  requireActor(actor);
  const values = transactionListSchema.parse(input);
  const parentProfileId = await parentScopeForRead(database, actor);
  const rows = await database.listPaymentTransactions(
    parentProfileId,
    values.cursor,
    values.limit + 1,
  );
  const hasNext = rows.length > values.limit;
  const items = hasNext ? rows.slice(0, values.limit) : rows;
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}

export async function listInvoicesForActor(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<PaymentPage<InvoiceRecord>> {
  requireActor(actor);
  const values = invoiceListSchema.parse(input);
  const parentProfileId = await parentScopeForRead(database, actor);
  const rows = await database.listInvoices(parentProfileId, values.cursor, values.limit + 1);
  const hasNext = rows.length > values.limit;
  const items = hasNext ? rows.slice(0, values.limit) : rows;
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}

export async function createDiscount(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: CreateDiscountInput,
  idempotencyKey: string,
): Promise<DiscountRecord> {
  requireActor(actor);
  if (!isAdministrator(actor)) {
    throw new PaymentError("FORBIDDEN", "Only administrators can control discounts.", 403);
  }
  const values = createDiscountSchema.parse(input);
  const key = requireIdempotencyKey(idempotencyKey);
  const now = new Date();
  const record: DiscountRecord = {
    id: paymentId("discount", key),
    code: values.code,
    type: values.type,
    percentOffBasisPoints: values.percentOffBasisPoints,
    amountOffMinor: values.amountOffMinor,
    currency: values.currency,
    startsAt: values.startsAt ? new Date(values.startsAt) : null,
    endsAt: values.endsAt ? new Date(values.endsAt) : null,
    createdByUserId: actor.userId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await database.transaction(async (tx) => {
    await tx.saveDiscount(record);
    await tx.appendAudit({
      id: paymentId("discount-audit", key),
      actorUserId: actor.userId,
      action: "payments.discount.created",
      resourceType: "discounts",
      resourceId: record.id,
      reason: record.type,
      newValue: {
        code: record.code,
        percentOffBasisPoints: record.percentOffBasisPoints,
        amountOffMinor: record.amountOffMinor,
        currency: record.currency,
      },
      createdAt: now,
    });
  });
  return record;
}

export async function createPriceRule(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: CreatePriceInput,
  idempotencyKey: string,
): Promise<PriceRuleRecord> {
  requireActor(actor);
  if (!isAdministrator(actor)) {
    throw new PaymentError("FORBIDDEN", "Only administrators can control lesson prices.", 403);
  }
  const values = createPriceSchema.parse(input);
  const key = requireIdempotencyKey(idempotencyKey);
  const createdAt = new Date();
  const price: PriceRuleRecord = {
    id: paymentId("price", key),
    key: values.key,
    subjectId: values.subjectId,
    lessonType: values.lessonType,
    amountMinor: values.amountMinor,
    currency: values.currency,
    effectiveFrom: new Date(values.effectiveFrom),
    effectiveTo: values.effectiveTo ? new Date(values.effectiveTo) : null,
    createdByUserId: actor.userId,
    createdAt,
  };
  await database.transaction(async (tx) => {
    await tx.savePrice(price);
    await tx.appendAudit({
      id: paymentId("price-audit", key),
      actorUserId: actor.userId,
      action: "payments.price.created",
      resourceType: "prices",
      resourceId: price.id,
      reason: price.key,
      newValue: {
        subjectId: price.subjectId,
        lessonType: price.lessonType,
        amountMinor: price.amountMinor,
        currency: price.currency,
        effectiveFrom: price.effectiveFrom.toISOString(),
        effectiveTo: price.effectiveTo?.toISOString() ?? null,
      },
      createdAt,
    });
  });
  return price;
}

export async function setDiscountActive(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  discountId: string,
  active: boolean,
  idempotencyKey: string,
): Promise<void> {
  requireActor(actor);
  if (!isAdministrator(actor)) {
    throw new PaymentError("FORBIDDEN", "Only administrators can control discounts.", 403);
  }
  const key = requireIdempotencyKey(idempotencyKey);
  const now = new Date();
  await database.transaction(async (tx) => {
    const claimed = await tx.claimIdempotency({
      id: paymentId("discount-state-claim", key),
      actorUserId: actor.userId,
      action: "payments.discount.state_changed",
      resourceType: "discounts",
      resourceId: discountId,
      reason: active ? "activated" : "deactivated",
      newValue: { isActive: active },
      createdAt: now,
    });
    if (claimed) await tx.setDiscountActive(discountId, active, now);
  });
}

export async function getFinancialReportForActor(
  database: PaymentDatabase,
  actor: PaymentActor | null | undefined,
  input: { from: string; to: string; currency: PaymentCurrency },
): Promise<FinancialReport> {
  requireActor(actor);
  authorizeFinanceView(actor);
  const values = financialReportSchema.parse(input);
  return database.getFinancialReport(new Date(values.from), new Date(values.to), values.currency);
}

/** Used by tests and worker diagnostics; all generated write IDs remain ULID-shaped. */
export function newPaymentOperationKey(): string {
  return ulid();
}
