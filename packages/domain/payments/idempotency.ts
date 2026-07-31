import { createHash } from "node:crypto";

import { PaymentError } from "./errors";
import { idempotencyKeySchema } from "./schemas";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A deterministic, ULID-shaped primary key. The zero timestamp means the ID does not pretend to
 * encode creation time; the 80-bit hash tail is namespaced and stable across retries.
 */
export function paymentId(scope: string, idempotencyKey: string): string {
  const key = idempotencyKeySchema.parse(idempotencyKey);
  const digest = createHash("sha256").update(`${scope}\0${key}`).digest();
  let suffix = "";
  for (let index = 0; index < 16; index += 1) {
    suffix += CROCKFORD[(digest[index] ?? 0) & 31];
  }
  return `0000000000${suffix}`;
}

export function requireIdempotencyKey(value: string | null | undefined): string {
  const result = idempotencyKeySchema.safeParse(value);
  if (!result.success) {
    throw new PaymentError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid Idempotency-Key header is required for this payment write.",
      400,
    );
  }
  return result.data;
}
