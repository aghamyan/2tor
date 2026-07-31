import { auditQueryFiltersSchema } from "./schemas";
import type { AuditQueryFilters, AuditQueryPage, AuditStore } from "./types";

/**
 * Read API backing admin audit-log screens (spec §16.4). Cursor-based per CONVENTIONS.md ("Pagination
 * on every list endpoint") — `nextCursor` is opaque; pass it straight back as `filters.cursor` for
 * the next page, never construct one by hand.
 */
export function queryAuditEvents(
  store: AuditStore,
  filters: AuditQueryFilters = {},
): Promise<AuditQueryPage> {
  const parsed = auditQueryFiltersSchema.parse(filters);
  return store.queryEvents(parsed);
}
