const tutorsProfileNavItem = {
  id: "tutors.profile",
  label: "tutors.nav.label",
  href: "/tutors",
  roles: ["tutor"] as const,
};

/**
 * Distinct from `tutors.profile`: this destination shows the tutor's assigned students, never
 * profile/setup fields. See `packages/domain/tutors/README.md` for why the two must not be merged.
 */
const tutorsStudentsNavItem = {
  id: "tutors.students",
  label: "tutors.nav.studentsLabel",
  href: "/tutors/students",
  roles: ["tutor"] as const,
};

/**
 * The tutors module registers two destinations, not one — `lib/nav-registry.ts`'s
 * `bundledNavItems`/`discoverNavItems()` both accept a `NavItem | NavItem[]` default export for
 * exactly this case, spreading an array the same as every other module's single object.
 */
const tutorsNavItems = [tutorsProfileNavItem, tutorsStudentsNavItem];

export default tutorsNavItems;
