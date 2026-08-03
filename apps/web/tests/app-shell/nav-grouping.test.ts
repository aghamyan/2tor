import type { Role } from "@app/auth";
import { describe, expect, it } from "vitest";

import {
  discoverNavItems,
  groupNavItems,
  simplifyLearningNavForRole,
} from "../../lib/nav-registry";

/**
 * The known, bundled production module ids (mirrors `tests/dashboards/nav-registry.test.ts`).
 * `discoverNavItems()` globs the real filesystem in `NODE_ENV=test`, and
 * `tests/shell/nav-registry.test.ts` creates/removes `packages/domain/foo` and `.../bar` fixture
 * modules mid-run (one with `roles: []`, visible to every role) — Vitest runs test files in
 * parallel, so an un-whitelisted assertion here can intermittently see a stray fixture id. Filtering
 * to this known set before asserting removes that race instead of asserting on whatever the glob
 * happens to return.
 */
const PRODUCTION_MODULE_IDS = [
  "academics.overview",
  "administration.overview",
  "assessments.overview",
  "assignments.overview",
  "communication.inbox",
  "consent.overview",
  "content.overview",
  "discussions.overview",
  "families.overview",
  "gamification.overview",
  "matching.queue",
  "payments.overview",
  "payouts.overview",
  "projects.overview",
  "reporting.overview",
  "scheduling.overview",
  "support.queue",
  "tutors.profile",
  "tutors.students",
] as const;

async function groupedIdsFor(roles: readonly Role[]): Promise<string[]> {
  const items = await discoverNavItems();
  const groups = groupNavItems(items, roles);
  return groups
    .flatMap((group) => group.items)
    .map((item) => item.id)
    .filter((id) => (PRODUCTION_MODULE_IDS as readonly string[]).includes(id));
}

describe("groupNavItems", () => {
  it("reduces a student workspace to Classes and Homework", async () => {
    const items = await discoverNavItems();
    expect(simplifyLearningNavForRole(items, ["student"]).map((item) => item.id)).toEqual([
      "assignments.overview",
      "scheduling.overview",
    ]);
  });

  it("adds Students to the tutor's otherwise focused workspace", async () => {
    const items = await discoverNavItems();
    expect(simplifyLearningNavForRole(items, ["tutor"]).map((item) => item.id).sort()).toEqual([
      "assignments.overview",
      "scheduling.overview",
      "tutors.profile",
      "tutors.students",
    ]);
  });

  it("never includes Payouts or Tutor profile for a student session", async () => {
    const ids = await groupedIdsFor(["student"]);
    expect(ids).not.toContain("payouts.overview");
    expect(ids).not.toContain("tutors.profile");
    expect(ids).not.toContain("administration.overview");
    expect(ids).not.toContain("matching.queue");
    expect(ids).not.toContain("reporting.overview");
  });

  it("produces the exact grouped ordering for a student session", async () => {
    const ids = await groupedIdsFor(["student"]);
    expect(ids).toEqual([
      "academics.overview",
      "scheduling.overview",
      "assignments.overview",
      "assessments.overview",
      "projects.overview",
      "gamification.overview",
      "content.overview",
      "discussions.overview",
      "communication.inbox",
      "support.queue",
    ]);
  });

  it("never includes any admin link for a tutor session", async () => {
    const ids = await groupedIdsFor(["tutor"]);
    expect(ids).not.toContain("administration.overview");
    expect(ids).not.toContain("matching.queue");
    expect(ids).not.toContain("reporting.overview");
    // A tutor's own workspace items are still present.
    expect(ids).toContain("payouts.overview");
    expect(ids).toContain("tutors.profile");
    expect(ids).toContain("tutors.students");
  });

  it("never includes Payouts or a tutor/parent-only link for a finance-only session", async () => {
    const ids = await groupedIdsFor(["finance"]);
    expect(ids.sort()).toEqual(["payments.overview", "payouts.overview"]);
  });

  it("gives an administrator the admin group but not the parent/tutor-only links", async () => {
    const ids = await groupedIdsFor(["administrator"]);
    expect(ids).toContain("administration.overview");
    expect(ids).toContain("matching.queue");
    expect(ids).toContain("reporting.overview");
    expect(ids).not.toContain("tutors.profile");
    expect(ids).not.toContain("tutors.students");
    // See this suite's paired `families-consent-staff-gap.test.ts`: staff pass this module's own
    // page-level authorization but are excluded from these two nav items — documented, not fixed
    // here (`packages/domain/*/nav.ts` is outside this task's allowed edits).
    expect(ids).not.toContain("families.overview");
    expect(ids).not.toContain("consent.overview");
  });

  it("keeps coursework items in reading order regardless of discovery order", async () => {
    const items = await discoverNavItems();
    const groups = groupNavItems(items, ["parent"]);
    const coursework = groups.find((group) => group.id === "coursework");
    expect(coursework?.items.map((item) => item.id)).toEqual([
      "assignments.overview",
      "assessments.overview",
      "projects.overview",
    ]);
  });

  it("omits a section entirely when the actor can see nothing in it", async () => {
    const items = await discoverNavItems();
    const groups = groupNavItems(items, ["student"]);
    const groupIds = groups.map((group) => group.id);
    expect(groupIds).not.toContain("billing");
    expect(groupIds).not.toContain("admin");
    expect(groupIds).not.toContain("family");
    expect(groupIds).not.toContain("profile");
  });

  it("returns nothing for an actor with no roles", async () => {
    const ids = await groupedIdsFor([]);
    expect(ids).toEqual([]);
  });
});
