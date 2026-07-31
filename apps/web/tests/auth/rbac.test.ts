import { describe, expect, it } from "vitest";

import { resolveSessionLifetimeMinutes, SESSION_LIFETIME_MINUTES } from "@app/auth";

describe("resolveSessionLifetimeMinutes", () => {
  it("returns the single role's lifetime when only one role is held", () => {
    expect(resolveSessionLifetimeMinutes(["parent"])).toBe(SESSION_LIFETIME_MINUTES.parent);
  });

  it("returns the shortest lifetime across multiple held roles", () => {
    const lifetime = resolveSessionLifetimeMinutes(["parent", "super_administrator", "tutor"]);
    expect(lifetime).toBe(SESSION_LIFETIME_MINUTES.super_administrator);
  });

  it("gives administrator/finance a shorter lifetime than parent/student/tutor", () => {
    expect(SESSION_LIFETIME_MINUTES.administrator).toBeLessThan(SESSION_LIFETIME_MINUTES.parent);
    expect(SESSION_LIFETIME_MINUTES.finance).toBeLessThan(SESSION_LIFETIME_MINUTES.parent);
    expect(SESSION_LIFETIME_MINUTES.administrator).toBeLessThan(SESSION_LIFETIME_MINUTES.tutor);
  });

  it("throws for an empty role list rather than silently returning Infinity", () => {
    expect(() => resolveSessionLifetimeMinutes([])).toThrow();
  });
});
