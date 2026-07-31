import {
  auditEvents,
  exchangeRates,
  lessonCharges,
  lessons,
  payoutBatches,
  payoutItems,
  tutorEarningEntries,
  tutorProfiles,
  type Database,
  type Transaction,
} from "@app/db";
import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { ulid } from "ulid";

import { PayoutError } from "./errors";
import type {
  EarningReason,
  FinanceEarningLedgerRow,
  FxSnapshot,
  NewPayoutBatch,
  NewPayoutItem,
  NewTutorEarningEntry,
  PayoutBatchRecord,
  PayoutDatabase,
  PayoutItemRecord,
  TutorEarningEntryRecord,
} from "./models";

type Executor = Database | Transaction;

function endExclusive(periodEnd: string): Date {
  const end = new Date(`${periodEnd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

function earningReason(lessonStatus: string | null): EarningReason {
  return lessonStatus === "completed" ? "completed" : "chargeable";
}

function mapEarning(
  row: typeof tutorEarningEntries.$inferSelect,
  lessonStatus: string | null,
): TutorEarningEntryRecord {
  return {
    id: row.id,
    tutorProfileId: row.tutorProfileId,
    lessonId: row.lessonId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    reason: earningReason(lessonStatus),
    earnedAt: row.earnedAt,
    approvedByUserId: row.approvedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isFxSnapshot(value: unknown): value is FxSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<FxSnapshot>;
  return (
    (candidate.baseCurrency === "USD" || candidate.baseCurrency === "AMD") &&
    candidate.quoteCurrency === "AMD" &&
    typeof candidate.rate === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.conversionDate === "string"
  );
}

function fxFromAuditValue(value: unknown): FxSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const fx = (value as { fx?: unknown }).fx;
  return isFxSnapshot(fx) ? fx : null;
}

function mapBatch(
  row: typeof payoutBatches.$inferSelect,
  fx: FxSnapshot | null,
): PayoutBatchRecord {
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    currency: "AMD",
    totalAmountMinor: row.totalAmountMinor,
    status: row.status,
    processedAt: row.processedAt,
    createdByUserId: row.createdByUserId,
    fx,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function fxForBatchIds(
  executor: Executor,
  batchIds: readonly string[],
): Promise<Map<string, FxSnapshot>> {
  if (batchIds.length === 0) return new Map();
  const rows = await executor
    .select({
      resourceId: auditEvents.resourceId,
      newValue: auditEvents.newValue,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.action, "payout.batch.fx_recorded"),
        inArray(auditEvents.resourceId, [...batchIds]),
      ),
    )
    .orderBy(asc(auditEvents.createdAt));
  const result = new Map<string, FxSnapshot>();
  for (const row of rows) {
    const fx = fxFromAuditValue(row.newValue);
    if (row.resourceId && fx) result.set(row.resourceId, fx);
  }
  return result;
}

async function itemRows(executor: Executor, batchId: string) {
  return executor
    .select({
      item: payoutItems,
      earning: tutorEarningEntries,
      tutorDisplayName: tutorProfiles.publicDisplayName,
    })
    .from(payoutItems)
    .innerJoin(tutorEarningEntries, eq(tutorEarningEntries.id, payoutItems.tutorEarningEntryId))
    .innerJoin(tutorProfiles, eq(tutorProfiles.id, payoutItems.tutorProfileId))
    .where(eq(payoutItems.payoutBatchId, batchId))
    .orderBy(asc(tutorProfiles.publicDisplayName), asc(payoutItems.id));
}

function mapItem(row: Awaited<ReturnType<typeof itemRows>>[number]): PayoutItemRecord {
  return {
    id: row.item.id,
    payoutBatchId: row.item.payoutBatchId,
    tutorProfileId: row.item.tutorProfileId,
    tutorDisplayName: row.tutorDisplayName,
    tutorEarningEntryId: row.earning.id,
    lessonId: row.earning.lessonId,
    sourceAmountMinor: row.earning.amountMinor,
    sourceCurrency: row.earning.currency,
    amountMinor: row.item.amountMinor,
    currency: "AMD",
    status: row.item.status,
    evidenceRef: row.item.evidenceRef,
    paidAt: row.item.paidAt,
    createdAt: row.item.createdAt,
    updatedAt: row.item.updatedAt,
  };
}

function repository(
  executor: Executor,
  root: Database,
  insideTransaction: boolean,
): PayoutDatabase {
  return {
    async transaction<T>(operation: (database: PayoutDatabase) => Promise<T>): Promise<T> {
      if (insideTransaction) return operation(repository(executor, root, true));
      return root.transaction((transaction) => operation(repository(transaction, root, true)));
    },

    async findTutorProfileIdByUserId(userId) {
      const [row] = await executor
        .select({ id: tutorProfiles.id })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, userId))
        .limit(1);
      return row?.id ?? null;
    },

    async findEarningByLessonId(lessonId) {
      const [row] = await executor
        .select({
          earning: tutorEarningEntries,
          lessonStatus: lessons.status,
        })
        .from(tutorEarningEntries)
        .leftJoin(lessons, eq(lessons.id, tutorEarningEntries.lessonId))
        .where(eq(tutorEarningEntries.lessonId, lessonId))
        .limit(1);
      return row ? mapEarning(row.earning, row.lessonStatus) : null;
    },

    async createEarningEntry(values: NewTutorEarningEntry) {
      const [row] = await executor
        .insert(tutorEarningEntries)
        .values({
          id: values.id,
          tutorProfileId: values.tutorProfileId,
          lessonId: values.lessonId,
          amountMinor: values.amountMinor,
          currency: values.currency,
          status: values.status,
          earnedAt: values.earnedAt,
        })
        .returning();
      if (!row) throw new Error("Tutor earning insert did not return a row.");
      await executor.insert(auditEvents).values({
        id: ulid(),
        actorUserId: null,
        action: "payout.earning.created",
        resourceType: "tutor_earning_entries",
        resourceId: row.id,
        reason: "Completed/chargeable lesson earning materialized.",
        newValue: {
          lessonId: values.lessonId,
          reason: values.reason,
          copiedCompensation: values.sourceSnapshot,
          amountMinor: values.amountMinor,
          currency: values.currency,
        },
      });
      return mapEarning(row, values.reason === "completed" ? "completed" : "canceled");
    },

    async listEarningsForTutor(tutorProfileId, periodStart, periodEnd) {
      const rows = await executor
        .select({
          earning: tutorEarningEntries,
          lessonStatus: lessons.status,
        })
        .from(tutorEarningEntries)
        .leftJoin(lessons, eq(lessons.id, tutorEarningEntries.lessonId))
        .where(
          and(
            eq(tutorEarningEntries.tutorProfileId, tutorProfileId),
            gte(tutorEarningEntries.earnedAt, new Date(`${periodStart}T00:00:00.000Z`)),
            lt(tutorEarningEntries.earnedAt, endExclusive(periodEnd)),
          ),
        )
        .orderBy(desc(tutorEarningEntries.earnedAt), desc(tutorEarningEntries.id));
      return rows.map((row) => mapEarning(row.earning, row.lessonStatus));
    },

    async listFinanceEarningLedger(periodStart, periodEnd) {
      const rows = await executor
        .select({
          earning: tutorEarningEntries,
          lessonStatus: lessons.status,
          tutorDisplayName: tutorProfiles.publicDisplayName,
          companyPriceAmountMinor: lessonCharges.amountMinor,
          companyPriceCurrency: lessonCharges.currency,
        })
        .from(tutorEarningEntries)
        .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorEarningEntries.tutorProfileId))
        .leftJoin(lessons, eq(lessons.id, tutorEarningEntries.lessonId))
        .leftJoin(lessonCharges, eq(lessonCharges.lessonId, tutorEarningEntries.lessonId))
        .where(
          and(
            gte(tutorEarningEntries.earnedAt, new Date(`${periodStart}T00:00:00.000Z`)),
            lt(tutorEarningEntries.earnedAt, endExclusive(periodEnd)),
          ),
        )
        .orderBy(desc(tutorEarningEntries.earnedAt), asc(tutorProfiles.publicDisplayName));
      return rows.map((row): FinanceEarningLedgerRow => {
        const earning = mapEarning(row.earning, row.lessonStatus);
        const margin =
          row.companyPriceAmountMinor !== null && row.companyPriceCurrency === earning.currency
            ? row.companyPriceAmountMinor - earning.amountMinor
            : null;
        return {
          ...earning,
          tutorDisplayName: row.tutorDisplayName,
          companyPriceAmountMinor: row.companyPriceAmountMinor,
          companyPriceCurrency: row.companyPriceCurrency,
          companyMarginAmountMinor: margin,
        };
      });
    },

    async listEligibleEarningEntries(periodStart, periodEnd) {
      const rows = await executor
        .select({
          earning: tutorEarningEntries,
          lessonStatus: lessons.status,
        })
        .from(tutorEarningEntries)
        .leftJoin(lessons, eq(lessons.id, tutorEarningEntries.lessonId))
        .leftJoin(payoutItems, eq(payoutItems.tutorEarningEntryId, tutorEarningEntries.id))
        .where(
          and(
            eq(tutorEarningEntries.status, "approved"),
            isNull(payoutItems.id),
            gte(tutorEarningEntries.earnedAt, new Date(`${periodStart}T00:00:00.000Z`)),
            lt(tutorEarningEntries.earnedAt, endExclusive(periodEnd)),
          ),
        )
        .orderBy(asc(tutorEarningEntries.earnedAt), asc(tutorEarningEntries.id));
      return rows.map((row) => mapEarning(row.earning, row.lessonStatus));
    },

    async approveEarningEntries(entryIds, approvedByUserId) {
      if (entryIds.length === 0) return [];
      await executor
        .update(tutorEarningEntries)
        .set({
          status: "approved",
          approvedByUserId,
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(tutorEarningEntries.id, [...entryIds]),
            eq(tutorEarningEntries.status, "pending"),
          ),
        );
      const rows = await executor
        .select({
          earning: tutorEarningEntries,
          lessonStatus: lessons.status,
        })
        .from(tutorEarningEntries)
        .leftJoin(lessons, eq(lessons.id, tutorEarningEntries.lessonId))
        .where(inArray(tutorEarningEntries.id, [...entryIds]))
        .orderBy(asc(tutorEarningEntries.earnedAt), asc(tutorEarningEntries.id));
      return rows.map((row) => mapEarning(row.earning, row.lessonStatus));
    },

    async findBatchForPeriod(periodStart, periodEnd) {
      const [row] = await executor
        .select()
        .from(payoutBatches)
        .where(
          and(eq(payoutBatches.periodStart, periodStart), eq(payoutBatches.periodEnd, periodEnd)),
        )
        .limit(1);
      if (!row) return null;
      const fx = await fxForBatchIds(executor, [row.id]);
      return mapBatch(row, fx.get(row.id) ?? null);
    },

    async createPayoutBatch(values: NewPayoutBatch) {
      const proposedFxRateId = ulid();
      const asOf = new Date(`${values.fx.conversionDate}T00:00:00.000Z`);
      const [insertedRate] = await executor
        .insert(exchangeRates)
        .values({
          id: proposedFxRateId,
          baseCurrency: values.fx.baseCurrency,
          quoteCurrency: "AMD",
          rate: values.fx.rate,
          asOf,
          source: values.fx.source,
        })
        .onConflictDoNothing()
        .returning({ id: exchangeRates.id });
      let fxRateId = insertedRate?.id;
      if (!fxRateId) {
        const [existingRate] = await executor
          .select({ id: exchangeRates.id })
          .from(exchangeRates)
          .where(
            and(
              eq(exchangeRates.baseCurrency, values.fx.baseCurrency),
              eq(exchangeRates.quoteCurrency, "AMD"),
              eq(exchangeRates.asOf, asOf),
            ),
          )
          .limit(1);
        fxRateId = existingRate?.id;
      }
      if (!fxRateId) {
        throw new Error("FX snapshot insert did not return or resolve a rate row.");
      }
      const [row] = await executor
        .insert(payoutBatches)
        .values({
          id: values.id,
          periodStart: values.periodStart,
          periodEnd: values.periodEnd,
          currency: "AMD",
          totalAmountMinor: values.totalAmountMinor,
          status: values.status,
          createdByUserId: values.createdByUserId,
        })
        .returning();
      if (!row) throw new Error("Payout batch insert did not return a row.");
      await executor.insert(auditEvents).values({
        id: ulid(),
        actorUserId: values.createdByUserId,
        action: "payout.batch.fx_recorded",
        resourceType: "payout_batches",
        resourceId: values.id,
        reason: "FX snapshot selected for the monthly AMD conversion.",
        newValue: { fxRateId, fx: values.fx },
      });
      return mapBatch(row, values.fx);
    },

    async listPayoutBatches() {
      const rows = await executor
        .select()
        .from(payoutBatches)
        .orderBy(desc(payoutBatches.periodStart), desc(payoutBatches.createdAt));
      const fx = await fxForBatchIds(
        executor,
        rows.map((row) => row.id),
      );
      return rows.map((row) => mapBatch(row, fx.get(row.id) ?? null));
    },

    async findPayoutBatch(batchId) {
      const [row] = await executor
        .select()
        .from(payoutBatches)
        .where(eq(payoutBatches.id, batchId))
        .limit(1);
      if (!row) return null;
      const fx = await fxForBatchIds(executor, [row.id]);
      return mapBatch(row, fx.get(row.id) ?? null);
    },

    async createPayoutItems(values: readonly NewPayoutItem[]) {
      const [first] = values;
      if (!first) return [];
      await executor.insert(payoutItems).values(
        values.map((value) => ({
          id: value.id,
          payoutBatchId: value.payoutBatchId,
          tutorProfileId: value.tutorProfileId,
          tutorEarningEntryId: value.tutorEarningEntryId,
          amountMinor: value.amountMinor,
          currency: "AMD" as const,
          status: value.status,
        })),
      );
      return (await itemRows(executor, first.payoutBatchId)).map(mapItem);
    },

    async listPayoutItems(batchId) {
      return (await itemRows(executor, batchId)).map(mapItem);
    },

    async completePayoutBatch(batchId, evidenceRef, paidAt, actorUserId) {
      const [existing] = await executor
        .select()
        .from(payoutBatches)
        .where(eq(payoutBatches.id, batchId))
        .limit(1);
      if (!existing) throw new PayoutError("BATCH_NOT_FOUND", "Payout batch was not found.", 404);

      const linkedEntries = await executor
        .select({ id: payoutItems.tutorEarningEntryId })
        .from(payoutItems)
        .where(eq(payoutItems.payoutBatchId, batchId));
      const entryIds = linkedEntries
        .map((entry) => entry.id)
        .filter((id): id is string => id !== null);
      await executor
        .update(payoutItems)
        .set({
          status: "paid",
          evidenceRef,
          paidAt,
          updatedAt: new Date(),
        })
        .where(eq(payoutItems.payoutBatchId, batchId));
      if (entryIds.length > 0) {
        await executor
          .update(tutorEarningEntries)
          .set({ status: "paid", updatedAt: new Date() })
          .where(inArray(tutorEarningEntries.id, entryIds));
      }
      const [row] = await executor
        .update(payoutBatches)
        .set({
          status: "completed",
          processedAt: paidAt,
          updatedAt: new Date(),
        })
        .where(eq(payoutBatches.id, batchId))
        .returning();
      if (!row) throw new PayoutError("BATCH_NOT_FOUND", "Payout batch was not found.", 404);
      await executor.insert(auditEvents).values({
        id: ulid(),
        actorUserId,
        action: "payout.batch.completed",
        resourceType: "payout_batches",
        resourceId: batchId,
        reason: "Finance recorded the external payout as complete.",
        newValue: { evidenceRef, paidAt: paidAt.toISOString() },
      });
      const fx = await fxForBatchIds(executor, [batchId]);
      return mapBatch(row, fx.get(batchId) ?? null);
    },
  };
}

export function createDrizzlePayoutDatabase(database: Database): PayoutDatabase {
  return repository(database, database, false);
}
