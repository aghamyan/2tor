import type {
  FinanceEarningLedgerRow,
  NewPayoutBatch,
  NewPayoutItem,
  NewTutorEarningEntry,
  PayoutBatchRecord,
  PayoutCurrency,
  PayoutDatabase,
  PayoutItemRecord,
  TutorEarningEntryRecord,
} from "../../../../../packages/domain/payouts/models";

function cloneEarning(entry: TutorEarningEntryRecord): TutorEarningEntryRecord {
  return { ...entry };
}

export class InMemoryPayoutDatabase implements PayoutDatabase {
  readonly earnings = new Map<string, TutorEarningEntryRecord>();
  readonly batches = new Map<string, PayoutBatchRecord>();
  readonly items = new Map<string, PayoutItemRecord>();
  readonly tutorProfileByUserId = new Map<string, string>();
  readonly tutorDisplayName = new Map<string, string>();
  readonly companyPriceByLessonId = new Map<
    string,
    { amountMinor: number; currency: PayoutCurrency }
  >();

  async transaction<T>(operation: (database: PayoutDatabase) => Promise<T>): Promise<T> {
    return operation(this);
  }

  registerTutor(userId: string, tutorProfileId: string, displayName = tutorProfileId): void {
    this.tutorProfileByUserId.set(userId, tutorProfileId);
    this.tutorDisplayName.set(tutorProfileId, displayName);
  }

  setCompanyPrice(lessonId: string, amountMinor: number, currency: PayoutCurrency): void {
    this.companyPriceByLessonId.set(lessonId, { amountMinor, currency });
  }

  async findTutorProfileIdByUserId(userId: string): Promise<string | null> {
    return this.tutorProfileByUserId.get(userId) ?? null;
  }

  async findEarningByLessonId(lessonId: string): Promise<TutorEarningEntryRecord | null> {
    const entry = [...this.earnings.values()].find((value) => value.lessonId === lessonId);
    return entry ? cloneEarning(entry) : null;
  }

  async createEarningEntry(values: NewTutorEarningEntry): Promise<TutorEarningEntryRecord> {
    const now = new Date("2026-08-01T00:00:00.000Z");
    const entry: TutorEarningEntryRecord = {
      id: values.id,
      tutorProfileId: values.tutorProfileId,
      lessonId: values.lessonId,
      amountMinor: values.amountMinor,
      currency: values.currency,
      status: "pending",
      reason: values.reason,
      earnedAt: values.earnedAt,
      approvedByUserId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.earnings.set(entry.id, entry);
    return cloneEarning(entry);
  }

  private earningsInPeriod(periodStart: string, periodEnd: string): TutorEarningEntryRecord[] {
    return [...this.earnings.values()]
      .filter((entry) => {
        const earnedOn = entry.earnedAt.toISOString().slice(0, 10);
        return earnedOn >= periodStart && earnedOn <= periodEnd;
      })
      .sort((left, right) => left.earnedAt.getTime() - right.earnedAt.getTime());
  }

  async listEarningsForTutor(
    tutorProfileId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<TutorEarningEntryRecord[]> {
    return this.earningsInPeriod(periodStart, periodEnd)
      .filter((entry) => entry.tutorProfileId === tutorProfileId)
      .map(cloneEarning);
  }

  async listFinanceEarningLedger(
    periodStart: string,
    periodEnd: string,
  ): Promise<FinanceEarningLedgerRow[]> {
    return this.earningsInPeriod(periodStart, periodEnd).map((entry) => {
      const price = entry.lessonId
        ? (this.companyPriceByLessonId.get(entry.lessonId) ?? null)
        : null;
      return {
        ...cloneEarning(entry),
        tutorDisplayName: this.tutorDisplayName.get(entry.tutorProfileId) ?? entry.tutorProfileId,
        companyPriceAmountMinor: price?.amountMinor ?? null,
        companyPriceCurrency: price?.currency ?? null,
        companyMarginAmountMinor:
          price && price.currency === entry.currency ? price.amountMinor - entry.amountMinor : null,
      };
    });
  }

  async listEligibleEarningEntries(
    periodStart: string,
    periodEnd: string,
  ): Promise<TutorEarningEntryRecord[]> {
    const linked = new Set([...this.items.values()].map((item) => item.tutorEarningEntryId));
    return this.earningsInPeriod(periodStart, periodEnd)
      .filter((entry) => entry.status === "approved" && !linked.has(entry.id))
      .map(cloneEarning);
  }

  async approveEarningEntries(
    entryIds: readonly string[],
    approvedByUserId: string,
  ): Promise<TutorEarningEntryRecord[]> {
    const updated: TutorEarningEntryRecord[] = [];
    for (const id of entryIds) {
      const entry = this.earnings.get(id);
      if (!entry) continue;
      if (entry.status === "pending") {
        entry.status = "approved";
        entry.approvedByUserId = approvedByUserId;
        entry.updatedAt = new Date("2026-08-01T00:05:00.000Z");
      }
      updated.push(cloneEarning(entry));
    }
    return updated;
  }

  async findBatchForPeriod(
    periodStart: string,
    periodEnd: string,
  ): Promise<PayoutBatchRecord | null> {
    const batch = [...this.batches.values()].find(
      (value) => value.periodStart === periodStart && value.periodEnd === periodEnd,
    );
    return batch ? { ...batch, fx: batch.fx ? { ...batch.fx } : null } : null;
  }

  async createPayoutBatch(values: NewPayoutBatch): Promise<PayoutBatchRecord> {
    const now = new Date("2026-08-01T00:10:00.000Z");
    const batch: PayoutBatchRecord = {
      ...values,
      processedAt: null,
      fx: { ...values.fx },
      createdAt: now,
      updatedAt: now,
    };
    this.batches.set(batch.id, batch);
    return { ...batch, fx: { ...values.fx } };
  }

  async listPayoutBatches(): Promise<PayoutBatchRecord[]> {
    return [...this.batches.values()].map((batch) => ({
      ...batch,
      fx: batch.fx ? { ...batch.fx } : null,
    }));
  }

  async findPayoutBatch(batchId: string): Promise<PayoutBatchRecord | null> {
    const batch = this.batches.get(batchId);
    return batch ? { ...batch, fx: batch.fx ? { ...batch.fx } : null } : null;
  }

  async createPayoutItems(values: readonly NewPayoutItem[]): Promise<PayoutItemRecord[]> {
    const now = new Date("2026-08-01T00:10:00.000Z");
    const created = values.map((value): PayoutItemRecord => {
      const earning = this.earnings.get(value.tutorEarningEntryId);
      if (!earning) throw new Error("Fixture earning does not exist.");
      const item: PayoutItemRecord = {
        ...value,
        tutorDisplayName: this.tutorDisplayName.get(value.tutorProfileId) ?? value.tutorProfileId,
        lessonId: earning.lessonId,
        sourceAmountMinor: earning.amountMinor,
        sourceCurrency: earning.currency,
        evidenceRef: null,
        paidAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.items.set(item.id, item);
      return { ...item };
    });
    return created;
  }

  async listPayoutItems(batchId: string): Promise<PayoutItemRecord[]> {
    return [...this.items.values()]
      .filter((item) => item.payoutBatchId === batchId)
      .map((item) => ({ ...item }));
  }

  async completePayoutBatch(
    batchId: string,
    evidenceRef: string,
    paidAt: Date,
    _actorUserId: string,
  ): Promise<PayoutBatchRecord> {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error("Fixture batch does not exist.");
    for (const item of this.items.values()) {
      if (item.payoutBatchId !== batchId) continue;
      item.status = "paid";
      item.evidenceRef = evidenceRef;
      item.paidAt = paidAt;
      const earning = this.earnings.get(item.tutorEarningEntryId);
      if (earning) earning.status = "paid";
    }
    batch.status = "completed";
    batch.processedAt = paidAt;
    batch.updatedAt = paidAt;
    return { ...batch, fx: batch.fx ? { ...batch.fx } : null };
  }
}
