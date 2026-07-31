import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import reportingNavItem from "../../../../packages/domain/reporting/nav";
import { parsePrivacySafeFunnelEvent } from "../../../../packages/domain/reporting/privacy";
import { requireReportingAccess } from "../../../../packages/domain/reporting/services";

const safeEvent = {
  accountContext: "adult_or_unknown" as const,
  subjectKey: "v1_a7EwS3qP8nR2mT6yK9xB",
  stage: "visitor" as const,
  occurredAt: "2026-03-01T12:00:00.000Z",
};

describe("reporting privacy boundary", () => {
  it("accepts a minimal first-party event without returning extra payload fields", () => {
    expect(parsePrivacySafeFunnelEvent(safeEvent)).toEqual({
      subjectKey: safeEvent.subjectKey,
      stage: "visitor",
      occurredAt: new Date(safeEvent.occurredAt),
    });
  });

  it("rejects every product event from a child account", () => {
    expect(() =>
      parsePrivacySafeFunnelEvent({ ...safeEvent, accountContext: "child" }),
    ).toThrowError(expect.objectContaining({ code: "CHILD_PRODUCT_ANALYTICS_DISABLED" }));
  });

  it("rejects prohibited tracking fields even when nested or disguised by casing", () => {
    expect(() =>
      parsePrivacySafeFunnelEvent({
        ...safeEvent,
        metadata: { attribution: { advertising_ID: "not-allowed" } },
      }),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN_ANALYTICS_FIELD" }));
    expect(() =>
      parsePrivacySafeFunnelEvent({
        ...safeEvent,
        metadata: { precise_location: { lat: 40.1 } },
      }),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN_ANALYTICS_FIELD" }));
  });

  it("keeps the reporting route and navigation unavailable to child-facing roles", () => {
    expect(reportingNavItem.roles).not.toContain("student");
    expect(reportingNavItem.roles).not.toContain("parent");
    expect(() => requireReportingAccess({ userId: "child-user", roles: ["student"] })).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("has no analytics beacon or advertising tracker in the reporting UI", async () => {
    const componentPath = fileURLToPath(
      new URL("../../components/reporting/reporting-dashboard.tsx", import.meta.url),
    );
    const pagePath = fileURLToPath(new URL("../../app/(app)/reporting/page.tsx", import.meta.url));
    const source = `${await readFile(componentPath, "utf8")}\n${await readFile(pagePath, "utf8")}`;
    expect(source).not.toMatch(
      /gtag\s*\(|googletagmanager|google-analytics|facebook pixel|segment\.com|mixpanel|amplitude/i,
    );
    expect(source).not.toMatch(/<script|navigator\.sendBeacon/i);
  });
});
