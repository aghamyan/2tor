import { NextResponse, type NextRequest } from "next/server";

import { PaymentError } from "../../../../../../../packages/domain/payments/errors";
import { paymentDatabase } from "../../../../../../../packages/domain/payments/runtime";
import { handleStripeWebhook } from "../../../../../../../packages/domain/payments/services";
import { verifyAndParseStripeWebhook } from "../../../../../../../packages/domain/payments/stripe";
import { paymentNotifier } from "../../_notifier";
import { paymentApiError, paymentRequestId } from "../../_response";

export async function POST(request: NextRequest) {
  const requestId = paymentRequestId(request);
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeSecretKey || !webhookSecret) {
      throw new PaymentError("PAYMENT_NOT_READY", "Stripe webhooks are not configured.", 503);
    }
    // `text()` is intentional: parsing JSON first would alter the bytes Stripe signed.
    const rawBody = await request.text();
    const event = verifyAndParseStripeWebhook(
      rawBody,
      request.headers.get("stripe-signature"),
      webhookSecret,
      stripeSecretKey,
    );
    const result = await handleStripeWebhook(paymentDatabase(), paymentNotifier, event);
    return NextResponse.json({ data: result, requestId });
  } catch (error: unknown) {
    return paymentApiError(error, requestId);
  }
}
