const contentNavItem = {
  id: "content.overview",
  label: "content.nav.label",
  href: "/content",
  roles: ["parent", "student", "tutor", "administrator", "super_administrator"] as const,
};
export default contentNavItem;
