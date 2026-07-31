const administrationNavItem = {
  id: "administration.overview",
  label: "admin.nav.label",
  href: "/admin",
  roles: ["administrator", "super_administrator"] as const,
};

export default administrationNavItem;
