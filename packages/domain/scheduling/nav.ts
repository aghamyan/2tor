const schedulingNavItem = {
  id: "scheduling.overview",
  label: "scheduling.nav.label",
  href: "/scheduling",
  roles: ["parent", "student", "tutor", "administrator", "super_administrator"] as const,
};

export default schedulingNavItem;
