import type { Role } from "@app/auth";

/**
 * Highest-trust role first, for choosing the one role badge shown in the user menu when a session
 * carries more than one. Mirrors `(app)/(dashboards)/_lib/authorization.ts`'s
 * `preferredDashboardPath` precedence (administrator/super-administrator, finance, tutor, parent,
 * student) rather than importing it — that module lives under a `_lib/` (private) folder owned by
 * the dashboards route group, outside this task's file scope.
 *
 * Kept in this dependency-free file (no `@app/db`) rather than alongside `shell-data.ts`'s
 * database queries, so a "use client" component (the user menu) can import it without pulling
 * `postgres`/Node builtins into the client bundle.
 */
const ROLE_PRECEDENCE: readonly Role[] = [
  "super_administrator",
  "administrator",
  "finance",
  "tutor",
  "parent",
  "student",
];

export function primaryRole(roles: readonly Role[]): Role | undefined {
  return ROLE_PRECEDENCE.find((role) => roles.includes(role));
}
