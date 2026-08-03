import { describe, expect, it } from "vitest";

import { summarizeDevice } from "../../../app/(app)/settings/sessions/device-summary";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("summarizeDevice", () => {
  it("returns nulls for a missing user agent", () => {
    expect(summarizeDevice(null)).toEqual({ browser: null, os: null });
  });

  it("distinguishes Chrome from Safari on macOS, not confusing the two", () => {
    expect(summarizeDevice(CHROME_MAC)).toEqual({ browser: "Chrome", os: "macOS" });
    expect(summarizeDevice(SAFARI_MAC)).toEqual({ browser: "Safari", os: "macOS" });
  });

  it("identifies Chromium Edge as Edge, not Chrome, on Windows", () => {
    expect(summarizeDevice(EDGE_WINDOWS)).toEqual({ browser: "Edge", os: "Windows" });
  });

  it("identifies Firefox on Linux", () => {
    expect(summarizeDevice(FIREFOX_LINUX)).toEqual({ browser: "Firefox", os: "Linux" });
  });

  it("identifies mobile Safari on iOS and Chrome on Android", () => {
    expect(summarizeDevice(SAFARI_IOS)).toEqual({ browser: "Safari", os: "iOS" });
    expect(summarizeDevice(CHROME_ANDROID)).toEqual({ browser: "Chrome", os: "Android" });
  });

  it("degrades gracefully for an unrecognized user agent", () => {
    expect(summarizeDevice("SomeBot/1.0")).toEqual({ browser: null, os: null });
  });
});
