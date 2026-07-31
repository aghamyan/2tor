import { describe, expect, it } from "vitest";
import type { Role } from "@app/auth";

import { resolveHeaderAuthState } from "../../../components/marketing/site/header-actions";

describe("resolveHeaderAuthState", () => {
  it("treats no session as logged out", () => {
    expect(resolveHeaderAuthState(null)).toEqual({ kind: "logged-out" });
  });

  it("treats a session with an empty roles array as logged out", () => {
    expect(resolveHeaderAuthState({ roles: [] })).toEqual({ kind: "logged-out" });
  });

  const roleLabelKeys: Record<Role, string> = {
    parent: "site.account.role.parent",
    student: "site.account.role.student",
    tutor: "site.account.role.tutor",
    finance: "site.account.role.finance",
    administrator: "site.account.role.administrator",
    super_administrator: "site.account.role.superAdministrator",
  };

  it.each(Object.entries(roleLabelKeys))(
    "maps a %s session to the dashboard + its own role label key",
    (role, roleLabelKey) => {
      expect(resolveHeaderAuthState({ roles: [role as Role] })).toEqual({
        kind: "logged-in",
        dashboardHref: "/dashboard",
        roleLabelKey,
      });
    },
  );

  it("uses the first role when a session carries more than one", () => {
    expect(resolveHeaderAuthState({ roles: ["administrator", "parent"] })).toEqual({
      kind: "logged-in",
      dashboardHref: "/dashboard",
      roleLabelKey: "site.account.role.administrator",
    });
  });
});
