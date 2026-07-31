import Stripe from "stripe";

import { PaymentError } from "./errors";
import type { PaymentGateway, StripePaymentWebhookEvent } from "./models";

export function createStripePaymentGateway(secretKey: string): PaymentGateway {
  const stripe = new Stripe(secretKey);
  return {
    async createCustomer(input) {
      const customer = await stripe.customers.create(
        { metadata: { app_parent_profile_id: input.parentProfileId } },
        { idempotencyKey: input.idempotencyKey },
      );
      return { id: customer.id };
    },

    async createPaymentIntent(input) {
      const intent = await stripe.paymentIntents.create(
        {
          amount: input.amountMinor,
          currency: input.currency.toLowerCase(),
          customer: input.stripeCustomerId,
          capture_method: input.captureMethod,
          automatic_payment_methods: { enabled: true },
          metadata: {
            app_invoice_id: input.invoiceId,
            app_transaction_id: input.transactionId,
          },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (!intent.client_secret) {
        throw new PaymentError("PAYMENT_NOT_READY", "Stripe did not return a client secret.", 502);
      }
      return { id: intent.id, clientSecret: intent.client_secret, status: intent.status };
    },

    async capturePaymentIntent(stripePaymentIntentId, idempotencyKey) {
      const intent = await stripe.paymentIntents.capture(
        stripePaymentIntentId,
        {},
        { idempotencyKey },
      );
      return { id: intent.id, status: intent.status };
    },

    async createRefund(input) {
      const refund = await stripe.refunds.create(
        {
          payment_intent: input.stripePaymentIntentId,
          amount: input.amountMinor,
          metadata: { app_refund_id: input.refundId },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { id: refund.id, status: refund.status ?? "pending" };
    },
  };
}

function normalizedRefundStatus(
  value: string | null,
): "pending" | "requires_action" | "succeeded" | "failed" | "canceled" | null {
  return value === "pending" ||
    value === "requires_action" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "canceled"
    ? value
    : null;
}

export function verifyAndParseStripeWebhook(
  rawBody: string | Buffer,
  signature: string | null,
  webhookSecret: string,
  stripeSecretKey: string,
): StripePaymentWebhookEvent {
  if (!signature) {
    throw new PaymentError(
      "STRIPE_SIGNATURE_INVALID",
      "The Stripe-Signature header is required.",
      400,
    );
  }
  const stripe = new Stripe(stripeSecretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new PaymentError(
      "STRIPE_SIGNATURE_INVALID",
      "The Stripe webhook signature is invalid.",
      400,
    );
  }

  const createdAt = new Date(event.created * 1_000);
  switch (event.type) {
    case "payment_intent.amount_capturable_updated":
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      return {
        id: event.id,
        type: event.type,
        createdAt,
        paymentIntentId: event.data.object.id,
      };
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const refund = event.data.object;
      return {
        id: event.id,
        type: event.type,
        createdAt,
        refundId: refund.id,
        appRefundId: refund.metadata?.app_refund_id ?? null,
        status: normalizedRefundStatus(refund.status),
      };
    }
    default:
      return { id: event.id, type: "ignored", createdAt, sourceType: event.type };
  }
}
