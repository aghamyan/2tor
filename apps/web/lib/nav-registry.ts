import { glob } from "node:fs/promises";

import type { Role } from "@app/auth";
import academicsNavItem from "../../../packages/domain/academics/nav";
import administrationNavItem from "../../../packages/domain/administration/nav";
import assessmentsNavItem from "../../../packages/domain/assessments/nav";
import assignmentsNavItem from "../../../packages/domain/assignments/nav";
import communicationNavItem from "../../../packages/domain/communication/nav";
import consentNavItem from "../../../packages/domain/consent/nav";
import contentNavItem from "../../../packages/domain/content/nav";
import discussionsNavItem from "../../../packages/domain/discussions/nav";
import familiesNavItem from "../../../packages/domain/families/nav";
import gamificationNavItem from "../../../packages/domain/gamification/nav";
import matchingNavItem from "../../../packages/domain/matching/nav";
import paymentsNavItem from "../../../packages/domain/payments/nav";
import payoutsNavItem from "../../../packages/domain/payouts/nav";
import projectsNavItem from "../../../packages/domain/projects/nav";
import reportingNavItem from "../../../packages/domain/reporting/nav";
import schedulingNavItem from "../../../packages/domain/scheduling/nav";
import supportNavItem from "../../../packages/domain/support/nav";
import tutorsNavItem from "../../../packages/domain/tutors/nav";

/**
 * Bundler-safe alternative to `fileURLToPath()`. Turbopack's Server Component runtime provides a
 * `URL` global that isn't the same class Node's `node:url` bindings validate with `instanceof`,
 * so `fileURLToPath(someUrl)` throws `ERR_INVALID_ARG_TYPE` even though the value is structurally
 * a URL. Coercing via `String()` (self-dispatch on the object, no cross-realm check) avoids it.
 */
function fileUrlToPath(fileUrl: string | URL): string {
  return decodeURIComponent(String(fileUrl).replace(/^file:\/\//, ""));
}

export interface NavItem {
  /** Stable identifier, unique across every discovered module. */
  id: string;
  /** An `@app/i18n` message key (e.g. `"billing.nav.label"`) — not raw display text. */
  label: string;
  href: string;
  /** Roles allowed to see this item. An empty array means any authenticated actor. */
  roles: readonly Role[];
}

const bundledNavItems: NavItem[] = [
  academicsNavItem,
  administrationNavItem,
  assessmentsNavItem,
  assignmentsNavItem,
  communicationNavItem,
  consentNavItem,
  contentNavItem,
  discussionsNavItem,
  familiesNavItem,
  gamificationNavItem,
  matchingNavItem,
  paymentsNavItem,
  payoutsNavItem,
  projectsNavItem,
  reportingNavItem,
  schedulingNavItem,
  supportNavItem,
  tutorsNavItem,
];

function isNavItem(value: unknown): value is NavItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.label === "string" &&
    typeof item.href === "string" &&
    Array.isArray(item.roles) &&
    item.roles.every((role) => typeof role === "string")
  );
}

const domainDirectoryUrl = new URL("../../../packages/domain/", import.meta.url);

async function globNavFiles(): Promise<string[]> {
  const files: string[] = [];
  for await (const file of glob("*/nav.ts", { cwd: fileUrlToPath(domainDirectoryUrl) })) {
    files.push(String(file));
  }
  return files.sort();
}

/**
 * Discovers every `packages/domain/<module>/nav.ts` default export. A module registers itself in
 * navigation purely by adding this file — nothing here needs editing when a module is added.
 * Mirrors `@app/i18n`'s `getMessages` auto-discovery (see `packages/i18n/src/getMessages.ts`),
 * the sanctioned pattern for this kind of central-file-free registration in this repo.
 *
 * Returns every discovered item unfiltered by role — see `./role-guard.ts`'s `filterNavByRole`
 * for narrowing the list down to what a specific actor may see. This function has no session/DB
 * access, so it cannot resolve an actor itself.
 */
export async function discoverNavItems(): Promise<NavItem[]> {
  // Next/Turbopack cannot bundle arbitrary file-URL imports discovered at runtime. Keep the
  // filesystem path in tests to enforce the drop-in module contract, and use statically bundled
  // production modules in the application runtime.
  if (process.env.NODE_ENV !== "test") return [...bundledNavItems];

  const files = await globNavFiles();
  const items: NavItem[] = [];

  for (const file of files) {
    let moduleExports: { default?: unknown };
    try {
      moduleExports = await import(new URL(file, domainDirectoryUrl).href);
    } catch {
      // A single module's nav.ts failing to import (syntax error, missing default export at
      // runtime, etc.) must not take down the shell for every other module.
      continue;
    }
    if (isNavItem(moduleExports.default)) items.push(moduleExports.default);
  }

  return items;
}
