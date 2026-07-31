import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Hex-encoded SHA-256 digest. Used to store high-entropy random tokens (password reset tokens,
 * CSRF tokens, MFA recovery codes) at rest. These values are random, not user-chosen, so a fast
 * hash is correct here — argon2id (see `../password.ts`) is reserved for user-chosen passwords,
 * where a deliberately slow hash defends against offline guessing.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** HMAC-SHA256, hex-encoded. Used to derive CSRF tokens from a per-session secret. */
export function hmacSha256Hex(key: string, message: string): string {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

/** Cryptographically random, URL-safe token. */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/**
 * Constant-time string comparison that never throws on length mismatch (unlike raw
 * `crypto.timingSafeEqual`, which requires equal-length buffers). Prefer comparing fixed-length
 * hashes/digests over raw secrets so an attacker can't learn the expected length either.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    // Compare the buffer against itself so this branch takes roughly the same time as the
    // equal-length path below, instead of returning immediately on a length mismatch.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
