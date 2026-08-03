import { createSession, getSession, listSessionsForUser } from "@app/auth";
import { describe, expect, it } from "vitest";

import {
  performRevokeAllDevices,
  performRevokeSession,
  type RevokeAllDevicesAuditPort,
} from "../../../app/(app)/settings/sessions/logic";
import { FakeRedis } from "../../auth/support/fakeRedis";

function fakeAudit() {
  const calls: Array<{ userId: string; ipAddress: string | null }> = [];
  const audit: RevokeAllDevicesAuditPort = {
    async recordLogoutAllDevices(input) {
      calls.push(input);
    },
  };
  return { audit, calls };
}

describe("performRevokeSession", () => {
  it("revokes a session owned by the requesting actor", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, { userId: "user_1", roles: ["parent"] });

    const outcome = await performRevokeSession(redis, {
      targetSessionId: session.id,
      actorUserId: "user_1",
    });

    expect(outcome).toBe("revoked");
    expect(await getSession(redis, session.id)).toBeNull();
  });

  it("refuses to revoke a session owned by a different user (authorization check)", async () => {
    const redis = new FakeRedis();
    const { session } = await createSession(redis, { userId: "victim", roles: ["parent"] });

    const outcome = await performRevokeSession(redis, {
      targetSessionId: session.id,
      actorUserId: "attacker",
    });

    expect(outcome).toBe("not_found_or_forbidden");
    // The victim's session must still be alive — the wrong-owner request must not touch it.
    expect(await getSession(redis, session.id)).not.toBeNull();
  });

  it("reports the same outcome for a nonexistent session as for one owned by someone else", async () => {
    const redis = new FakeRedis();
    const outcome = await performRevokeSession(redis, {
      targetSessionId: "does_not_exist",
      actorUserId: "user_1",
    });
    expect(outcome).toBe("not_found_or_forbidden");
  });
});

describe("performRevokeAllDevices", () => {
  it("invalidates every session for the user and writes exactly one audit row", async () => {
    const redis = new FakeRedis();
    const first = await createSession(redis, { userId: "user_1", roles: ["parent"] });
    const second = await createSession(redis, { userId: "user_1", roles: ["parent"] });
    const other = await createSession(redis, { userId: "user_2", roles: ["parent"] });
    const { audit, calls } = fakeAudit();

    await performRevokeAllDevices(
      { redis, audit },
      { userId: "user_1", ipAddress: "203.0.113.9" },
    );

    expect(await getSession(redis, first.session.id)).toBeNull();
    expect(await getSession(redis, second.session.id)).toBeNull();
    expect(await listSessionsForUser(redis, "user_1")).toEqual([]);
    // A different user's session is untouched.
    expect(await getSession(redis, other.session.id)).not.toBeNull();

    expect(calls).toEqual([{ userId: "user_1", ipAddress: "203.0.113.9" }]);
  });
});
