import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drizzle: vi.fn(() => ({ kind: "database" })),
  postgres: vi.fn(() => ({ kind: "sql-client" })),
}));

vi.mock("postgres", () => ({ default: mocks.postgres }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mocks.drizzle }));

import { createDb } from "./client";

it("reuses one postgres pool and database handle per connection string", () => {
  const first = createDb("postgres://pool-test/one");
  const second = createDb("postgres://pool-test/one");
  const other = createDb("postgres://pool-test/two");

  expect(second).toBe(first);
  expect(other).not.toBe(first);
  expect(mocks.postgres).toHaveBeenCalledTimes(2);
  expect(mocks.drizzle).toHaveBeenCalledTimes(2);
});

it("keeps the pool across a module reload", async () => {
  const connectionString = "postgres://pool-test/hot-reload";
  const first = createDb(connectionString);

  vi.resetModules();
  const reloaded = await import("./client");

  expect(reloaded.createDb(connectionString)).toBe(first);
});
