export const GAMIFICATION_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "STUDENT_NOT_FOUND",
  "CHALLENGE_NOT_FOUND",
  "CHALLENGE_NOT_ACTIVE",
  "COMPETITION_DISABLED",
  "INVALID_INPUT",
] as const;

export type GamificationErrorCode = (typeof GAMIFICATION_ERROR_CODES)[number];

export class GamificationError extends Error {
  constructor(
    readonly code: GamificationErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "GamificationError";
  }
}

export function isGamificationError(error: unknown): error is GamificationError {
  return error instanceof GamificationError;
}
