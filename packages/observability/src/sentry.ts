import * as Sentry from "@sentry/nextjs";
import * as appConfig from "@app/config";

import { getRequestId } from "./requestId";

const REDACTED_VALUE = "[Redacted]";
const PII_KEYS = new Set([
  "email",
  "phone",
  "name",
  "firstname",
  "lastname",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "authorization",
  "cookie",
  "set-cookie",
]);

type ConfigValue = Record<string, unknown>;

interface ConfigSentrySettings {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
}

/** Explicit values override settings exposed by @app/config. */
export interface SentryInitOptions extends ConfigSentrySettings {
  enabled?: boolean;
}

function asRecord(value: unknown): ConfigValue {
  return typeof value === "object" && value !== null ? (value as ConfigValue) : {};
}

function asRate(value: unknown): number | undefined {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Config remains deliberately tolerant while @app/config is being established.
 * It supports either `sentry.{...}` or `env.SENTRY_*` settings, without putting
 * environment parsing or secrets in this package.
 */
function sentrySettingsFromConfig(): ConfigSentrySettings {
  const config = appConfig as unknown as ConfigValue;
  const sentry = asRecord(config.sentry);
  const env = asRecord(config.env);

  return {
    dsn: asString(sentry.dsn) ?? asString(env.SENTRY_DSN),
    environment: asString(sentry.environment) ?? asString(env.SENTRY_ENVIRONMENT),
    release: asString(sentry.release) ?? asString(env.SENTRY_RELEASE),
    tracesSampleRate: asRate(sentry.tracesSampleRate) ?? asRate(env.SENTRY_TRACES_SAMPLE_RATE),
    profilesSampleRate:
      asRate(sentry.profilesSampleRate) ?? asRate(env.SENTRY_PROFILES_SAMPLE_RATE),
  };
}

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as ConfigValue).map(([key, child]) => [
      key,
      PII_KEYS.has(key.toLowerCase()) ? REDACTED_VALUE : scrubValue(child),
    ]),
  );
}

/** Removes PII from a Sentry event before it is sent outside this process. */
export function scrubSentryEvent<T>(event: T): T {
  const scrubbed = scrubValue(event) as T;
  const requestId = getRequestId();

  if (requestId !== undefined && typeof scrubbed === "object" && scrubbed !== null) {
    const sentryEvent = scrubbed as T & { tags?: Record<string, string> };
    sentryEvent.tags = { ...sentryEvent.tags, requestId };
  }

  return scrubbed;
}

function initSentry(options: SentryInitOptions = {}) {
  const config = sentrySettingsFromConfig();
  const settings = { ...config, ...options };

  return Sentry.init({
    dsn: settings.dsn,
    environment: settings.environment,
    release: settings.release,
    enabled: settings.enabled ?? settings.dsn !== undefined,
    tracesSampleRate: settings.tracesSampleRate ?? 0,
    profilesSampleRate: settings.profilesSampleRate ?? 0,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

/** Initializes Sentry for the Next.js web runtime. */
export function initWebSentry(options: SentryInitOptions = {}) {
  return initSentry(options);
}

/** Initializes Sentry for the Node-based background worker runtime. */
export function initWorkerSentry(options: SentryInitOptions = {}) {
  return initSentry(options);
}

export const initSentryForWeb = initWebSentry;
export const initSentryForWorker = initWorkerSentry;
