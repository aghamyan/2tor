const assignmentsNavItem = {
  id: "assignments.overview",
  label: "assignments.nav.label",
  href: "/assignments",
  roles: ["parent", "student", "tutor", "administrator", "super_administrator"] as const,
};
export default assignmentsNavItem;
