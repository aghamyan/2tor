import { describe, expect, it } from "vitest";
import {
  FOR_PARENTS_POINT_KEYS,
  HOW_IT_WORKS_STEP_KEYS,
  isPublishableTestimonial,
  localHref,
  SUBJECT_HREFS,
  SUBJECT_KEYS,
  TRUST_BAR_ITEM_KEYS,
  WHY_US_POINT_KEYS,
} from "../../../components/marketing/home/content";

describe("localHref", () => {
  it("prefixes every path with the given locale", () => {
    expect(localHref("en", "/consultation")).toBe("/en/consultation");
    expect(localHref("hy", "/consultation")).toBe("/hy/consultation");
  });

  it("does not produce a double slash for the root path", () => {
    expect(localHref("en", "/")).toBe("/en");
  });
});

describe("homepage structural content", () => {
  it("has exactly four how-it-works steps (a real, ordered sequence)", () => {
    expect(HOW_IT_WORKS_STEP_KEYS).toHaveLength(4);
  });

  it("links every subject to an already-public marketing route", () => {
    // Mirrors apps/web/proxy.ts's PUBLIC_PATHS allowlist — these three must stay in sync with it.
    const publicPaths = new Set(["/mathematics", "/programming", "/armenian-language-heritage"]);
    expect(SUBJECT_KEYS).toHaveLength(3);
    for (const key of SUBJECT_KEYS) {
      expect(publicPaths.has(SUBJECT_HREFS[key])).toBe(true);
    }
  });

  it("has four why-us points and four for-parents points", () => {
    expect(WHY_US_POINT_KEYS).toHaveLength(4);
    expect(FOR_PARENTS_POINT_KEYS).toHaveLength(4);
  });

  it("uses progress-trend language, never a projected/predicted grade", () => {
    expect(FOR_PARENTS_POINT_KEYS).toContain("progressTrend");
    expect(FOR_PARENTS_POINT_KEYS.join(",")).not.toMatch(/grade/i);
  });

  it("has four trust-bar proof points", () => {
    expect(TRUST_BAR_ITEM_KEYS).toHaveLength(4);
  });
});

describe("isPublishableTestimonial", () => {
  const base = {
    relationshipVerified: true as const,
    parentalConsent: true as const,
    studentIdentifiable: false as const,
  };

  it("publishes a verified, consented, non-identifying testimonial", () => {
    expect(isPublishableTestimonial(base)).toBe(true);
  });

  it("rejects an unverified relationship", () => {
    expect(isPublishableTestimonial({ ...base, relationshipVerified: false })).toBe(false);
  });

  it("rejects a testimonial without parental consent", () => {
    expect(isPublishableTestimonial({ ...base, parentalConsent: false })).toBe(false);
  });

  it("rejects an identifying testimonial even if otherwise verified and consented", () => {
    expect(isPublishableTestimonial({ ...base, studentIdentifiable: true })).toBe(false);
  });
});
