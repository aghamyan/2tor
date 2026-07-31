import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@app/auth";

describe("@app/auth smoke test", () => {
  it("resolves from the workspace symlink and can hash/verify with the native argon2 module", async () => {
    const hash = await hashPassword("correct horse battery staple 42!");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, "correct horse battery staple 42!")).resolves.toBe(true);
  });
});
