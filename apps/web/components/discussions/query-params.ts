/**
 * Builds a `/discussions`-family href by taking the current query string and applying overrides —
 * `null` removes a key, a string sets it. Used for tab links and prev/next pagination links, which
 * must preserve whichever other filters (search, sort, tag) are already active.
 */
export function buildDiscussionsHref(
  basePath: string,
  current: Record<string, string | undefined>,
  overrides: Record<string, string | null> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
