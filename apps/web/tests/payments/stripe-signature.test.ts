import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { verifyAndParseStripeWebhook } from "../../../../packages/domain/payments/stripe";

const secret = "whsec_test_payments_signature";
const payload = JSON.stringify({
  id: "evt_signature_test_1",
  object: "event",
  api_version: "2025-02-24.acacia",
  created: 1_785_283_200,
  data: {
    object: {
      id: "pi_signature_test_1",
      object: "payment_intent",
    },
  },
  livemode: false,
  pending_webhooks: 1,
  request: null,
  type: "payment_intent.succeeded",
});

describe("Stripe webhook signature verification", () => {
  it("accepts the signed raw payload and rejects a modified signature", () => {
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(
      verifyAndParseStripeWebhook(payload, signature, secret, "sk_test_placeholder"),
    ).toMatchObject({
      id: "evt_signature_test_1",
      type: "payment_intent.succeeded",
      paymentIntentId: "pi_signature_test_1",
    });
    expect(() =>
      verifyAndParseStripeWebhook(payload, "t=1,v1=invalid", secret, "sk_test_placeholder"),
    ).toThrowError(/signature is invalid/i);
  });
});
