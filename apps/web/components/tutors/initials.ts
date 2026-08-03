export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const second = parts[1];
  return (first[0] + (second?.[0] ?? "")).toUpperCase();
}
