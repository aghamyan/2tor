import type { Actor, AuthorizeResult } from "@app/auth";
import { describe, expect, it } from "vitest";

import {
  authorizedPanelsForActor,
  preferredDashboardPath,
} from "../../app/(app)/(dashboards)/_lib/authorization";
import { panelsForDashboard } from "../../app/(app)/(dashboards)/_lib/catalog";

const actor = (overrides: Partial<Actor>): Actor => ({
  userId: "viewer-1",
  roles: [],
  ...overrides,
});

describe("dashboard panel authorization", () => {
  it.each([
    ["parent", actor({ roles: ["parent"] })],
    ["student-younger", actor({ roles: ["student"], studentProfileId: "student-profile-1" })],
    ["student-older", actor({ roles: ["student"], studentProfileId: "student-profile-1" })],
    ["tutor", actor({ roles: ["tutor"] })],
    ["admin", actor({ roles: ["administrator"] })],
    ["finance", actor({ roles: ["finance"] })],
  ] as const)("allows the intended actor to see every %s panel", (kind, viewer) => {
    expect(authorizedPanelsForActor(viewer, kind).map((panel) => panel.id)).toEqual(
      panelsForDashboard(kind).map((panel) => panel.id),
    );
  });

  it("does not expose any role dashboard to an unrelated role", () => {
    const finance = actor({ roles: ["finance"] });
    expect(authorizedPanelsForActor(finance, "parent")).toEqual([]);
    expect(authorizedPanelsForActor(finance, "student-younger")).toEqual([]);
    expect(authorizedPanelsForActor(finance, "student-older")).toEqual([]);
    expect(authorizedPanelsForActor(finance, "tutor")).toEqual([]);
    expect(authorizedPanelsForActor(finance, "admin")).toEqual([]);
  });

  it("requires a student actor to own a student profile", () => {
    expect(authorizedPanelsForActor(actor({ roles: ["student"] }), "student-younger")).toEqual([]);
    expect(authorizedPanelsForActor(actor({ roles: ["student"] }), "student-older")).toEqual([]);
  });

  it("runs an authorization decision for every eligible panel", () => {
    const calls: string[] = [];
    const allowed = (): AuthorizeResult => ({ allowed: true });
    const panels = authorizedPanelsForActor(
      actor({ roles: ["parent"] }),
      "parent",
      (_viewer, _kind, panel) => {
        calls.push(panel.id);
        return allowed();
      },
    );
    expect(calls).toEqual(panelsForDashboard("parent").map((panel) => panel.id));
    expect(panels).toHaveLength(calls.length);
  });

  it("uses a deterministic highest-trust redirect for actors with several roles", () => {
    expect(
      preferredDashboardPath(
        actor({ roles: ["student", "parent", "tutor", "finance", "administrator"] }),
      ),
    ).toBe("/dashboard/admin");
    expect(preferredDashboardPath(actor({ roles: ["student", "parent"] }))).toBe(
      "/dashboard/parent",
    );
    expect(preferredDashboardPath(actor({ roles: [] }))).toBeNull();
  });
});
