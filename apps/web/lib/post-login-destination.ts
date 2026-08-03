import type { Role } from "@app/auth";

const DEFAULT_DESTINATION = "/dashboard";

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function unprefixedPath(pathname: string): string {
  const match = pathname.match(/^\/(?:en|hy)(\/.*|$)/);
  if (!match) return pathname;
  return match[1] || "/";
}

function hasAnyRole(roles: readonly Role[], allowed: readonly Role[]): boolean {
  return allowed.some((role) => roles.includes(role));
}

/**
 * Keeps a legitimate `next` destination while preventing a successful login from sending an
 * actor straight into another role's workspace. Destination pages remain responsible for their
 * own authoritative authorization; this is a role-aware navigation guard, not an access-control
 * replacement.
 */
export function postLoginDestination(
  requestedPath: string | undefined,
  roles: readonly Role[],
): string {
  if (!requestedPath || !requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return DEFAULT_DESTINATION;
  }

  const pathname = unprefixedPath(requestedPath.split(/[?#]/, 1)[0] ?? requestedPath);

  if (
    matchesRoute(pathname, "/login") ||
    matchesRoute(pathname, "/logout") ||
    matchesRoute(pathname, "/signed-out")
  ) {
    return DEFAULT_DESTINATION;
  }

  const roleRestrictedRoutes: Array<{
    route: string;
    roles: readonly Role[];
  }> = [
    { route: "/admin", roles: ["administrator", "super_administrator"] },
    { route: "/dashboard/admin", roles: ["administrator", "super_administrator"] },
    { route: "/dashboard/finance", roles: ["finance"] },
    { route: "/dashboard/tutor", roles: ["tutor"] },
    { route: "/dashboard/parent", roles: ["parent"] },
    { route: "/dashboard/student", roles: ["student"] },
  ];

  const restriction = roleRestrictedRoutes.find(({ route }) => matchesRoute(pathname, route));
  if (restriction && !hasAnyRole(roles, restriction.roles)) return DEFAULT_DESTINATION;

  return requestedPath;
}
