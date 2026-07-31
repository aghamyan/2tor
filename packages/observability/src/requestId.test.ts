import { describe, expect, it } from "vitest";

import { getRequestId, newRequestId, withRequestContext } from "./requestId";

describe("request context", () => {
  it("keeps a request ID through an async call chain", async () => {
    const requestId = newRequestId();

    const observedId = await withRequestContext(requestId, async () => {
      await Promise.resolve();
      return await nestedAsyncOperation();
    });

    expect(observedId).toBe(requestId);
    expect(getRequestId()).toBeUndefined();
  });
});

async function nestedAsyncOperation(): Promise<string | undefined> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return getRequestId();
}
