import { describe, expect, it } from "vitest";

import { broadcastLogout, onLogoutBroadcast } from "../../../components/auth/logout/broadcast";

function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("timed out waiting"));
      setTimeout(check, 5);
    };
    check();
  });
}

describe("logout broadcast", () => {
  it("notifies another subscriber (simulating another open tab) that the session ended", async () => {
    let received = false;
    const unsubscribe = onLogoutBroadcast(() => {
      received = true;
    });

    broadcastLogout();
    await waitFor(() => received);

    unsubscribe();
    expect(received).toBe(true);
  });

  it("stops notifying once unsubscribed", async () => {
    let calls = 0;
    const unsubscribe = onLogoutBroadcast(() => {
      calls += 1;
    });
    unsubscribe();

    broadcastLogout();
    // Give any (unwanted) delivery a chance to arrive before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(calls).toBe(0);
  });
});
