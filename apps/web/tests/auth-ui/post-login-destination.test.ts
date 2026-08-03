import { describe, expect, it } from "vitest";

import { postLoginDestination } from "../../lib/post-login-destination";

describe("postLoginDestination", () => {
  it("sends a parent to role routing instead of a requested admin page", () => {
    expect(postLoginDestination("/admin", ["parent"])).toBe("/dashboard");
    expect(postLoginDestination("/en/admin/users", ["parent"])).toBe("/dashboard");
  });

  it("preserves an admin destination for an administrator", () => {
    expect(postLoginDestination("/admin/users?status=pending", ["administrator"])).toBe(
      "/admin/users?status=pending",
    );
  });

  it("does not send one role to another role's dashboard", () => {
    expect(postLoginDestination("/dashboard/tutor", ["parent"])).toBe("/dashboard");
    expect(postLoginDestination("/dashboard/parent", ["tutor"])).toBe("/dashboard");
    expect(postLoginDestination("/dashboard/finance", ["student"])).toBe("/dashboard");
  });

  it("keeps ordinary internal destinations", () => {
    expect(postLoginDestination("/scheduling/lesson_1", ["parent"])).toBe("/scheduling/lesson_1");
  });

  it("falls back for auth-loop and invalid destinations", () => {
    expect(postLoginDestination("/login", ["parent"])).toBe("/dashboard");
    expect(postLoginDestination("//example.com", ["parent"])).toBe("/dashboard");
    expect(postLoginDestination(undefined, ["parent"])).toBe("/dashboard");
  });
});
