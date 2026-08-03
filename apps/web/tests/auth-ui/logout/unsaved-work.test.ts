import { afterEach, describe, expect, it } from "vitest";

import { hasUnsavedWork, registerUnsavedWork } from "../../../components/auth/logout/unsaved-work";

describe("unsaved-work registry", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it("reports no unsaved work when nothing is registered", () => {
    expect(hasUnsavedWork()).toBe(false);
  });

  it("reports unsaved work when a registered check is currently dirty", () => {
    cleanups.push(registerUnsavedWork(() => true));
    expect(hasUnsavedWork()).toBe(true);
  });

  it("ignores a registered check once it reports clean", () => {
    let dirty = true;
    cleanups.push(registerUnsavedWork(() => dirty));
    expect(hasUnsavedWork()).toBe(true);
    dirty = false;
    expect(hasUnsavedWork()).toBe(false);
  });

  it("stops consulting a check after it unregisters", () => {
    const unregister = registerUnsavedWork(() => true);
    expect(hasUnsavedWork()).toBe(true);
    unregister();
    expect(hasUnsavedWork()).toBe(false);
  });

  it("is true if any of several registrants is dirty, even if others are clean", () => {
    cleanups.push(registerUnsavedWork(() => false));
    cleanups.push(registerUnsavedWork(() => true));
    cleanups.push(registerUnsavedWork(() => false));
    expect(hasUnsavedWork()).toBe(true);
  });
});
