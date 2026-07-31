import { text, timestamp, bigint, pgEnum } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

/**
 * Shared column builders used by every domain schema file. Centralizing these keeps the
 * ULID/timestamp/money conventions in packages/db/README.md enforced at the type level instead
 * of re-implemented (and potentially drifted) per table.
 */

/** ULID primary key, generated in the app layer per docs/CONVENTIONS.md ("IDs are ULIDs"). */
export const ulidPk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => ulid());

/** A ULID foreign-key column (nullability/`.references()` added at the call site). */
export const ulidFk = (name: string) => text(name);

/** UTC timestamp pair. Per-user IANA time zone is a separate column — see `ianaTimezone()`. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

/** UTC timestamp column. All timestamps are stored in UTC; convert only at render time. */
export const utcTimestamp = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** An IANA time zone string (e.g. "America/Los_Angeles", "Asia/Yerevan"), validated at the Zod boundary. */
export const ianaTimezone = (name: string) => text(name);

/** ISO 4217 currencies in use. Extend here (not per-table) if a new currency is introduced. */
export const currencyEnum = pgEnum("currency", ["USD", "AMD"]);

/** Shared by every uploaded-file table (submission_files, project_files, message_attachments). */
export const virusScanStatusEnum = pgEnum("virus_scan_status", [
  "pending",
  "clean",
  "infected",
  "error",
]);

/**
 * Money is always an integer minor-unit amount (USD cents, AMD luma) paired with an explicit
 * currency. `bigint` avoids int4 overflow for AMD luma aggregates (100 luma/AMD) even though a
 * single line item would fit in int4 — one rule applied uniformly beats per-column judgment calls.
 */
export const minorUnits = (name: string) => bigint(name, { mode: "number" });
