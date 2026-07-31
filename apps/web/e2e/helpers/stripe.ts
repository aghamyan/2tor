import { createHmac } from "node:crypto";

export function signedStripeEvent(
  event: Record<string, unknown>,
  secret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_e2e_only",
): { payload: string; signature: string } {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1_000);
  const digest = createHmac("sha256", secret)
    .update(`${String(timestamp)}.${payload}`)
    .digest("hex");
  return { payload, signature: `t=${String(timestamp)},v1=${digest}` };
}
