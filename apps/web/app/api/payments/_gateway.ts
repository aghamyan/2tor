import { PaymentError } from "../../../../../packages/domain/payments/errors";
import { createStripePaymentGateway } from "../../../../../packages/domain/payments/stripe";

let gatewaySingleton: ReturnType<typeof createStripePaymentGateway> | undefined;

export function paymentGateway() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new PaymentError("PAYMENT_NOT_READY", "Stripe is not configured.", 503);
  }
  gatewaySingleton ??= createStripePaymentGateway(secretKey);
  return gatewaySingleton;
}
