const discussionsNavItem = {
  id: "discussions.overview",
  label: "discussions.nav.label",
  href: "/discussions",
  roles: ["parent", "student", "tutor", "administrator", "super_administrator"] as const,
};

export default discussionsNavItem;
