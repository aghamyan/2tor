import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "./logger";

describe("createLogger", () => {
  it("redacts configured PII fields in structured output", () => {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ level: "info" }, stream);

    logger.info({
      email: "student@example.com",
      headers: { authorization: "Bearer secret" },
      child: { name: "Ava" },
    });

    expect(output).not.toContain("student@example.com");
    expect(output).not.toContain("Bearer secret");
    expect(output).not.toContain("Ava");
    expect(JSON.parse(output)).toMatchObject({
      email: "[Redacted]",
      headers: { authorization: "[Redacted]" },
      child: { name: "[Redacted]" },
    });
  });
});
