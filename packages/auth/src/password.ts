import argon2 from "argon2";
import { z } from "zod";

import { constantTimeEqual, randomToken, sha256Hex } from "./internal/crypto";

/** OWASP-recommended argon2id baseline (19 MiB memory, 2 iterations, 1 degree of parallelism). */
const ARGON2ID_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hashes a plaintext password with argon2id. Never store or log the plaintext. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2ID_HASH_OPTIONS);
}

/**
 * Verifies a plaintext password against a stored argon2 hash. Params (type/cost) are read back
 * from the hash string itself, so this also verifies hashes produced with prior cost settings.
 * Never throws — a malformed hash or a wrong password both resolve to `false`.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

const MIN_PASSWORD_LENGTH = 12;

/**
 * Small denylist of common/breached-looking passwords that otherwise pass the length + character
 * class checks below. Not a substitute for a full breached-password API — a reasonable MVP floor.
 */
const COMMON_PASSWORDS = new Set([
  "password1234",
  "password123!",
  "qwertyuiop12",
  "12345678901234",
  "letmein123456",
  "welcome123456",
  "iloveyou12345",
  "administrator",
  "changeme12345",
]);

const passwordLengthSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

/**
 * Strong password policy (spec §12.1): minimum length, character-class diversity, and a common-
 * password denylist. Pure/synchronous so it can gate a signup form before any hashing happens.
 */
export function validatePasswordStrength(password: string): PasswordPolicyResult {
  const errors: string[] = [];

  const lengthResult = passwordLengthSchema.safeParse(password);
  if (!lengthResult.success) {
    errors.push(...lengthResult.error.issues.map((issue) => issue.message));
  }

  const classPatterns = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];
  const classesPresent = classPatterns.filter((pattern) => pattern.test(password)).length;
  if (classesPresent < 3) {
    errors.push("Password must include at least 3 of: lowercase, uppercase, digit, symbol");
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("Password is too common");
  }

  return { valid: errors.length === 0, errors };
}

/** Default password reset token lifetime. Single-use is enforced via `usedAt` in the caller's store. */
export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

export interface IssuedPasswordResetToken {
  /** Raw token — send to the user (e.g. in an email link). Never store this value. */
  token: string;
  /** SHA-256 hex digest — store this in `password_reset_tokens.token_hash`. */
  tokenHash: string;
  expiresAt: Date;
}

/** Issues a new single-use password reset token. The caller persists `tokenHash`/`expiresAt`, never `token`. */
export function issuePasswordResetToken(
  now: Date = new Date(),
  ttlMinutes: number = PASSWORD_RESET_TOKEN_TTL_MINUTES,
): IssuedPasswordResetToken {
  const token = randomToken(32);
  return {
    token,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
  };
}

export interface StoredPasswordResetToken {
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export type PasswordResetTokenCheck =
  { valid: true } | { valid: false; reason: "invalid" | "expired" | "used" };

/**
 * Validates a presented reset token against the stored row. Order matters: an invalid token must
 * not leak whether a matching-but-expired/used row exists, so the hash comparison runs first.
 */
export function checkPasswordResetToken(
  token: string,
  stored: StoredPasswordResetToken,
  now: Date = new Date(),
): PasswordResetTokenCheck {
  if (!constantTimeEqual(sha256Hex(token), stored.tokenHash)) {
    return { valid: false, reason: "invalid" };
  }
  if (stored.usedAt !== null) {
    return { valid: false, reason: "used" };
  }
  if (stored.expiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true };
}
