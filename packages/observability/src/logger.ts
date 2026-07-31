import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions as PinoLoggerOptions,
} from "pino";

import { getRequestId } from "./requestId";

const REDACTED_VALUE = "[Redacted]";

/**
 * Pino paths redacted before a record is written. Keep this list in sync with
 * the README, and add an explicit path when introducing a new PII container.
 */
export const PII_REDACTION_PATHS = [
  "email",
  "phone",
  "name",
  "firstName",
  "lastName",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "authorization",
  "headers.authorization",
  "headers.cookie",
  "auth.authorization",
  "auth.token",
  "auth.accessToken",
  "auth.refreshToken",
  "user.email",
  "user.phone",
  "user.name",
  "child.name",
  "*.email",
  "*.phone",
  "*.name",
  "*.firstName",
  "*.lastName",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.idToken",
  "*.authorization",
] as const;

export interface LoggerOptions extends PinoLoggerOptions {
  /** Defaults to LOG_LEVEL, or `info` when it is not set. */
  level?: PinoLoggerOptions["level"];
}

/**
 * Creates a structured Pino logger. A requestId is added to every log record
 * emitted inside `withRequestContext`.
 */
export function createLogger(options: LoggerOptions = {}, destination?: DestinationStream): Logger {
  const { level = process.env.LOG_LEVEL ?? "info", ...pinoOptions } = options;

  return pino(
    {
      ...pinoOptions,
      level,
      redact: {
        paths: [...PII_REDACTION_PATHS],
        censor: REDACTED_VALUE,
      },
      mixin() {
        const requestId = getRequestId();
        return requestId === undefined ? {} : { requestId };
      },
    },
    destination,
  );
}

/** Shared application logger for normal application use. */
export const logger = createLogger();
