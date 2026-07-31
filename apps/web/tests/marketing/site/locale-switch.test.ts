import { describe, expect, it } from "vitest";

import { buildLocaleSwitchHref } from "../../../components/marketing/site/locale-switch";

describe("buildLocaleSwitchHref", () => {
  it("swaps a locale-prefixed path to the other locale", () => {
    expect(buildLocaleSwitchHref("/en/pricing", "hy")).toBe("/hy/pricing");
    expect(buildLocaleSwitchHref("/hy/home", "en")).toBe("/en/home");
  });

  it("prefixes a locale-stripped path (proxy.ts's post-rewrite form)", () => {
    expect(buildLocaleSwitchHref("/pricing", "hy")).toBe("/hy/pricing");
  });

  it("handles the bare root path without a doubled slash", () => {
    expect(buildLocaleSwitchHref("/", "hy")).toBe("/hy");
    expect(buildLocaleSwitchHref("/en", "hy")).toBe("/hy");
  });

  it("does not mistake a path segment that merely starts with a locale code", () => {
    // "/enroll" must not be treated as locale "en" + "/roll".
    expect(buildLocaleSwitchHref("/enroll", "hy")).toBe("/hy/enroll");
  });
});
