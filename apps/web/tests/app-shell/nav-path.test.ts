import { describe, expect, it } from "vitest";

import { isActiveNavHref, stripLocalePrefix } from "../../components/app-shell/nav-path";

describe("stripLocalePrefix", () => {
  it("strips a locale segment from a prefixed path", () => {
    expect(stripLocalePrefix("/en/payouts")).toBe("/payouts");
    expect(stripLocalePrefix("/hy/payouts")).toBe("/payouts");
  });

  it("collapses the locale-only root to '/'", () => {
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(stripLocalePrefix("/hy")).toBe("/");
  });

  it("leaves an unprefixed path unchanged", () => {
    expect(stripLocalePrefix("/payouts")).toBe("/payouts");
  });

  it("strips only the leading locale segment on a nested route", () => {
    expect(stripLocalePrefix("/en/payouts/batches/1")).toBe("/payouts/batches/1");
  });

  it("does not treat a same-named path segment as a locale", () => {
    // "en" is only stripped as the *first* segment.
    expect(stripLocalePrefix("/support/en")).toBe("/support/en");
  });
});

describe("isActiveNavHref", () => {
  it("matches the exact route, locale-prefixed", () => {
    expect(isActiveNavHref("/en/payouts", "/payouts")).toBe(true);
  });

  it("matches a nested route beneath the item's href", () => {
    expect(isActiveNavHref("/en/payouts/batches/1", "/payouts")).toBe(true);
  });

  it("does not match an unrelated route that merely shares a prefix", () => {
    expect(isActiveNavHref("/en/payoutsomething", "/payouts")).toBe(false);
  });

  it("does not match a sibling module", () => {
    expect(isActiveNavHref("/en/payments", "/payouts")).toBe(false);
  });
});
