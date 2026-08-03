import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

type SqlClient = ReturnType<typeof postgres>;

interface CachedDatabase {
  client: SqlClient;
  database: Database;
}

/**
 * The web app imports domain runtimes from many independently compiled Next.js modules and the
 * worker invokes many job definitions. A module-local singleton in every caller therefore still
 * creates one postgres.js pool per domain/job; during dev hot reloads those pools can outlive the
 * module that created them. Keep the cache on `globalThis` so every copy of this package in the
 * same process — including hot-reloaded copies — converges on one pool per connection string.
 */
const databaseGlobals = globalThis as typeof globalThis & {
  __appDatabaseCache?: Map<string, CachedDatabase>;
};

function databaseCache(): Map<string, CachedDatabase> {
  databaseGlobals.__appDatabaseCache ??= new Map();
  return databaseGlobals.__appDatabaseCache;
}

/** Creates or reuses a typed `db` handle for the given connection string. */
export function createDb(connectionString: string): Database {
  const cache = databaseCache();
  const cached = cache.get(connectionString);
  if (cached) return cached.database;

  const client = postgres(connectionString, {
    // This is now the process-wide pool rather than one of many per-domain pools. Ten connections
    // preserve normal concurrency while keeping web + worker comfortably below Postgres's limit.
    max: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });
  const database = drizzle(client, { schema });
  cache.set(connectionString, { client, database });
  return database;
}

/** Runs `fn` inside a single SQL transaction, rolling back on any thrown error. */
export function withTransaction<T>(db: Database, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
