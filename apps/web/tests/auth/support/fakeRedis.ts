import type { RedisLike } from "@app/auth";

interface StoredValue {
  value: string;
  expiresAt: number | null;
}

/**
 * In-memory `RedisLike` fake for unit tests. No `ioredis`/`ioredis-mock` dependency is available
 * to `apps/web` here, and none is needed — the interface is small (get/set/del/sadd/srem/
 * smembers), so a real TTL-respecting fake is simple enough to write directly.
 */
export class FakeRedis implements RedisLike {
  private strings = new Map<string, StoredValue>();
  private sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    const entry = this.strings.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.strings.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode: "PX", durationMs: number): Promise<unknown> {
    this.strings.set(key, { value, expiresAt: Date.now() + durationMs });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.strings.delete(key)) removed++;
      if (this.sets.delete(key)) removed++;
    }
    return removed;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) added++;
      set.add(member);
    }
    this.sets.set(key, set);
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed++;
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? []);
  }

  /** Test-only helper: expire a key immediately, to exercise TTL-expiry paths deterministically. */
  expireNow(key: string): void {
    const entry = this.strings.get(key);
    if (entry) entry.expiresAt = Date.now() - 1;
  }
}
