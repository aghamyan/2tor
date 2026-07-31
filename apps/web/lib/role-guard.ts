import {
  authorize,
  type Action,
  type Actor,
  type AuthorizeResult,
  type Resource,
  type Role,
} from "@app/auth";

import type { NavItem } from "./nav-registry";

/** Thin wrapper over `@app/auth`'s `authorize()` for use from server pages/layouts. */
export function checkAccess(
  actor: Actor,
  action: Action,
  resource: Resource,
  now?: Date,
): AuthorizeResult {
  return authorize(actor, action, resource, now);
}

/** True if `item.roles` is empty (visible to any authenticated actor) or overlaps `actorRoles`. */
export function canViewNavItem(item: Pick<NavItem, "roles">, actorRoles: readonly Role[]): boolean {
  return item.roles.length === 0 || item.roles.some((role) => actorRoles.includes(role));
}

/** Narrows discovered nav items down to the ones a given actor's roles may see. */
export function filterNavByRole(items: readonly NavItem[], actorRoles: readonly Role[]): NavItem[] {
  return items.filter((item) => canViewNavItem(item, actorRoles));
}
