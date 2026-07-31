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

/** Creates a typed `db` handle for the given connection string. One `postgres` client per call. */
export function createDb(connectionString: string): Database {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

/** Runs `fn` inside a single SQL transaction, rolling back on any thrown error. */
export function withTransaction<T>(db: Database, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
