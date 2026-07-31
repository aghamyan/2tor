import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

/** Creates an opaque correlation ID for one inbound request or background job. */
export function newRequestId(): string {
  return randomUUID();
}

/** Returns the ID for the active request, if the current code runs inside one. */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

/**
 * Runs work within a request context. Async work started by `operation` inherits
 * the same request ID, allowing log records and Sentry events to be correlated.
 */
export function withRequestContext<T>(requestId: string, operation: () => T): T {
  return requestContext.run({ requestId }, operation);
}
