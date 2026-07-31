// Import the dispatch entry point directly. The package barrel also exports Web Push, whose
// Buffer/fetch body types are not browser-lib compatible in the web TypeScript program.
import { notify } from "@app/notifications/dispatch";
import { renderNotificationTemplate } from "@app/notifications/templates";
import { createDb, notifications } from "@app/db";

import type { PaymentNotifier } from "../../../../../packages/domain/payments/models";
import { paymentId } from "../../../../../packages/domain/payments/idempotency";

function displayAmount(amountMinor: number): string {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

let notificationDatabase: ReturnType<typeof createDb> | undefined;

function database() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for payment notifications.");
  notificationDatabase ??= createDb(databaseUrl);
  return notificationDatabase;
}

async function saveInAppFallback(input: Parameters<PaymentNotifier["notify"]>[0]) {
  const db = database();
  const account = await db.query.users.findFirst({
    columns: { locale: true },
    where: (user, operators) => operators.eq(user.id, input.userId),
  });
  const rendered = renderNotificationTemplate(input.type, account?.locale ?? "en", {
    amount: displayAmount(input.amountMinor),
    currency: input.currency,
    actionUrl: "/payments",
  });
  await db
    .insert(notifications)
    .values({
      id: paymentId(
        "payment-notification",
        `${input.type}:${input.relatedEntity.type}:${input.relatedEntity.id}`,
      ),
      userId: input.userId,
      channel: "in_app",
      category: "payment",
      title: rendered.title,
      body: rendered.body,
      status: "sent",
      sentAt: new Date(),
      relatedEntityType: input.relatedEntity.type,
      relatedEntityId: input.relatedEntity.id,
    })
    .onConflictDoNothing();
}

export const paymentNotifier: PaymentNotifier = {
  async notify(input) {
    try {
      await notify({
        userId: input.userId,
        type: input.type,
        data: {
          amount: displayAmount(input.amountMinor),
          currency: input.currency,
          actionUrl: "/payments",
        },
        relatedEntity: {
          type: input.relatedEntity.type,
          id: input.relatedEntity.id,
          enduring: true,
        },
      });
    } catch (error: unknown) {
      if (
        !(error instanceof Error) ||
        !error.message.startsWith("Notifications are not configured.")
      ) {
        throw error;
      }
      // The shared dispatcher has no composition root in this repository yet. Preserve the
      // mandatory user-facing notice as an idempotent in-app record until one is configured.
      await saveInAppFallback(input);
    }
  },
};
