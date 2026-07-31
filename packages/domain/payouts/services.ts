import { ulid } from "ulid";

import { PayoutError } from "./errors";
import type { CompletePayoutBatchInput, CreatePayoutBatchInput } from "./schemas";
import {
  completePayoutBatchInputSchema,
  createPayoutBatchInputSchema,
  lessonEarningEventSchema,
  lessonEarningSourceFilterSchema,
} from "./schemas";
import { DEFAULT_PAYOUT_POLICY, type PayoutPolicyConfig } from "./policy";
import type {
  EarningIngestionResult,
  FinanceEarningLedgerRow,
  FinancePayoutBatchView,
  FxSnapshot,
  LessonEarningSource,
  PayoutActor,
  PayoutBatchRecord,
  PayoutDashboard,
  PayoutDatabase,
  PayoutItemRecord,
  PayoutReconciliation,
  TutorEarningEntryRecord,
  TutorEarningsSummary,
} from "./models";

function requireActor(actor: PayoutActor | null | undefined): asserts actor is PayoutActor {
  if (!actor) throw new PayoutError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
}

function requireFinance(
  actor: PayoutActor | null | undefined,
  _action: "finance.view_transactions" | "finance.generate_payout",
): asserts actor is PayoutActor {
  requireActor(actor);
  const permitted = actor.roles.some((role) =>
    ["finance", "administrator", "super_administrator"].includes(role),
  );
  if (!permitted) {
    throw new PayoutError("FORBIDDEN", "Finance access is required.", 403);
  }
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function assertMonthlyPeriod(periodStart: string, periodEnd: string): void {
  const start = parseDateOnly(periodStart);
  const end = parseDateOnly(periodEnd);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.getUTCDate() !== 1 ||
    end.getTime() < start.getTime()
  ) {
    throw new PayoutError(
      "INVALID_INPUT",
      "Payout periods must start on the first day of a month.",
      400,
    );
  }
  const expectedEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  if (end.getTime() !== expectedEnd.getTime()) {
    throw new PayoutError(
      "INVALID_INPUT",
      "Payout periods must end on the last day of the same month.",
      400,
    );
  }
}

function safeAdd(left: number, right: number): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    throw new PayoutError("INVALID_INPUT", "Money total exceeds the safe integer range.", 400);
  }
  return total;
}

function percentageAmount(amountMinor: number, percentage: number): number {
  const numerator = BigInt(amountMinor) * BigInt(percentage);
  const rounded = (numerator + 50n) / 100n;
  const amount = Number(rounded);
  if (!Number.isSafeInteger(amount)) {
    throw new PayoutError("INVALID_INPUT", "Earning amount exceeds the safe integer range.", 400);
  }
  return amount;
}

function decimalRatio(value: string): { numerator: bigint; denominator: bigint } {
  const [whole = "0", fraction = ""] = value.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  return {
    numerator: BigInt(`${whole}${fraction}`),
    denominator,
  };
}

/** Converts same-scale minor units (USD cents or AMD luma) with decimal, half-up rounding. */
export function convertToAmdLuma(
  amountMinor: number,
  currency: "USD" | "AMD",
  fx: FxSnapshot,
): number {
  if (currency === "AMD") return amountMinor;
  if (fx.baseCurrency !== currency || fx.quoteCurrency !== "AMD") {
    throw new PayoutError(
      "FX_CURRENCY_MISMATCH",
      `The ${fx.baseCurrency}/AMD rate cannot convert ${currency} earnings.`,
      409,
    );
  }
  const ratio = decimalRatio(fx.rate);
  const numerator = BigInt(amountMinor) * ratio.numerator;
  const rounded = (numerator + ratio.denominator / 2n) / ratio.denominator;
  const converted = Number(rounded);
  if (!Number.isSafeInteger(converted)) {
    throw new PayoutError("INVALID_INPUT", "Converted payout exceeds the safe integer range.", 400);
  }
  return converted;
}

/**
 * Idempotently materializes immutable earning snapshots from the D5 boundary. A later change to a
 * tutor's compensation fixture/rate never updates an existing lesson entry.
 */
export async function recordLessonEarnings(
  database: PayoutDatabase,
  source: LessonEarningSource,
  rawFilter: { periodStart: string; periodEnd: string },
  policy: PayoutPolicyConfig = DEFAULT_PAYOUT_POLICY,
): Promise<EarningIngestionResult> {
  const filter = lessonEarningSourceFilterSchema.parse(rawFilter);
  const events = (await source.listLessonEarningEvents(filter)).map((event) =>
    lessonEarningEventSchema.parse(event),
  );

  return database.transaction(async (transaction) => {
    const result: EarningIngestionResult = {
      created: [],
      skippedExistingLessonIds: [],
      skippedTrialLessonIds: [],
    };

    for (const event of events) {
      if (event.isTrial && !policy.payTrialLessons) {
        result.skippedTrialLessonIds.push(event.lessonId);
        continue;
      }
      if (await transaction.findEarningByLessonId(event.lessonId)) {
        result.skippedExistingLessonIds.push(event.lessonId);
        continue;
      }
      const amountMinor = percentageAmount(
        event.scheduledCompensationAmountMinor,
        event.earningPercentage,
      );
      result.created.push(
        await transaction.createEarningEntry({
          id: ulid(),
          tutorProfileId: event.tutorProfileId,
          lessonId: event.lessonId,
          amountMinor,
          currency: event.compensationCurrency,
          status: "pending",
          reason: event.outcome,
          earnedAt: event.earnedAt,
          sourceSnapshot: {
            scheduledCompensationAmountMinor: event.scheduledCompensationAmountMinor,
            earningPercentage: event.earningPercentage,
            isTrial: event.isTrial,
          },
        }),
      );
    }
    return result;
  });
}

export async function approveEarningEntries(
  database: PayoutDatabase,
  actor: PayoutActor | null | undefined,
  entryIds: readonly string[],
): Promise<TutorEarningEntryRecord[]> {
  requireFinance(actor, "finance.generate_payout");
  if (entryIds.length === 0) return [];
  return database.approveEarningEntries([...new Set(entryIds)], actor.userId);
}

export function reconcilePayoutBatch(
  batch: Pick<PayoutBatchRecord, "totalAmountMinor">,
  items: readonly Pick<PayoutItemRecord, "amountMinor">[],
): PayoutReconciliation {
  const itemTotalAmountMinor = items.reduce((total, item) => safeAdd(total, item.amountMinor), 0);
  const differenceAmountMinor = batch.totalAmountMinor - itemTotalAmountMinor;
  return {
    batchTotalAmountMinor: batch.totalAmountMinor,
    itemTotalAmountMinor,
    differenceAmountMinor,
    reconciled: differenceAmountMinor === 0,
  };
}

export async function createMonthlyPayoutBatch(
  database: PayoutDatabase,
  actor: PayoutActor | null | undefined,
  rawInput: CreatePayoutBatchInput,
): Promise<FinancePayoutBatchView> {
  requireFinance(actor, "finance.generate_payout");
  const input = createPayoutBatchInputSchema.parse(rawInput);
  assertMonthlyPeriod(input.periodStart, input.periodEnd);

  return database.transaction(async (transaction) => {
    if (await transaction.findBatchForPeriod(input.periodStart, input.periodEnd)) {
      throw new PayoutError(
        "DUPLICATE_BATCH",
        "A payout batch already exists for this month.",
        409,
      );
    }
    const entries = await transaction.listEligibleEarningEntries(
      input.periodStart,
      input.periodEnd,
    );
    if (entries.length === 0) {
      throw new PayoutError("EMPTY_BATCH", "There are no approved earnings for this month.", 409);
    }

    const converted = entries.map((entry) => ({
      entry,
      amountMinor: convertToAmdLuma(entry.amountMinor, entry.currency, input.fx),
    }));
    const totalAmountMinor = converted.reduce((total, item) => safeAdd(total, item.amountMinor), 0);
    const batch = await transaction.createPayoutBatch({
      id: ulid(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: "AMD",
      totalAmountMinor,
      status: "draft",
      createdByUserId: actor.userId,
      fx: input.fx,
    });
    const items = await transaction.createPayoutItems(
      converted.map(({ entry, amountMinor }) => ({
        id: ulid(),
        payoutBatchId: batch.id,
        tutorProfileId: entry.tutorProfileId,
        tutorEarningEntryId: entry.id,
        amountMinor,
        currency: "AMD",
        status: "pending",
      })),
    );
    const reconciliation = reconcilePayoutBatch(batch, items);
    if (!reconciliation.reconciled) {
      throw new PayoutError(
        "RECONCILIATION_FAILED",
        "Payout items do not reconcile to the batch total.",
        500,
      );
    }
    return { ...batch, items, reconciliation };
  });
}

export async function markExternalPayoutComplete(
  database: PayoutDatabase,
  actor: PayoutActor | null | undefined,
  batchId: string,
  rawInput: CompletePayoutBatchInput,
): Promise<FinancePayoutBatchView> {
  requireFinance(actor, "finance.generate_payout");
  const input = completePayoutBatchInputSchema.parse(rawInput);
  return database.transaction(async (transaction) => {
    const existing = await transaction.findPayoutBatch(batchId);
    if (!existing) throw new PayoutError("BATCH_NOT_FOUND", "Payout batch was not found.", 404);
    if (existing.status === "completed") {
      throw new PayoutError(
        "BATCH_ALREADY_COMPLETED",
        "This payout batch is already complete.",
        409,
      );
    }
    if (input.evidenceRef.trim().length === 0) {
      throw new PayoutError(
        "EVIDENCE_REQUIRED",
        "An evidence attachment reference is required.",
        400,
      );
    }

    const batch = await transaction.completePayoutBatch(
      batchId,
      input.evidenceRef,
      input.paidAt,
      actor.userId,
    );
    const items = await transaction.listPayoutItems(batchId);
    const reconciliation = reconcilePayoutBatch(batch, items);
    if (!reconciliation.reconciled) {
      throw new PayoutError(
        "RECONCILIATION_FAILED",
        "Completed payout items do not reconcile to the batch total.",
        500,
      );
    }
    return { ...batch, items, reconciliation };
  });
}

export async function getTutorEarningsSummary(
  database: PayoutDatabase,
  actor: PayoutActor | null | undefined,
  rawFilter: { periodStart: string; periodEnd: string },
): Promise<TutorEarningsSummary> {
  requireActor(actor);
  if (!actor.roles.includes("tutor")) {
    throw new PayoutError("FORBIDDEN", "Tutor access is required.", 403);
  }
  const filter = lessonEarningSourceFilterSchema.parse(rawFilter);
  const tutorProfileId = await database.findTutorProfileIdByUserId(actor.userId);
  if (!tutorProfileId) {
    throw new PayoutError(
      "TUTOR_PROFILE_REQUIRED",
      "A tutor profile is required to view earnings.",
      409,
    );
  }
  const entries = await database.listEarningsForTutor(
    tutorProfileId,
    filter.periodStart,
    filter.periodEnd,
  );
  const totals = new Map<"USD" | "AMD", number>();
  for (const entry of entries) {
    if (entry.status === "voided") continue;
    totals.set(entry.currency, safeAdd(totals.get(entry.currency) ?? 0, entry.amountMinor));
  }

  return {
    periodStart: filter.periodStart,
    periodEnd: filter.periodEnd,
    completedLessonCount: entries.filter(
      (entry) => entry.status !== "voided" && entry.reason === "completed",
    ).length,
    chargeableLessonCount: entries.filter(
      (entry) => entry.status !== "voided" && entry.reason === "chargeable",
    ).length,
    expectedTotals: [...totals.entries()].map(([currency, amountMinor]) => ({
      currency,
      amountMinor,
    })),
    entries: entries.map((entry) => ({
      id: entry.id,
      lessonId: entry.lessonId,
      amountMinor: entry.amountMinor,
      currency: entry.currency,
      status: entry.status,
      reason: entry.reason,
      earnedAt: entry.earnedAt,
    })),
  };
}

export async function getFinanceEarningLedger(
  database: PayoutDatabase,
  actor: PayoutActor | null | undefined,
  rawFilter: { periodStart: string; periodEnd: string },
): Promise<FinanceEarningLedgerRow[]> {
  requireFinance(actor, "finance.view_transactions");
  const filter = lessonEarningSourceFilterSchema.parse(rawFilter);
  return database.listFinanceEarningLedger(filter.periodStart, filter.periodEnd);
}

async function batchView(
  database: PayoutDatabase,
  batch: PayoutBatchRecord,
): Promise<FinancePayoutBatchView> {
  const items = await database.listPayoutItems(batch.id);
  return { ...batch, items, reconciliation: reconcilePayoutBatch(batch, items) };
}

export async function listFinancePayoutBatches(
  database: PayoutDatabase,
  actor: PayoutActor | null | undefined,
): Promise<FinancePayoutBatchView[]> {
  requireFinance(actor, "finance.view_transactions");
  const batches = await database.listPayoutBatches();
  return Promise.all(batches.map((batch) => batchView(database, batch)));
}

export function currentUtcMonth(now = new Date()): { periodStart: string; periodEnd: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export async function getPayoutDashboard(
  database: PayoutDatabase,
  actor: PayoutActor | null | undefined,
  filter = currentUtcMonth(),
): Promise<PayoutDashboard> {
  requireActor(actor);
  const financeViewer = actor.roles.some((role) =>
    ["finance", "administrator", "super_administrator"].includes(role),
  );
  if (financeViewer) {
    const [ledger, batches] = await Promise.all([
      getFinanceEarningLedger(database, actor, filter),
      listFinancePayoutBatches(database, actor),
    ]);
    return {
      kind: "finance",
      periodStart: filter.periodStart,
      periodEnd: filter.periodEnd,
      ledger,
      batches,
    };
  }
  return {
    kind: "tutor",
    summary: await getTutorEarningsSummary(database, actor, filter),
  };
}

function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportPayoutBatchCsv(
  database: PayoutDatabase,
  actor: PayoutActor | null | undefined,
  batchId: string,
): Promise<{ filename: string; csv: string }> {
  requireFinance(actor, "finance.view_transactions");
  const batch = await database.findPayoutBatch(batchId);
  if (!batch) throw new PayoutError("BATCH_NOT_FOUND", "Payout batch was not found.", 404);
  const items = await database.listPayoutItems(batchId);
  const reconciliation = reconcilePayoutBatch(batch, items);
  if (!reconciliation.reconciled) {
    throw new PayoutError(
      "RECONCILIATION_FAILED",
      "The payout batch cannot be exported until it reconciles.",
      409,
    );
  }

  const header = [
    "batch_id",
    "period_start",
    "period_end",
    "tutor_profile_id",
    "tutor_name",
    "lesson_id",
    "earning_entry_id",
    "source_amount_minor",
    "source_currency",
    "fx_rate",
    "fx_source",
    "fx_conversion_date",
    "payout_amount_luma",
    "status",
    "evidence_ref",
    "paid_at",
  ];
  const rows = items.map((item) => [
    batch.id,
    batch.periodStart,
    batch.periodEnd,
    item.tutorProfileId,
    item.tutorDisplayName,
    item.lessonId,
    item.tutorEarningEntryId,
    item.sourceAmountMinor,
    item.sourceCurrency,
    batch.fx?.rate ?? "",
    batch.fx?.source ?? "",
    batch.fx?.conversionDate ?? "",
    item.amountMinor,
    item.status,
    item.evidenceRef,
    item.paidAt?.toISOString() ?? "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return {
    filename: `payouts-${batch.periodStart.slice(0, 7)}-${batch.id}.csv`,
    csv: `\uFEFF${csv}\r\n`,
  };
}
