const assessmentsNavItem = {
  id: "assessments.overview",
  label: "assessments.nav.label",
  href: "/assessments",
  roles: ["parent", "student", "tutor", "administrator", "super_administrator"] as const,
};

export default assessmentsNavItem;
