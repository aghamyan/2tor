import { createDb } from "@app/db";

import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";
import { createDrizzlePaymentDatabase } from "../../../../../packages/domain/payments/drizzle-database";
import { reconcileAuthorizedPayments } from "../../../../../packages/domain/payments/services";
import { createStripePaymentGateway } from "../../../../../packages/domain/payments/stripe";

type Payload = { limit?: number };

const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    (value.limit === undefined ||
      (typeof value.limit === "number" &&
        Number.isInteger(value.limit) &&
        value.limit >= 1 &&
        value.limit <= 500)),
);

export default defineJob({
  name: "payments.capture-authorizations",
  queue: "payments",
  schema,
  async handler(data, context) {
    const databaseUrl = process.env.DATABASE_URL;
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for payment reconciliation.");
    if (!stripeSecretKey) {
      if (process.env.NODE_ENV !== "production") {
        context.log.warn(
          { environment: process.env.NODE_ENV ?? "development" },
          "payment capture skipped because STRIPE_SECRET_KEY is not configured",
        );
        return;
      }

      throw new Error("STRIPE_SECRET_KEY is required for payment capture.");
    }
    const result = await reconcileAuthorizedPayments(
      createDrizzlePaymentDatabase(createDb(databaseUrl)),
      createStripePaymentGateway(stripeSecretKey),
      data.limit ?? 100,
    );
    context.log.info(result, "captured eligible Stripe authorizations");
  },
  options: {
    repeat: { pattern: "*/2 * * * *" },
    repeatPayload: {},
  },
});
