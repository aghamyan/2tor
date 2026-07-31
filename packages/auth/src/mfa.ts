import { createHmac, randomBytes } from "node:crypto";

import { constantTimeEqual, sha256Hex } from "./internal/crypto";
import { MFA_REQUIREMENT, type Role } from "./rbac";

/**
 * TOTP (RFC 6238, built on HOTP/RFC 4226) implemented directly against Node's `crypto` module —
 * no otplib/speakeasy dependency, since strict pnpm workspace isolation means this package can
 * only resolve `argon2`/`ulid`/`zod` plus Node builtins (see README). Correctness is pinned
 * against the published RFC 6238 Appendix B test vector in the test suite, not just a
 * generate→verify round trip, which could pass even if base32 decode or the HOTP byte layout
 * were both wrong in a self-consistent way.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET.charAt((value << (5 - bits)) & 31);
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** HOTP (RFC 4226): HMAC-SHA1 over an 8-byte big-endian counter, then dynamic truncation. */
function hotp(secret: Buffer, counter: number, digits: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = digest.readUInt8(digest.length - 1) & 0x0f;
  const binaryCode =
    ((digest.readUInt8(offset) & 0x7f) << 24) |
    ((digest.readUInt8(offset + 1) & 0xff) << 16) |
    ((digest.readUInt8(offset + 2) & 0xff) << 8) |
    (digest.readUInt8(offset + 3) & 0xff);

  return (binaryCode % 10 ** digits).toString().padStart(digits, "0");
}

export const TOTP_DEFAULT_DIGITS = 6;
export const TOTP_DEFAULT_PERIOD_SECONDS = 30;
export const TOTP_DEFAULT_WINDOW = 1;

/** Generates a new random TOTP secret, base32-encoded for storage/display. */
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

/** Builds an `otpauth://` provisioning URI for authenticator-app QR codes. */
export function getTotpProvisioningUri(params: {
  secretBase32: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const query = new URLSearchParams({
    secret: params.secretBase32,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DEFAULT_DIGITS),
    period: String(TOTP_DEFAULT_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

export interface TotpCodeOptions {
  digits?: number;
  periodSeconds?: number;
}

export function generateTotpCode(
  secretBase32: string,
  time: Date = new Date(),
  options: TotpCodeOptions = {},
): string {
  const digits = options.digits ?? TOTP_DEFAULT_DIGITS;
  const periodSeconds = options.periodSeconds ?? TOTP_DEFAULT_PERIOD_SECONDS;
  const counter = Math.floor(time.getTime() / 1000 / periodSeconds);
  return hotp(base32Decode(secretBase32), counter, digits);
}

export interface VerifyTotpOptions extends TotpCodeOptions {
  time?: Date;
  /** Number of periods before/after the current one to also accept, for clock drift. */
  window?: number;
}

/** Verifies a submitted TOTP code, tolerating clock drift within `window` periods either side. */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  options: VerifyTotpOptions = {},
): boolean {
  const digits = options.digits ?? TOTP_DEFAULT_DIGITS;
  const periodSeconds = options.periodSeconds ?? TOTP_DEFAULT_PERIOD_SECONDS;
  const window = options.window ?? TOTP_DEFAULT_WINDOW;
  const time = options.time ?? new Date();

  if (!/^\d+$/.test(code) || code.length !== digits) {
    return false;
  }

  const counter = Math.floor(time.getTime() / 1000 / periodSeconds);
  const secret = base32Decode(secretBase32);

  for (let drift = -window; drift <= window; drift++) {
    const candidate = hotp(secret, counter + drift, digits);
    if (constantTimeEqual(candidate, code)) {
      return true;
    }
  }
  return false;
}

const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O, 1/I

function randomRecoveryCodeRaw(length = 10): string {
  let code = "";
  for (const byte of randomBytes(length)) {
    code += RECOVERY_CODE_ALPHABET.charAt(byte % RECOVERY_CODE_ALPHABET.length);
  }
  return code;
}

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Generates single-use MFA recovery codes, formatted `XXXXX-XXXXX` for readability. */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomRecoveryCodeRaw();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** SHA-256 hex digest of a normalized recovery code — store this, never the plaintext code. */
export function hashRecoveryCode(code: string): string {
  return sha256Hex(normalizeRecoveryCode(code));
}

export function verifyRecoveryCode(code: string, storedHash: string): boolean {
  return constantTimeEqual(hashRecoveryCode(code), storedHash);
}

export type MfaGateResult =
  | { satisfied: true }
  | { satisfied: false; reason: "mfa_setup_required" | "mfa_verification_required" };

/**
 * Enforces spec §12.1's MFA requirement at login (and reusable at step-up): required for
 * finance/administrator/super-administrator, otherwise a no-op regardless of `mfaEnabled`.
 */
export function assertMfaSatisfied(params: {
  roles: readonly Role[];
  mfaEnabled: boolean;
  mfaVerified: boolean;
}): MfaGateResult {
  const required = params.roles.some((role) => MFA_REQUIREMENT[role] === "required");
  if (!required) {
    return { satisfied: true };
  }
  if (!params.mfaEnabled) {
    return { satisfied: false, reason: "mfa_setup_required" };
  }
  if (!params.mfaVerified) {
    return { satisfied: false, reason: "mfa_verification_required" };
  }
  return { satisfied: true };
}
