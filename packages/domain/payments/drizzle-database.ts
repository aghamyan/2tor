import {
  auditEvents,
  discounts,
  invoiceItems,
  invoices,
  lessonCharges,
  lessons,
  parentProfiles,
  parentStudentLinks,
  paymentTransactions,
  prices,
  refunds,
  tutorStudentAssignments,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, desc, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";

import type {
  DiscountRecord,
  FinancialReport,
  InvoiceItemRecord,
  InvoiceRecord,
  LessonChargeRecord,
  PaymentDatabase,
  PaymentTransactionRecord,
  PriceRecord,
} from "./models";

type Executor = Database | Transaction;

function priceFromRow(row: typeof prices.$inferSelect): PriceRecord {
  return {
    id: row.id,
    subjectId: row.subjectId,
    lessonType: row.lessonType,
    amountMinor: row.amountMinor,
    currency: row.currency,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
  };
}

function chargeFromRow(row: typeof lessonCharges.$inferSelect): LessonChargeRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    parentProfileId: row.parentProfileId,
    priceId: row.priceId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    capturedAt: row.capturedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function itemFromRow(row: typeof invoiceItems.$inferSelect): InvoiceItemRecord {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    lessonChargeId: row.lessonChargeId,
    description: row.description,
    quantity: row.quantity,
    unitAmountMinor: row.unitAmountMinor,
    amountMinor: row.amountMinor,
    currency: row.currency,
    createdAt: row.createdAt,
  };
}

async function invoiceFromRow(
  executor: Executor,
  row: typeof invoices.$inferSelect,
): Promise<InvoiceRecord> {
  const items = await executor
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, row.id))
    .orderBy(asc(invoiceItems.createdAt));
  return {
    id: row.id,
    parentProfileId: row.parentProfileId,
    status: row.status,
    currency: row.currency,
    subtotalMinor: row.subtotalMinor,
    discountMinor: row.discountMinor,
    totalMinor: row.totalMinor,
    issuedAt: row.issuedAt,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: items.map(itemFromRow),
  };
}

function discountFromRow(row: typeof discounts.$inferSelect): DiscountRecord {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    percentOffBasisPoints:
      row.percentOff === null ? null : Math.round(Number(row.percentOff) * 100),
    amountOffMinor: row.amountOffMinor,
    currency: row.currency,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdByUserId: row.createdByUserId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function transactionFromRow(
  row: typeof paymentTransactions.$inferSelect,
): PaymentTransactionRecord {
  return {
    id: row.id,
    lessonChargeId: row.lessonChargeId,
    invoiceId: row.invoiceId,
    parentProfileId: row.parentProfileId,
    type: row.type,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): PaymentDatabase {
  return {
    async transaction<T>(operation: (database: PaymentDatabase) => Promise<T>) {
      return insideTransaction
        ? operation(repository(executor, root, true))
        : root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async findParentProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: parentProfiles.id })
        .from(parentProfiles)
        .where(eq(parentProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },

    async findParentUserIdByProfileId(parentProfileId) {
      const [row] = await executor
        .select({ userId: parentProfiles.userId })
        .from(parentProfiles)
        .where(eq(parentProfiles.id, parentProfileId))
        .limit(1);
      return row?.userId ?? null;
    },

    async getBillingFactsForAssignment(assignmentId, lessonId) {
      const [row] = await executor
        .select({
          parentProfileId: parentStudentLinks.parentProfileId,
          parentUserId: parentProfiles.userId,
          subjectId: lessons.subjectId,
        })
        .from(tutorStudentAssignments)
        .innerJoin(
          lessons,
          and(
            eq(lessons.id, lessonId),
            eq(lessons.tutorStudentAssignmentId, tutorStudentAssignments.id),
          ),
        )
        .innerJoin(
          parentStudentLinks,
          eq(parentStudentLinks.studentProfileId, tutorStudentAssignments.studentProfileId),
        )
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(eq(tutorStudentAssignments.id, assignmentId))
        .orderBy(desc(parentStudentLinks.isPrimary), asc(parentStudentLinks.createdAt))
        .limit(1);
      return row ?? null;
    },

    async findPrice(subjectId, lessonType, effectiveAt) {
      const [row] = await executor
        .select()
        .from(prices)
        .where(
          and(
            eq(prices.lessonType, lessonType),
            lte(prices.effectiveFrom, effectiveAt),
            or(isNull(prices.effectiveTo), gt(prices.effectiveTo, effectiveAt)),
            or(eq(prices.subjectId, subjectId), isNull(prices.subjectId)),
          ),
        )
        .orderBy(
          desc(sql<number>`case when ${prices.subjectId} = ${subjectId} then 1 else 0 end`),
          desc(prices.effectiveFrom),
        )
        .limit(1);
      return row ? priceFromRow(row) : null;
    },

    async savePrice(price) {
      await executor
        .insert(prices)
        .values({
          id: price.id,
          key: price.key,
          subjectId: price.subjectId,
          lessonType: price.lessonType,
          amountMinor: price.amountMinor,
          currency: price.currency,
          effectiveFrom: price.effectiveFrom,
          effectiveTo: price.effectiveTo,
          createdByUserId: price.createdByUserId,
          createdAt: price.createdAt,
        })
        .onConflictDoNothing();
    },

    async getLessonChargeByLessonId(lessonId) {
      const [row] = await executor
        .select()
        .from(lessonCharges)
        .where(eq(lessonCharges.lessonId, lessonId))
        .limit(1);
      return row ? chargeFromRow(row) : null;
    },

    async getLessonCharge(id) {
      const [row] = await executor
        .select()
        .from(lessonCharges)
        .where(eq(lessonCharges.id, id))
        .limit(1);
      return row ? chargeFromRow(row) : null;
    },

    async saveLessonCharge(charge) {
      await executor.insert(lessonCharges).values(charge).onConflictDoNothing();
    },

    async updateLessonCharge(id, update) {
      await executor
        .update(lessonCharges)
        .set({
          status: update.status,
          ...(update.capturedAt !== undefined ? { capturedAt: update.capturedAt } : {}),
          updatedAt: update.updatedAt,
        })
        .where(eq(lessonCharges.id, id));
    },

    async saveInvoice(invoice) {
      await executor
        .insert(invoices)
        .values({
          id: invoice.id,
          parentProfileId: invoice.parentProfileId,
          status: invoice.status,
          currency: invoice.currency,
          subtotalMinor: invoice.subtotalMinor,
          discountMinor: invoice.discountMinor,
          totalMinor: invoice.totalMinor,
          issuedAt: invoice.issuedAt,
          dueAt: invoice.dueAt,
          paidAt: invoice.paidAt,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
        })
        .onConflictDoNothing();
      if (invoice.items.length > 0) {
        await executor.insert(invoiceItems).values(invoice.items).onConflictDoNothing();
      }
    },

    async getInvoice(id) {
      const [row] = await executor.select().from(invoices).where(eq(invoices.id, id)).limit(1);
      return row ? invoiceFromRow(executor, row) : null;
    },

    async findInvoiceByLessonChargeId(lessonChargeId) {
      const [row] = await executor
        .select({ invoice: invoices })
        .from(invoices)
        .innerJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
        .where(eq(invoiceItems.lessonChargeId, lessonChargeId))
        .limit(1);
      return row ? invoiceFromRow(executor, row.invoice) : null;
    },

    async listInvoices(parentProfileId, cursor, limit) {
      const conditions = [];
      if (parentProfileId) conditions.push(eq(invoices.parentProfileId, parentProfileId));
      if (cursor) conditions.push(lt(invoices.id, cursor));
      const rows = await executor
        .select()
        .from(invoices)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(invoices.id))
        .limit(limit);
      return Promise.all(rows.map((row) => invoiceFromRow(executor, row)));
    },

    async updateInvoice(id, update) {
      await executor
        .update(invoices)
        .set({
          status: update.status,
          ...(update.paidAt !== undefined ? { paidAt: update.paidAt } : {}),
          updatedAt: update.updatedAt,
        })
        .where(eq(invoices.id, id));
    },

    async getDiscountByCode(code) {
      const [row] = await executor
        .select()
        .from(discounts)
        .where(eq(discounts.code, code))
        .limit(1);
      return row ? discountFromRow(row) : null;
    },

    async saveDiscount(discount) {
      await executor
        .insert(discounts)
        .values({
          id: discount.id,
          code: discount.code,
          type: discount.type,
          percentOff:
            discount.percentOffBasisPoints === null
              ? null
              : (discount.percentOffBasisPoints / 100).toFixed(2),
          amountOffMinor: discount.amountOffMinor,
          currency: discount.currency,
          startsAt: discount.startsAt,
          endsAt: discount.endsAt,
          createdByUserId: discount.createdByUserId,
          isActive: discount.isActive,
          createdAt: discount.createdAt,
          updatedAt: discount.updatedAt,
        })
        .onConflictDoNothing();
    },

    async setDiscountActive(id, isActive, updatedAt) {
      await executor.update(discounts).set({ isActive, updatedAt }).where(eq(discounts.id, id));
    },

    async listPaymentTransactions(parentProfileId, cursor, limit) {
      const conditions = [];
      if (parentProfileId) {
        conditions.push(eq(paymentTransactions.parentProfileId, parentProfileId));
      }
      if (cursor) conditions.push(lt(paymentTransactions.id, cursor));
      const rows = await executor
        .select()
        .from(paymentTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(paymentTransactions.id))
        .limit(limit);
      return rows.map(transactionFromRow);
    },

    async appendAudit(event) {
      await executor
        .insert(auditEvents)
        .values({
          id: event.id,
          actorUserId: event.actorUserId,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          reason: event.reason,
          previousValue: event.previousValue,
          newValue: event.newValue,
          createdAt: event.createdAt,
        })
        .onConflictDoNothing();
    },

    async claimIdempotency(event) {
      const inserted = await executor
        .insert(auditEvents)
        .values({
          id: event.id,
          actorUserId: event.actorUserId,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          reason: event.reason,
          previousValue: event.previousValue,
          newValue: event.newValue,
          createdAt: event.createdAt,
        })
        .onConflictDoNothing()
        .returning({ id: auditEvents.id });
      return inserted.length === 1;
    },

    async getFinancialReport(from, to, currency): Promise<FinancialReport> {
      const transactionRows = await executor
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.type, "charge"),
            eq(paymentTransactions.currency, currency),
            gte(paymentTransactions.createdAt, from),
            lt(paymentTransactions.createdAt, to),
          ),
        );
      const refundRows = await executor
        .select()
        .from(refunds)
        .where(
          and(
            eq(refunds.currency, currency),
            eq(refunds.status, "completed"),
            gte(refunds.createdAt, from),
            lt(refunds.createdAt, to),
          ),
        );
      const revenueMinor = transactionRows
        .filter((row) => row.status === "succeeded")
        .reduce((sum, row) => sum + row.amountMinor, 0);
      const refundsMinor = refundRows.reduce((sum, row) => sum + row.amountMinor, 0);
      return {
        from,
        to,
        currency,
        revenueMinor,
        refundsMinor,
        netRevenueMinor: revenueMinor - refundsMinor,
        succeededCount: transactionRows.filter((row) => row.status === "succeeded").length,
        failedCount: transactionRows.filter((row) => row.status === "failed").length,
        pendingCount: transactionRows.filter((row) => row.status === "pending").length,
      };
    },
  };
}

export function createDrizzlePaymentDatabase(database: Database): PaymentDatabase {
  return repository(database, database, false);
}
