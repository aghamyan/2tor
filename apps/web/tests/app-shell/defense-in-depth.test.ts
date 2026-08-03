import { describe, expect, it } from "vitest";

import { getPayoutDashboard, getTutorEarningsSummary } from "../../../../packages/domain/payouts/services";
import { isPayoutError } from "../../../../packages/domain/payouts/errors";
import { InMemoryPayoutDatabase } from "../payouts/support/in-memory-payout-database";

/**
 * Proves the acceptance criterion "directly visiting a hidden route still returns denied" against
 * a route that actually enforces it server-side — not just against the sidebar's own filtering
 * logic (that's `nav-grouping.test.ts`). Hiding the "Payouts" link from a student is not, by
 * itself, the security boundary; `getPayoutDashboard`/`getTutorEarningsSummary` re-checking the
 * actor's role independently of the nav is what actually stops a forced URL visit. This test
 * exercises the real domain service (`packages/domain/payouts/services.ts`) against an in-memory
 * database double already used by `tests/payouts/*` — no fixture invented here.
 */
describe("defense in depth: a hidden nav route still denies on direct access", () => {
  it("denies a student actor who calls the payouts dashboard read directly", async () => {
    const database = new InMemoryPayoutDatabase();
    await expect(
      getPayoutDashboard(database, { userId: "student-1", roles: ["student"] }),
    ).rejects.toSatisfy((error: unknown) => isPayoutError(error) && error.code === "FORBIDDEN");
  });

  it("denies a parent actor the same way", async () => {
    const database = new InMemoryPayoutDatabase();
    await expect(
      getPayoutDashboard(database, { userId: "parent-1", roles: ["parent"] }),
    ).rejects.toSatisfy((error: unknown) => isPayoutError(error) && error.code === "FORBIDDEN");
  });

  it("denies the underlying tutor-earnings read directly, independent of the dashboard composition", async () => {
    const database = new InMemoryPayoutDatabase();
    await expect(
      getTutorEarningsSummary(
        database,
        { userId: "student-1", roles: ["student"] },
        { periodStart: "2026-07-01", periodEnd: "2026-07-31" },
      ),
    ).rejects.toSatisfy((error: unknown) => isPayoutError(error) && error.code === "FORBIDDEN");
  });

  it("still allows the role the nav item is scoped to", async () => {
    const database = new InMemoryPayoutDatabase();
    database.registerTutor("tutor-1", "tutor-profile-1");
    await expect(
      getPayoutDashboard(database, { userId: "tutor-1", roles: ["tutor"] }),
    ).resolves.toMatchObject({ kind: "tutor" });
  });
});
