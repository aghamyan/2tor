import { glob } from "node:fs/promises";

import type { Role } from "@app/auth";

import { filterNavByRole } from "./role-guard";
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
import tutorsNavItems from "../../../packages/domain/tutors/nav";

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
  ...tutorsNavItems,
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

/** A `nav.ts` default export is either one `NavItem` (the common case) or several — a module that
 * owns more than one destination (see `packages/domain/tutors/nav.ts`) exports an array instead of
 * adding a second file. */
function isNavItemArray(value: unknown): value is NavItem[] {
  return Array.isArray(value) && value.every(isNavItem);
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
    else if (isNavItemArray(moduleExports.default)) items.push(...moduleExports.default);
  }

  return items;
}

export interface NavGroup {
  /** Stable identifier for the section, e.g. `"learning"`. */
  id: string;
  /** An `@app/i18n` message key for the section heading. */
  labelKey: string;
  items: NavItem[];
}

/**
 * The learning workspace deliberately has a smaller vocabulary than the platform as a whole.
 * A learner or parent should not have to understand our internal modules to find their class or
 * homework, and a tutor needs just one additional doorway to their students. Authorization still
 * happens at each route; this only removes redundant navigation choices.
 */
export function simplifyLearningNavForRole(
  items: readonly NavItem[],
  actorRoles: readonly Role[],
): NavItem[] {
  const focusedRole = actorRoles.includes("tutor")
    ? "tutor"
    : actorRoles.includes("parent")
      ? "parent"
      : actorRoles.includes("student")
        ? "student"
        : null;

  if (!focusedRole) return [...items];

  const allowed =
    focusedRole === "tutor"
      ? new Set([
          "scheduling.overview",
          "assignments.overview",
          "tutors.profile",
          "tutors.students",
        ])
      : new Set(["scheduling.overview", "assignments.overview"]);

  return items.filter((item) => allowed.has(item.id));
}

export function hasFocusedLearningNav(actorRoles: readonly Role[]): boolean {
  return (
    actorRoles.includes("student") || actorRoles.includes("parent") || actorRoles.includes("tutor")
  );
}

const otherGroupId = "more";

/** Section display order. Sections with no visible items for the current actor are omitted entirely. */
const GROUP_ORDER = [
  "learning",
  "schedule",
  "coursework",
  "progress",
  "resources",
  "communication",
  "family",
  "billing",
  "profile",
  "admin",
  "support",
  otherGroupId,
] as const;
type GroupId = (typeof GROUP_ORDER)[number];

/**
 * Section a discovered item belongs to, keyed by its `id`. This is the one place a new
 * `packages/domain/<module>/nav.ts` needs a matching entry — grouping is presentational judgment
 * (which section a workflow "feels like" it belongs in) that can't be inferred from `{ id, label,
 * href, roles }` alone, unlike role filtering (which reads straight off `roles`). An item with no
 * entry here still renders (see `otherGroupId` above) — adding a module never *hides* it, it just
 * lands in "More" until this map is updated. Values are typed against `GroupId` (not `string`) so
 * a typo here — a group that doesn't exist in `GROUP_ORDER` — is a compile error instead of an
 * authorized nav item silently disappearing (`GROUP_ORDER.filter(byGroup.has)` would never reach
 * a bucket keyed by a misspelled group id).
 */
const GROUP_BY_ITEM_ID: Record<string, GroupId> = {
  "academics.overview": "learning",
  "scheduling.overview": "schedule",
  "assignments.overview": "coursework",
  "assessments.overview": "coursework",
  "projects.overview": "coursework",
  "gamification.overview": "progress",
  "content.overview": "resources",
  "discussions.overview": "resources",
  "communication.inbox": "communication",
  "families.overview": "family",
  "consent.overview": "family",
  "payments.overview": "billing",
  "payouts.overview": "billing",
  "tutors.profile": "profile",
  "tutors.students": "profile",
  "administration.overview": "admin",
  "matching.queue": "admin",
  "reporting.overview": "admin",
  "support.queue": "support",
};

const GROUP_LABEL_KEYS: Record<GroupId, string> = {
  learning: "appShell.nav.groups.learning",
  schedule: "appShell.nav.groups.schedule",
  coursework: "appShell.nav.groups.coursework",
  progress: "appShell.nav.groups.progress",
  resources: "appShell.nav.groups.resources",
  communication: "appShell.nav.groups.communication",
  family: "appShell.nav.groups.family",
  billing: "appShell.nav.groups.billing",
  profile: "appShell.nav.groups.profile",
  admin: "appShell.nav.groups.admin",
  support: "appShell.nav.groups.support",
  more: "appShell.nav.groups.more",
};

/**
 * Fixed within-group ordering for sections with more than one item. Alphabetical `id` order (what
 * `discoverNavItems()` naturally produces) doesn't match the intended reading order — e.g.
 * "assessments.overview" sorts before "assignments.overview" but should read after it — so this is
 * explicit rather than left to input order.
 */
const GROUP_ITEM_ORDER: Partial<Record<GroupId, readonly string[]>> = {
  coursework: ["assignments.overview", "assessments.overview", "projects.overview"],
  resources: ["content.overview", "discussions.overview"],
  family: ["families.overview", "consent.overview"],
  billing: ["payments.overview", "payouts.overview"],
  admin: ["administration.overview", "matching.queue", "reporting.overview"],
  profile: ["tutors.profile", "tutors.students"],
};

function sortByExplicitOrder(items: NavItem[], order: readonly string[] | undefined): NavItem[] {
  if (!order || order.length === 0) return items;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * Narrows `items` to what `actorRoles` may see (via `./role-guard.ts`'s `filterNavByRole` — the
 * single, already-tested predicate; not reimplemented here) and arranges the visible set into
 * labeled sections for the sidebar, instead of one flat list. Grouping runs strictly after
 * filtering, so a section header itself never leaks the existence of a module the actor can't see:
 * a role that can see nothing in a section gets no section at all.
 */
export function groupNavItems(items: readonly NavItem[], actorRoles: readonly Role[]): NavGroup[] {
  const visible = filterNavByRole(items, actorRoles);

  const byGroup = new Map<string, NavItem[]>();
  for (const item of visible) {
    const groupId = GROUP_BY_ITEM_ID[item.id] ?? otherGroupId;
    const bucket = byGroup.get(groupId);
    if (bucket) bucket.push(item);
    else byGroup.set(groupId, [item]);
  }

  const groups: NavGroup[] = [];
  for (const groupId of GROUP_ORDER) {
    const bucket = byGroup.get(groupId);
    if (!bucket) continue;
    groups.push({
      id: groupId,
      labelKey: GROUP_LABEL_KEYS[groupId],
      items: sortByExplicitOrder(bucket, GROUP_ITEM_ORDER[groupId]),
    });
  }
  return groups;
}
