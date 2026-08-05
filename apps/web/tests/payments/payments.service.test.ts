import { describe, expect, it } from "vitest";

import { invoiceChargeableEvent } from "../../../../packages/domain/payments/services";
import type { ChargeableLessonEvent } from "../../../../packages/domain/scheduling/chargeable-events";
import { InMemoryPaymentDatabase } from "./support/in-memory-payment-database";

const event: ChargeableLessonEvent = {
  lessonId: "lesson-1",
  cancellationId: "cancel-1",
  tutorStudentAssignmentId: "assignment-1",
  lessonKind: "individual",
  category: "parent_request",
  chargePercentage: 50,
  reasonCode: "late_cancellation_under_8h",
  scheduledStartAt: new Date("2026-07-20T12:00:00.000Z"),
  canceledAt: new Date("2026-07-20T08:00:00.000Z"),
  canceledByUserId: "parent-user",
};

function setup() {
  const database = new InMemoryPaymentDatabase();
  database.parentProfilesByUser.set("parent-user", "parent-1");
  database.parentUsersByProfile.set("parent-1", "parent-user");
  database.billingFacts.set("assignment-1:lesson-1", {
    parentProfileId: "parent-1",
    parentUserId: "parent-user",
    subjectId: "subject-1",
  });
  database.prices.set("price-1", {
    id: "price-1",
    subjectId: "subject-1",
    lessonType: "standard",
    amountMinor: 1_801,
    currency: "USD",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
  });
  return database;
}

describe("payments", () => {
  it("copies the historical lesson price and applies D5's cancellation percentage with integer rounding", async () => {
    const database = setup();
    const invoice = await invoiceChargeableEvent(database, event, {
      idempotencyKey: "d5-cancel-1",
      now: new Date("2026-07-20T08:01:00.000Z"),
    });
    const charge = [...database.charges.values()][0];
    expect(charge).toMatchObject({
      priceId: "price-1",
      amountMinor: 901,
      currency: "USD",
    });
    expect(invoice).toMatchObject({ subtotalMinor: 901, totalMinor: 901 });
    expect(invoice.items[0]).toMatchObject({ unitAmountMinor: 1_801, amountMinor: 901 });

    const originalPrice = database.prices.get("price-1");
    if (!originalPrice) throw new Error("Expected test price.");
    database.prices.set("price-1", {
      ...originalPrice,
      amountMinor: 9_999,
    });
    const replay = await invoiceChargeableEvent(database, event, {
      idempotencyKey: "d5-cancel-1",
    });
    expect(replay.totalMinor).toBe(901);
    expect(database.charges.size).toBe(1);
  });
});
